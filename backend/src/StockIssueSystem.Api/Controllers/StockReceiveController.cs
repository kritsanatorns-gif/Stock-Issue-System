using System.Data;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/stock-receives")]
public sealed class StockReceiveController(AppDbContext dbContext) : ControllerBase
{
    private const string MainLocationId = "MAIN";
    private const string ReceiveDocType = "RECEIVE";
    private const int StockCostLotCancelledStatus = 2;

    private sealed record EmployeeReportInfo(string Name, string Department);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StockIssueDto>>> GetStockReceives(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var query = dbContext.StockHeaders
            .Include(header => header.Details)
            .Where(header => header.DocType == ReceiveDocType)
            .AsQueryable();

        if (startDate is not null)
        {
            query = query.Where(header => header.TransactionDate >= startDate.Value.Date);
        }

        if (endDate is not null)
        {
            query = query.Where(header => header.TransactionDate < endDate.Value.Date.AddDays(1));
        }

        var reports = await query
            .OrderByDescending(header => header.TransactionDate)
            .ThenByDescending(header => header.HeaderId)
            .ToListAsync();
        var products = await GetProductsByStockHeaders(reports);
        var balances = await GetBalancesByStockHeaders(reports);
        var employees = await GetEmployeesByStockHeaders(reports);
        var costs = await GetCostLotsByStockHeaders(reports);
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(reports.Select(report => ToDto(report, products, balances, employees, costs, statusNames)).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> CreateStockReceive(CreateStockIssueDto request)
    {
        var validationError = ValidateRequest(request);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var masterError = await ValidateMasterData(request);

        if (masterError is not null)
        {
            return BadRequest(masterError);
        }

        var supplierIds = request.Items.Select(item => item.SupplierId!.Value).Distinct().ToList();
        var suppliersById = await dbContext.Suppliers
            .Where(item => supplierIds.Contains(item.SupplierId) && item.SupplierStatus == 1)
            .ToDictionaryAsync(item => item.SupplierId);

        await UpsertProducts(request);

        var stockHeader = new StockHeader
        {
            CreateBy = request.EmployeeId.ToString(),
            CreateDate = DateTime.Now,
            Details = request.Items.Select(item => new StockDetail
            {
                Barcode = item.Barcode.Trim(),
                Category = string.IsNullOrWhiteSpace(item.Category) ? "General" : item.Category.Trim(),
                CostLot = item.CostLot.Trim(),
                ProductId = item.Code.Trim(),
                ProductName = item.ProductName.Trim(),
                Qty = Convert.ToInt32(item.Quantity),
                ReceiveQty = item.ReceiveQuantity,
                ReceiveUnit = string.IsNullOrWhiteSpace(item.ReceiveUnit) ? item.Unit.Trim() : item.ReceiveUnit.Trim(),
                Unit = item.Unit.Trim(),
            }).ToList(),
            Department = request.Department.Trim(),
            Division = request.Division.Trim(),
            DocType = ReceiveDocType,
            PoInvoiceNo = request.PoInvoiceNo?.Trim() ?? string.Empty,
            EmployeeId = request.EmployeeId.ToString(),
            Remark = request.Division.Trim(),
            SupplierId = supplierIds.Count == 1 ? supplierIds[0] : null,
            Status = StockHeaderStatuses.Completed,
            TransactionDate = ThailandDateTime.FromClient(request.CreatedAt),
        };

        dbContext.StockHeaders.Add(stockHeader);
        await UpdateStockBalances(request);
        await dbContext.SaveChangesAsync();
        stockHeader.ReceiveNo = FormatReceiveNo(stockHeader, await GetDailyReceiveSequence(stockHeader));
        AddCostLots(stockHeader, request, suppliersById);
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(new
        {
            HeaderId = stockHeader.HeaderId,
            DocumentNo = stockHeader.ReceiveNo,
            PoInvoiceNo = stockHeader.PoInvoiceNo,
            CreatedAt = stockHeader.TransactionDate,
            EmployeeId = request.EmployeeId,
            EmployeeName = request.EmployeeName,
            Items = request.Items,
            Status = StockHeaderStatuses.GetName(statusNames, stockHeader.Status),
            TotalItems = request.Items.Count,
            TotalQty = request.Items.Sum(item => item.Quantity),
        });
    }

    [HttpPost("{headerId:int}/cancel")]
    public async Task<ActionResult<StockIssueDto>> CancelStockReceive(int headerId, CancelStockDocumentDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return BadRequest("Employee ID is required.");
        }

        var report = await dbContext.StockHeaders
            .Include(header => header.Details)
            .FirstOrDefaultAsync(header => header.HeaderId == headerId && header.DocType == ReceiveDocType);

        if (report is null)
        {
            return NotFound("Stock receive document not found.");
        }

        if (report.Status is StockHeaderStatuses.Cancelled or StockHeaderStatuses.PartiallyCancelled)
        {
            return BadRequest("Stock receive document is already cancelled.");
        }

        var (cancelQuantities, isFullCancel, quantityError) = BuildCancelQuantities(report, request);

        if (quantityError is not null)
        {
            return BadRequest(quantityError);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var cancelError = await ValidateReceiveCanBeCancelled(report, cancelQuantities, isFullCancel);

        if (cancelError is not null)
        {
            return BadRequest(cancelError);
        }

        await ReverseStockBalances(report, cancelQuantities);
        await CancelCostLots(report, cancelQuantities, isFullCancel);

        report.Status = StockHeaderStatuses.Cancelled;
        report.Remark = AppendCancelRemark(report.Remark, request.Remark);
        report.CancelNo = FormatCancelNo(DateTime.Now, await GetDailyCancelSequence(DateTime.Now));

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        var products = await GetProductsByStockHeaders([report]);
        var balances = await GetBalancesByStockHeaders([report]);
        var employees = await GetEmployeesByStockHeaders([report]);
        var costs = await GetCostLotsByStockHeaders([report]);
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(ToDto(report, products, balances, employees, costs, statusNames));
    }

    private void AddCostLots(
        StockHeader stockHeader,
        CreateStockIssueDto request,
        IReadOnlyDictionary<int, Supplier> suppliersById)
    {
        var detailQueueByProductId = stockHeader.Details
            .OrderBy(detail => detail.DetailId)
            .GroupBy(detail => detail.ProductId)
            .ToDictionary(
                group => group.Key,
                group => new Queue<StockDetail>(group));

        foreach (var item in request.Items)
        {
            var productId = item.Code.Trim();

            if (!detailQueueByProductId.TryGetValue(productId, out var details)
                || !details.TryDequeue(out var detail))
            {
                continue;
            }

            var originalQty = Convert.ToInt32(item.Quantity);
            var receiveQty = item.Quantity;
            var purchaseCost = TryParseCost(item.CostLot);
            var unitCost = receiveQty <= 0 ? 0 : Math.Round(purchaseCost / receiveQty, 2);
            var supplier = suppliersById[item.SupplierId!.Value];

            dbContext.StockCostLots.Add(new StockCostLot
            {
                CreatedDate = stockHeader.TransactionDate,
                OriginalQty = originalQty,
                ProductId = productId,
                ReceiveDetailId = detail.DetailId,
                ReceiveHeaderId = stockHeader.HeaderId,
                RemainingQty = originalQty,
                SupplierId = supplier.SupplierId,
                SupplierName = supplier.SupplierName,
                Status = 1,
                UnitCost = unitCost,
            });
        }
    }

    private async Task UpsertProducts(CreateStockIssueDto request)
    {
        var productIds = request.Items.Select(item => item.Code.Trim()).Distinct().ToList();
        var products = await dbContext.Products
            .Where(product => productIds.Contains(product.ProductId))
            .ToDictionaryAsync(product => product.ProductId);
        var newProductIds = new HashSet<string>();

        foreach (var item in request.Items)
        {
            var productId = item.Code.Trim();

            if (products.TryGetValue(productId, out var product))
            {
                product.ProductName = item.ProductName.Trim();
                product.Barcode = item.Barcode.Trim();
                product.CategoryName = string.IsNullOrWhiteSpace(item.Category) ? product.CategoryName : item.Category.Trim();
                if (!string.IsNullOrWhiteSpace(item.ImageName))
                {
                    product.Img = item.ImageName.Trim();
                }

                continue;
            }

            if (!newProductIds.Add(productId))
            {
                continue;
            }

            dbContext.Products.Add(new Product
            {
                Barcode = item.Barcode.Trim(),
                CategoryName = string.IsNullOrWhiteSpace(item.Category) ? "General" : item.Category.Trim(),
                ConversionQty = item.ConversionQty <= 0 ? 1 : item.ConversionQty,
                CreatedDate = DateTime.Now,
                CreatedName = request.EmployeeId.ToString(),
                Img = item.ImageName.Trim(),
                IssueUnit = item.Unit.Trim(),
                MinQty = item.MinQty < 0 ? 10 : item.MinQty,
                ProductId = productId,
                ProductName = item.ProductName.Trim(),
                ReceiveUnit = string.IsNullOrWhiteSpace(item.ReceiveUnit) ? item.Unit.Trim() : item.ReceiveUnit.Trim(),
                Status = "Active",
            });
        }
    }

    private async Task UpdateStockBalances(CreateStockIssueDto request)
    {
        var productIds = request.Items.Select(item => item.Code.Trim()).Distinct().ToList();
        var balances = await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);

        foreach (var item in request.Items)
        {
            var productId = item.Code.Trim();
            var receiveQty = Convert.ToInt32(item.Quantity);

            if (balances.TryGetValue(productId, out var balance))
            {
                balance.Qty += receiveQty;
                balance.LastUpdate = DateTime.Now;
                continue;
            }

            dbContext.StockBalances.Add(new StockBalance
            {
                LastUpdate = DateTime.Now,
                LocationId = MainLocationId,
                ProductId = productId,
                Qty = receiveQty,
            });
        }
    }

    private async Task<string?> ValidateReceiveCanBeCancelled(
        StockHeader report,
        IReadOnlyDictionary<int, int> cancelQuantities,
        bool isFullCancel)
    {
        var detailIds = report.Details.Select(detail => detail.DetailId).ToList();
        var costLots = await dbContext.StockCostLots
            .Where(lot => detailIds.Contains(lot.ReceiveDetailId) && lot.Status == 1)
            .ToListAsync();

        foreach (var lot in costLots)
        {
            var cancelQty = cancelQuantities.GetValueOrDefault(lot.ReceiveDetailId);

            if (cancelQty <= 0)
            {
                continue;
            }

            if (isFullCancel && lot.RemainingQty != lot.OriginalQty)
            {
                return $"Cannot cancel receive document because product {lot.ProductId} has already been issued from this FIFO lot.";
            }

            if (lot.RemainingQty < cancelQty)
            {
                return $"Cannot cancel receive quantity for product {lot.ProductId} because FIFO remaining quantity is lower than cancel quantity.";
            }
        }

        var productIds = report.Details.Select(detail => detail.ProductId).Distinct().ToList();
        var balances = await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);
        var receiveQtyByProduct = report.Details
            .Where(detail => cancelQuantities.ContainsKey(detail.DetailId))
            .GroupBy(detail => detail.ProductId)
            .ToDictionary(group => group.Key, group => group.Sum(detail => cancelQuantities[detail.DetailId]));

        foreach (var (productId, receiveQty) in receiveQtyByProduct)
        {
            var currentQty = balances.TryGetValue(productId, out var balance) ? balance.Qty : 0;

            if (currentQty < receiveQty)
            {
                return $"Cannot cancel receive document because current stock for product {productId} is lower than received quantity.";
            }
        }

        return null;
    }

    private async Task ReverseStockBalances(StockHeader report, IReadOnlyDictionary<int, int> cancelQuantities)
    {
        var productIds = report.Details.Select(detail => detail.ProductId).Distinct().ToList();
        var balances = await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);

        foreach (var group in report.Details
            .Where(detail => cancelQuantities.ContainsKey(detail.DetailId))
            .GroupBy(detail => detail.ProductId))
        {
            if (!balances.TryGetValue(group.Key, out var balance))
            {
                throw new InvalidOperationException($"Cannot reverse receive stock for product {group.Key} because its stock balance was not found.");
            }

            var reverseQty = group.Sum(detail => cancelQuantities[detail.DetailId]);

            if (balance.Qty < reverseQty)
            {
                throw new InvalidOperationException($"Cannot reverse receive stock for product {group.Key} because the current balance is insufficient.");
            }

            balance.Qty -= reverseQty;
            balance.LastUpdate = DateTime.Now;
        }
    }

    private async Task CancelCostLots(StockHeader report, IReadOnlyDictionary<int, int> cancelQuantities, bool isFullCancel)
    {
        var detailIds = report.Details.Select(detail => detail.DetailId).ToList();
        var costLots = await dbContext.StockCostLots
            .Where(lot => detailIds.Contains(lot.ReceiveDetailId) && lot.Status == 1)
            .ToListAsync();

        foreach (var lot in costLots)
        {
            var cancelQty = cancelQuantities.GetValueOrDefault(lot.ReceiveDetailId);

            if (cancelQty <= 0)
            {
                continue;
            }

            if (isFullCancel || cancelQty >= lot.OriginalQty)
            {
                lot.RemainingQty = 0;
                lot.Status = StockCostLotCancelledStatus;
                continue;
            }

            lot.OriginalQty -= cancelQty;
            lot.RemainingQty -= cancelQty;
        }
    }

    private static (Dictionary<int, int> Quantities, bool IsFullCancel, string? Error) BuildCancelQuantities(
        StockHeader report,
        CancelStockDocumentDto request)
    {
        if (request.Items.Count > 0)
        {
            return ([], false, "Partial cancel is not supported. Please cancel the whole document and create a new one.");
        }

        return (
            report.Details.ToDictionary(detail => detail.DetailId, detail => detail.Qty),
            true,
            null);
    }

    private static string AppendCancelRemark(string currentRemark, string cancelRemark)
    {
        if (string.IsNullOrWhiteSpace(cancelRemark))
        {
            return currentRemark;
        }

        var nextRemark = cancelRemark.Trim();

        return nextRemark.Length <= 255 ? nextRemark : nextRemark[..255];
    }

    private async Task<Dictionary<string, Product>> GetProductsByStockHeaders(IReadOnlyList<StockHeader> reports)
    {
        var productIds = reports
            .SelectMany(report => report.Details)
            .Select(detail => detail.ProductId)
            .Distinct()
            .ToList();

        return await dbContext.Products
            .Where(product => productIds.Contains(product.ProductId))
            .ToDictionaryAsync(product => product.ProductId);
    }

    private async Task<Dictionary<string, StockBalance>> GetBalancesByStockHeaders(IReadOnlyList<StockHeader> reports)
    {
        var productIds = reports
            .SelectMany(report => report.Details)
            .Select(detail => detail.ProductId)
            .Distinct()
            .ToList();

        return await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);
    }

    private async Task<Dictionary<int, EmployeeReportInfo>> GetEmployeesByStockHeaders(IReadOnlyList<StockHeader> reports)
    {
        var employeeIds = reports
            .Select(report => int.TryParse(report.EmployeeId, out var employeeId) ? employeeId : 0)
            .Where(employeeId => employeeId > 0)
            .Distinct()
            .ToList();

        return await dbContext.Employees
            .Where(employee => employeeIds.Contains(employee.EmployeeId))
            .ToDictionaryAsync(
                employee => employee.EmployeeId,
                employee => new EmployeeReportInfo(
                    employee.EmployeeName ?? string.Empty,
                    string.IsNullOrWhiteSpace(employee.Department) ? "HR" : employee.Department));
    }

    private async Task<Dictionary<int, StockCostLot>> GetCostLotsByStockHeaders(IReadOnlyList<StockHeader> reports)
    {
        var detailIds = reports
            .SelectMany(report => report.Details)
            .Select(detail => detail.DetailId)
            .Distinct()
            .ToList();

        return await dbContext.StockCostLots
            .Where(lot => detailIds.Contains(lot.ReceiveDetailId))
            .ToDictionaryAsync(lot => lot.ReceiveDetailId);
    }

    private async Task<string?> ValidateMasterData(CreateStockIssueDto request)
    {
        if (!await dbContext.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId && employee.Status == 1))
        {
            return "Employee is not active or does not exist.";
        }

        if (request.Items.Any(item => item.SupplierId is null or <= 0))
        {
            return "Supplier is required for every stock receive item.";
        }

        var supplierIds = request.Items.Select(item => item.SupplierId!.Value).Distinct().ToList();
        var activeSupplierCount = await dbContext.Suppliers
            .CountAsync(supplier => supplierIds.Contains(supplier.SupplierId) && supplier.SupplierStatus == 1);

        if (activeSupplierCount != supplierIds.Count)
        {
            return "One or more selected suppliers are not active or do not exist.";
        }

        var productIds = request.Items.Select(item => item.Code.Trim()).Distinct().ToList();
        var products = await dbContext.Products
            .Where(product => productIds.Contains(product.ProductId))
            .ToDictionaryAsync(product => product.ProductId);

        foreach (var item in request.Items)
        {
            var productId = item.Code.Trim();
            var receiveUnit = string.IsNullOrWhiteSpace(item.ReceiveUnit) ? item.Unit.Trim() : item.ReceiveUnit.Trim();

            if (!products.TryGetValue(productId, out var product))
            {
                continue;
            }

            if (!string.Equals(product.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                return $"Product {productId} is not active.";
            }

            if (!string.Equals(product.ReceiveUnit.Trim(), receiveUnit, StringComparison.OrdinalIgnoreCase))
            {
                return $"Receive unit for product {productId} must be {product.ReceiveUnit}.";
            }

            if (!string.Equals(product.IssueUnit.Trim(), item.Unit.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return $"Issue unit for product {productId} must be {product.IssueUnit}.";
            }

        }

        return null;
    }

    private static string? ValidateRequest(CreateStockIssueDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return "Employee ID is required.";
        }

        if (request.Items.Count == 0)
        {
            return "At least one receive item is required.";
        }

        if (request.Items.Any(item => string.IsNullOrWhiteSpace(item.Code)
            || string.IsNullOrWhiteSpace(item.ProductName)
            || string.IsNullOrWhiteSpace(item.Unit)
            || item.Quantity <= 0
            || item.Quantity != Math.Truncate(item.Quantity)
            || item.ConversionQty <= 0))
        {
            return "Product code, product name, unit, positive whole-number quantity, and conversion quantity are required.";
        }

        if (request.Items.Any(item => TryParseCost(item.CostLot) <= 0))
        {
            return "Purchase cost is required for every receive item.";
        }

        return null;
    }

    private static decimal TryParseCost(string value)
    {
        return decimal.TryParse(value?.Trim(), out var cost) ? cost : 0;
    }

    private static StockIssueDto ToDto(
        StockHeader report,
        IReadOnlyDictionary<string, Product> products,
        IReadOnlyDictionary<string, StockBalance> balances,
        IReadOnlyDictionary<int, EmployeeReportInfo> employees,
        IReadOnlyDictionary<int, StockCostLot> costs,
        IReadOnlyDictionary<int, string> statusNames)
    {
        var details = report.Details
            .OrderBy(detail => detail.DetailId)
            .Select((detail, index) =>
            {
                products.TryGetValue(detail.ProductId, out var product);
                balances.TryGetValue(detail.ProductId, out var balance);
                costs.TryGetValue(detail.DetailId, out var costLot);

                return new StockIssueDetailDto
                {
                    Barcode = string.IsNullOrWhiteSpace(detail.Barcode) ? product?.Barcode ?? string.Empty : detail.Barcode,
                    Category = string.IsNullOrWhiteSpace(detail.Category) ? product?.CategoryName ?? string.Empty : detail.Category,
                    Code = detail.ProductId,
                    CostLot = detail.CostLot,
                    DetailId = detail.DetailId,
                    LineNo = index + 1,
                    MinQty = 0,
                    ProductName = string.IsNullOrWhiteSpace(detail.ProductName)
                        ? product?.ProductName ?? detail.ProductId
                        : detail.ProductName,
                    Quantity = detail.Qty,
                    ReceiveQuantity = detail.ReceiveQty,
                    ReceiveUnit = detail.ReceiveUnit,
                    StockQty = balance?.Qty ?? 0,
                    TotalCost = costLot is null ? 0 : detail.Qty * costLot.UnitCost,
                    UnitCost = costLot?.UnitCost ?? 0,
                    Unit = detail.Unit,
                };
            })
            .ToList();
        var parsedEmployeeId = int.TryParse(report.EmployeeId, out var employeeId) ? employeeId : 0;
        employees.TryGetValue(parsedEmployeeId, out var employee);

        return new StockIssueDto
        {
            HeaderId = report.HeaderId,
            CreatedAt = report.TransactionDate,
            Department = report.Remark,
            Division = report.Department,
            DocumentNo = string.IsNullOrWhiteSpace(report.ReceiveNo) ? report.HeaderId.ToString() : report.ReceiveNo,
            CancelNo = report.CancelNo,
            PoInvoiceNo = report.PoInvoiceNo,
            EmployeeId = parsedEmployeeId,
            EmployeeDepartment = employee?.Department ?? "HR",
            EmployeeName = employee?.Name ?? report.EmployeeId,
            Items = details,
            Status = StockHeaderStatuses.GetName(statusNames, report.Status),
            TotalItems = details.Count,
            TotalQty = details.Sum(detail => detail.Quantity),
        };
    }

    private async Task<int> GetDailyReceiveSequence(StockHeader header)
    {
        var documentDate = header.TransactionDate.Date;
        var nextDate = documentDate.AddDays(1);

        return await dbContext.StockHeaders
            .AsNoTracking()
            .Where(item => item.DocType == ReceiveDocType
                && item.TransactionDate >= documentDate
                && item.TransactionDate < nextDate
                && item.HeaderId <= header.HeaderId)
            .CountAsync();
    }

    private static string FormatReceiveNo(StockHeader header, int sequence)
    {
        return $"RC-{header.TransactionDate:yyMMdd}-{sequence.ToString("0000", CultureInfo.InvariantCulture)}";
    }

    private async Task<int> GetDailyCancelSequence(DateTime cancelledAt)
    {
        var prefix = $"CN-{cancelledAt:yyMMdd}-";
        return await dbContext.StockHeaders.CountAsync(item => item.CancelNo.StartsWith(prefix)) + 1;
    }

    private static string FormatCancelNo(DateTime cancelledAt, int sequence)
    {
        return $"CN-{cancelledAt:yyMMdd}-{sequence.ToString("0000", CultureInfo.InvariantCulture)}";
    }
}
