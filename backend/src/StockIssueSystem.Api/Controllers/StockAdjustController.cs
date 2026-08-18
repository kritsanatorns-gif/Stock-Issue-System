using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;
using StockIssueSystem.Api.Services;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/stock-adjustments")]
public sealed class StockAdjustController(AppDbContext dbContext, FifoCostService fifoCostService) : ControllerBase
{
    private const string AdjustDocType = "ADJUST";
    private const string MainLocationId = "MAIN";

    private sealed record EmployeeReportInfo(string Name, string Department);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StockIssueDto>>> GetStockAdjustments(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var query = dbContext.StockHeaders
            .Include(header => header.Details)
            .Where(header => header.DocType == AdjustDocType)
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
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(reports.Select(report => ToDto(report, products, balances, employees, statusNames)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<StockIssueDto>> CreateStockAdjustment(CreateStockAdjustDto request)
    {
        var validationError = ValidateRequest(request);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var masterError = await ValidateMasterData(request);

        if (masterError is not null)
        {
            return BadRequest(masterError);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var productIds = request.Items.Select(item => item.Code.Trim()).Distinct().ToList();
        var products = await dbContext.Products
            .Where(product => productIds.Contains(product.ProductId))
            .ToDictionaryAsync(product => product.ProductId);
        var balances = await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);
        var details = new List<StockDetail>();

        foreach (var item in request.Items)
        {
            var productId = item.Code.Trim();
            var newQty = Convert.ToInt32(item.NewQty);
            products.TryGetValue(productId, out var product);
            var currentQty = balances.TryGetValue(productId, out var balance) ? balance.Qty : 0;
            var adjustQty = newQty - currentQty;

            details.Add(new StockDetail
            {
                Barcode = string.IsNullOrWhiteSpace(item.Barcode) ? product?.Barcode ?? string.Empty : item.Barcode.Trim(),
                Category = product?.CategoryName ?? string.Empty,
                CostLot = string.Empty,
                ProductId = productId,
                ProductName = string.IsNullOrWhiteSpace(item.ProductName) ? product?.ProductName ?? productId : item.ProductName.Trim(),
                Qty = adjustQty,
                Unit = string.IsNullOrWhiteSpace(item.Unit) ? product?.IssueUnit ?? string.Empty : item.Unit.Trim(),
            });

            if (balance is null)
            {
                balance = new StockBalance
                {
                    LastUpdate = DateTime.Now,
                    LocationId = MainLocationId,
                    ProductId = productId,
                    Qty = newQty,
                };
                dbContext.StockBalances.Add(balance);
                balances[productId] = balance;
                continue;
            }

            balance.Qty = newQty;
            balance.LastUpdate = DateTime.Now;
        }

        if (details.All(detail => detail.Qty == 0))
        {
            return BadRequest("Stock quantities have not changed.");
        }

        if (details.Any(detail => detail.Qty > 0))
        {
            return BadRequest("Stock adjustment cannot increase quantity because a FIFO cost lot is required. Please use stock receive instead.");
        }

        var fifoValidationError = await fifoCostService.ValidateAvailabilityAsync(
            details.Where(detail => detail.Qty < 0)
                .Select(detail => new FifoIssueLine(detail, -detail.Qty)));

        if (fifoValidationError is not null)
        {
            return Conflict(fifoValidationError);
        }

        var report = new StockHeader
        {
            CreateBy = request.EmployeeId.ToString(),
            CreateDate = DateTime.Now,
            Details = details,
            DocType = AdjustDocType,
            EmployeeId = request.EmployeeId.ToString(),
            Remark = request.Remark.Trim(),
            Status = StockHeaderStatuses.Completed,
            TransactionDate = request.CreatedAt ?? DateTime.Now,
        };

        dbContext.StockHeaders.Add(report);
        await dbContext.SaveChangesAsync();

        var fifoError = await fifoCostService.AllocateAsync(
            report.Details.Where(detail => detail.Qty < 0)
                .Select(detail => new FifoIssueLine(detail, -detail.Qty)));

        if (fifoError is not null)
        {
            return Conflict(fifoError);
        }

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        var savedBalances = await GetBalancesByStockHeaders([report]);
        var employees = await GetEmployeesByStockHeaders([report]);
        var statusNames = await StockHeaderStatuses.GetNames(dbContext);

        return Ok(ToDto(report, products, savedBalances, employees, statusNames));
    }

    private async Task<string?> ValidateMasterData(CreateStockAdjustDto request)
    {
        if (!await dbContext.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId && employee.Status == 1))
        {
            return "Employee is not active or does not exist.";
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

            if (!string.IsNullOrWhiteSpace(item.Unit)
                && !string.Equals(product.IssueUnit.Trim(), item.Unit.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return $"Adjust unit for product {productId} must be {product.IssueUnit}.";
            }
        }

        return null;
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

    private static string? ValidateRequest(CreateStockAdjustDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return "Employee ID is required.";
        }

        if (request.Items.Count == 0)
        {
            return "At least one adjustment item is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Remark))
        {
            return "Adjustment remark is required.";
        }

        if (request.Items.Any(item => string.IsNullOrWhiteSpace(item.Code)
            || item.NewQty < 0
            || item.NewQty != Math.Truncate(item.NewQty)))
        {
            return "Product code and non-negative whole-number stock quantity are required.";
        }

        return null;
    }

    private static StockIssueDto ToDto(
        StockHeader report,
        IReadOnlyDictionary<string, Product> products,
        IReadOnlyDictionary<string, StockBalance> balances,
        IReadOnlyDictionary<int, EmployeeReportInfo> employees,
        IReadOnlyDictionary<int, string> statusNames)
    {
        var details = report.Details
            .OrderBy(detail => detail.DetailId)
            .Select((detail, index) =>
            {
                products.TryGetValue(detail.ProductId, out var product);
                balances.TryGetValue(detail.ProductId, out var balance);

                return new StockIssueDetailDto
                {
                    Barcode = string.IsNullOrWhiteSpace(detail.Barcode) ? product?.Barcode ?? string.Empty : detail.Barcode,
                    Category = string.IsNullOrWhiteSpace(detail.Category) ? product?.CategoryName ?? string.Empty : detail.Category,
                    Code = detail.ProductId,
                    CostLot = detail.CostLot,
                    LineNo = index + 1,
                    MinQty = 0,
                    ProductName = string.IsNullOrWhiteSpace(detail.ProductName)
                        ? product?.ProductName ?? detail.ProductId
                        : detail.ProductName,
                    Quantity = detail.Qty,
                    ReceiveQuantity = detail.ReceiveQty,
                    ReceiveUnit = detail.ReceiveUnit,
                    StockQty = balance?.Qty ?? 0,
                    TotalCost = 0,
                    UnitCost = 0,
                    Unit = string.IsNullOrWhiteSpace(detail.Unit) ? product?.IssueUnit ?? string.Empty : detail.Unit,
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
