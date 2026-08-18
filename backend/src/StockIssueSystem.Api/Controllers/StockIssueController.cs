using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;
using StockIssueSystem.Api.Services;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/stock-issues")]
public sealed class StockIssueController(AppDbContext dbContext, FifoCostService fifoCostService) : ControllerBase
{
    private const string IssueDocType = "ISSUE";
    private const string RequisitionDocType = "REQUISITION";
    private const string MainLocationId = "MAIN";

    private sealed record EmployeeReportInfo(string Name, string Department);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StockIssueDto>>> GetStockIssues(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var query = dbContext.StockHeaders
            .Include(header => header.Details)
            .Where(header => header.DocType == IssueDocType)
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
        var costs = await GetIssueCostsByStockHeaders(reports);
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(reports.Select(report => ToDto(report, products, balances, employees, costs, statusNames)).ToList());
    }

    [HttpGet("{headerId:int}")]
    public async Task<ActionResult<StockIssueDto>> GetStockIssue(int headerId)
    {
        var report = await dbContext.StockHeaders
            .Include(header => header.Details)
            .FirstOrDefaultAsync(header => header.HeaderId == headerId && header.DocType == IssueDocType);

        if (report is null)
        {
            return NotFound("Stock issue document not found.");
        }

        var products = await GetProductsByStockHeaders([report]);
        var balances = await GetBalancesByStockHeaders([report]);
        var employees = await GetEmployeesByStockHeaders([report]);
        var costs = await GetIssueCostsByStockHeaders([report]);
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(ToDto(report, products, balances, employees, costs, statusNames));
    }

    [HttpPost]
    public async Task<ActionResult<StockIssueDto>> CreateStockIssue(CreateStockIssueDto request)
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

        var stockError = await ValidateStockAvailability(request);

        if (stockError is not null)
        {
            return BadRequest(stockError);
        }

        var details = request.Items.Select(item => new StockDetail
        {
            Barcode = item.Barcode.Trim(),
            Category = string.IsNullOrWhiteSpace(item.Category) ? "General" : item.Category.Trim(),
            CostLot = item.CostLot.Trim(),
            ProductId = item.Code.Trim(),
            ProductName = item.ProductName.Trim(),
            Qty = Convert.ToInt32(item.Quantity),
            Unit = item.Unit.Trim(),
        }).ToList();

        var fifoValidationError = await fifoCostService.ValidateAvailabilityAsync(
            details.Select(detail => new FifoIssueLine(detail, detail.Qty)));

        if (fifoValidationError is not null)
        {
            return Conflict(fifoValidationError);
        }

        var report = new StockHeader
        {
            CreateBy = request.EmployeeId.ToString(),
            CreateDate = DateTime.Now,
            Details = details,
            DocType = IssueDocType,
            EmployeeId = request.EmployeeId.ToString(),
            Remark = request.Department.Trim(),
            Status = StockHeaderStatuses.Completed,
            TransactionDate = request.CreatedAt ?? DateTime.Now,
        };

        dbContext.StockHeaders.Add(report);
        await UpdateStockBalances(request);
        await dbContext.SaveChangesAsync();

        var fifoError = await fifoCostService.AllocateAsync(
            report.Details.Select(detail => new FifoIssueLine(detail, detail.Qty)));

        if (fifoError is not null)
        {
            return Conflict(fifoError);
        }

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        var products = await GetProductsByStockHeaders([report]);
        var balances = await GetBalancesByStockHeaders([report]);
        var employees = await GetEmployeesByStockHeaders([report]);
        var costs = await GetIssueCostsByStockHeaders([report]);
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return CreatedAtAction(nameof(GetStockIssue), new
        {
            headerId = report.HeaderId,
        }, ToDto(report, products, balances, employees, costs, statusNames));
    }

    [HttpPost("{headerId:int}/cancel")]
    public async Task<ActionResult<StockIssueDto>> CancelStockIssue(int headerId, CancelStockDocumentDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return BadRequest("Employee ID is required.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var report = await dbContext.StockHeaders
            .Include(header => header.Details)
            .FirstOrDefaultAsync(header => header.HeaderId == headerId && header.DocType == IssueDocType);

        if (report is null)
        {
            return NotFound("Stock issue document not found.");
        }

        if (report.Status is StockHeaderStatuses.Cancelled or StockHeaderStatuses.PartiallyCancelled)
        {
            return BadRequest("Stock issue document is already cancelled.");
        }

        var (cancelQuantities, isFullCancel, quantityError) = BuildCancelQuantities(report, request);

        if (quantityError is not null)
        {
            return BadRequest(quantityError);
        }

        var restoreValidationError = await fifoCostService.ValidateRestoreAsync(
            report.Details.Select(detail => new FifoIssueLine(detail, cancelQuantities.GetValueOrDefault(detail.DetailId))));

        if (restoreValidationError is not null)
        {
            return Conflict(restoreValidationError);
        }

        await RestoreStockBalances(report, cancelQuantities);
        var restoreError = await fifoCostService.RestoreAsync(
            report.Details.Select(detail => new FifoIssueLine(detail, cancelQuantities.GetValueOrDefault(detail.DetailId))));

        if (restoreError is not null)
        {
            return Conflict(restoreError);
        }

        await RestoreRequisitionProgress(report.Details, cancelQuantities);

        report.Status = isFullCancel
            ? StockHeaderStatuses.Cancelled
            : StockHeaderStatuses.PartiallyCancelled;
        report.Remark = AppendCancelRemark(report.Remark, request.Remark);

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        var products = await GetProductsByStockHeaders([report]);
        var balances = await GetBalancesByStockHeaders([report]);
        var employees = await GetEmployeesByStockHeaders([report]);
        var costs = await GetIssueCostsByStockHeaders([report]);
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(ToDto(report, products, balances, employees, costs, statusNames));
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
            var issueQty = Convert.ToInt32(item.Quantity);

            if (balances.TryGetValue(productId, out var balance))
            {
                balance.Qty -= issueQty;
                balance.LastUpdate = DateTime.Now;
                continue;
            }

            throw new InvalidOperationException($"Stock balance for product {productId} does not exist.");
        }
    }

    private async Task RestoreStockBalances(StockHeader report, IReadOnlyDictionary<int, int> cancelQuantities)
    {
        var productIds = report.Details.Select(detail => detail.ProductId).Distinct().ToList();
        var balances = await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);

        foreach (var detail in report.Details)
        {
            var cancelQty = cancelQuantities.GetValueOrDefault(detail.DetailId);

            if (cancelQty <= 0)
            {
                continue;
            }

            if (balances.TryGetValue(detail.ProductId, out var balance))
            {
                balance.Qty += cancelQty;
                balance.LastUpdate = DateTime.Now;
                continue;
            }

            var newBalance = new StockBalance
            {
                LastUpdate = DateTime.Now,
                LocationId = MainLocationId,
                ProductId = detail.ProductId,
                Qty = cancelQty,
            };

            dbContext.StockBalances.Add(newBalance);
            balances[detail.ProductId] = newBalance;
        }
    }

    private async Task RestoreRequisitionProgress(
        IReadOnlyCollection<StockDetail> issueDetails,
        IReadOnlyDictionary<int, int> cancelQuantities)
    {
        var sourceDetailIds = issueDetails
            .Where(detail => detail.SourceRequisitionDetailId is not null
                && cancelQuantities.GetValueOrDefault(detail.DetailId) > 0)
            .Select(detail => detail.SourceRequisitionDetailId!.Value)
            .Distinct()
            .ToList();

        if (sourceDetailIds.Count == 0)
        {
            return;
        }

        var requisitionDetails = await dbContext.StockDetails
            .Include(detail => detail.Header)
                .ThenInclude(header => header!.Details)
            .Where(detail => sourceDetailIds.Contains(detail.DetailId)
                && detail.Header != null
                && detail.Header.DocType == RequisitionDocType)
            .ToListAsync();
        var sourceByDetailId = requisitionDetails.ToDictionary(detail => detail.DetailId);
        var affectedRequisitions = new Dictionary<int, StockHeader>();

        foreach (var issueDetail in issueDetails)
        {
            var cancelQty = cancelQuantities.GetValueOrDefault(issueDetail.DetailId);
            var sourceDetailId = issueDetail.SourceRequisitionDetailId;

            if (cancelQty <= 0 || sourceDetailId is null
                || !sourceByDetailId.TryGetValue(sourceDetailId.Value, out var sourceDetail)
                || sourceDetail.Header is null)
            {
                continue;
            }

            if (!RequisitionProgress.TryRollbackIssue(sourceDetail, cancelQty))
            {
                throw new InvalidOperationException(
                    $"Cannot restore requisition progress for product {issueDetail.ProductId}.");
            }

            affectedRequisitions[sourceDetail.Header.HeaderId] = sourceDetail.Header;
        }

        foreach (var requisition in affectedRequisitions.Values)
        {
            RequisitionProgress.SyncStatus(requisition);
        }
    }

    private async Task<string?> ValidateStockAvailability(CreateStockIssueDto request)
    {
        var requestedQtyByProduct = request.Items
            .GroupBy(item => item.Code.Trim())
            .ToDictionary(
                group => group.Key,
                group => group.Sum(item => Convert.ToInt32(item.Quantity)));
        var productIds = requestedQtyByProduct.Keys.ToList();
        var balances = await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);

        foreach (var (productId, requestedQty) in requestedQtyByProduct)
        {
            var currentQty = balances.TryGetValue(productId, out var balance) ? balance.Qty : 0;

            if (currentQty < requestedQty)
            {
                return $"Stock is not enough for product {productId}. Current stock: {currentQty}, requested: {requestedQty}.";
            }
        }

        return null;
    }

    private async Task<string?> ValidateMasterData(CreateStockIssueDto request)
    {
        if (!await dbContext.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId && employee.Status == 1))
        {
            return "Employee is not active or does not exist.";
        }

        if (string.IsNullOrWhiteSpace(request.Department))
        {
            return "Department is required.";
        }

        var productIds = request.Items.Select(item => item.Code.Trim()).Distinct().ToList();
        var products = await dbContext.Products
            .Where(product => productIds.Contains(product.ProductId))
            .ToDictionaryAsync(product => product.ProductId);

        foreach (var item in request.Items)
        {
            var productId = item.Code.Trim();

            if (!products.TryGetValue(productId, out var product))
            {
                return $"Product {productId} does not exist.";
            }

            if (!string.Equals(product.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                return $"Product {productId} is not active.";
            }

            if (!string.Equals(product.IssueUnit.Trim(), item.Unit.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return $"Issue unit for product {productId} must be {product.IssueUnit}.";
            }
        }

        return null;
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

        var nextRemark = string.IsNullOrWhiteSpace(currentRemark)
            ? $"Cancel: {cancelRemark.Trim()}"
            : $"{currentRemark} | Cancel: {cancelRemark.Trim()}";

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

    private async Task<Dictionary<int, List<StockIssueCost>>> GetIssueCostsByStockHeaders(IReadOnlyList<StockHeader> reports)
    {
        var detailIds = reports
            .SelectMany(report => report.Details)
            .Select(detail => detail.DetailId)
            .Distinct()
            .ToList();

        var costs = await dbContext.StockIssueCosts
            .Where(cost => detailIds.Contains(cost.IssueDetailId))
            .ToListAsync();

        return costs
            .GroupBy(cost => cost.IssueDetailId)
            .ToDictionary(group => group.Key, group => group.ToList());
    }

    private static string? ValidateRequest(CreateStockIssueDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return "Employee ID is required.";
        }

        if (string.IsNullOrWhiteSpace(request.EmployeeName))
        {
            return "Employee name is required.";
        }

        if (request.Items.Count == 0)
        {
            return "At least one stock issue item is required.";
        }

        if (request.Items.Any(item => string.IsNullOrWhiteSpace(item.Code)
            || string.IsNullOrWhiteSpace(item.ProductName)
            || string.IsNullOrWhiteSpace(item.Unit)
            || item.Quantity <= 0
            || item.Quantity != Math.Truncate(item.Quantity)))
        {
            return "Product code, product name, unit, and positive whole-number quantity are required.";
        }

        return null;
    }

    private static StockIssueDto ToDto(
        StockHeader report,
        IReadOnlyDictionary<string, Product> products,
        IReadOnlyDictionary<string, StockBalance> balances,
        IReadOnlyDictionary<int, EmployeeReportInfo> employees,
        IReadOnlyDictionary<int, List<StockIssueCost>> costs,
        IReadOnlyDictionary<int, string> statusNames)
    {
        var details = report.Details
            .OrderBy(detail => detail.DetailId)
            .Select((detail, index) =>
            {
                products.TryGetValue(detail.ProductId, out var product);
                balances.TryGetValue(detail.ProductId, out var balance);
                costs.TryGetValue(detail.DetailId, out var issueCosts);

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
                    TotalCost = issueCosts?.Sum(cost => cost.TotalCost) ?? 0,
                    UnitCost = issueCosts is { Count: > 0 }
                        ? Math.Round(issueCosts.Sum(cost => cost.TotalCost) / Math.Max(1, detail.Qty), 2)
                        : 0,
                    Unit = detail.Unit,
                };
            })
            .ToList();
        var parsedEmployeeId = int.TryParse(report.EmployeeId, out var employeeId) ? employeeId : 0;
        employees.TryGetValue(parsedEmployeeId, out var employee);

        return new StockIssueDto
        {
            CreatedAt = report.TransactionDate,
            Department = report.Remark,
            DocumentNo = report.HeaderId.ToString(),
            EmployeeId = parsedEmployeeId,
            EmployeeDepartment = employee?.Department ?? "HR",
            EmployeeName = employee?.Name ?? report.EmployeeId,
            Items = details,
            Status = StockHeaderStatuses.GetName(statusNames, report.Status),
            TotalItems = details.Count,
            TotalQty = details.Sum(detail => detail.Quantity),
        };
    }
}
