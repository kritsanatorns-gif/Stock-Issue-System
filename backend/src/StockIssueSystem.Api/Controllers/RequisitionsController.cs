using System.Data;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;
using StockIssueSystem.Api.Services;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/requisitions")]
public sealed class RequisitionsController(AppDbContext dbContext, FifoCostService fifoCostService) : ControllerBase
{
    private const string RequisitionDocType = "REQUISITION";
    private const string IssueDocType = "ISSUE";
    private const string MainLocationId = "MAIN";

    [HttpGet]
    public async Task<IActionResult> GetRequisitions([FromQuery] string? status)
    {
        var query = dbContext.StockHeaders
            .AsNoTracking()
            .Include(header => header.Details)
            .Where(header => header.DocType == RequisitionDocType);

        if (string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(header =>
                header.Status == RequisitionStatuses.Pending
                || header.Status == RequisitionStatuses.Backlog);
        }

        var reports = await query
            .OrderByDescending(header => header.IsUrgent)
            .ThenByDescending(header => header.TransactionDate)
            .ThenByDescending(header => header.HeaderId)
            .ToListAsync();

        var employeeIds = reports
            .Select(header => int.TryParse(header.EmployeeId, out var employeeId) ? employeeId : 0)
            .Where(employeeId => employeeId > 0)
            .Distinct()
            .ToList();
        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employeeIds.Contains(employee.EmployeeId))
            .ToDictionaryAsync(employee => employee.EmployeeId);
        var productIds = reports
            .SelectMany(header => header.Details.Select(detail => detail.ProductId))
            .Distinct()
            .ToList();
        var balances = await dbContext.StockBalances
            .AsNoTracking()
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);

        var requestNumbers = await GetDailyRequestSequences(reports);

        return Ok(reports.Select(header => ToRequisitionDto(header, employees, balances, requestNumbers[header.HeaderId])));
    }

    [HttpGet("{headerId:int}")]
    public async Task<IActionResult> GetRequisition(int headerId)
    {
        var report = await dbContext.StockHeaders
            .AsNoTracking()
            .Include(header => header.Details)
            .FirstOrDefaultAsync(header => header.HeaderId == headerId && header.DocType == RequisitionDocType);

        if (report is null)
        {
            return NotFound("Requisition not found.");
        }

        var employeeId = int.TryParse(report.EmployeeId, out var parsedEmployeeId) ? parsedEmployeeId : 0;
        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.EmployeeId == employeeId)
            .ToDictionaryAsync(employee => employee.EmployeeId);
        var productIds = report.Details.Select(detail => detail.ProductId).Distinct().ToList();
        var balances = await dbContext.StockBalances
            .AsNoTracking()
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);

        var requestSequence = await GetDailyRequestSequence(report);

        return Ok(ToRequisitionDto(report, employees, balances, requestSequence));
    }

    [HttpPost]
    public async Task<IActionResult> CreateRequisition(CreateRequisitionDto request)
    {
        var validationError = await ValidateRequisition(request);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var products = await GetProducts(request.Items);
        var requester = GetRequesterKey(request);
        var header = new StockHeader
        {
            CreateBy = requester,
            CreateDate = DateTime.Now,
            Department = request.Department.Trim(),
            DocType = RequisitionDocType,
            EmployeeId = requester,
            HrRemark = string.Empty,
            IsUrgent = request.IsUrgent,
            Remark = BuildRemark(request.Department, request.Remark, request.RequesterName),
            RequesterName = request.RequesterName.Trim(),
            Status = RequisitionStatuses.Pending,
            TransactionDate = DateTime.Now,
            UrgentRemark = request.IsUrgent ? request.UrgentRemark.Trim() : string.Empty,
        };

        foreach (var item in request.Items)
        {
            var productId = item.Code.Trim();
            products.TryGetValue(productId, out var product);

            header.Details.Add(new StockDetail
            {
                Barcode = string.IsNullOrWhiteSpace(item.Barcode) ? product?.Barcode ?? string.Empty : item.Barcode.Trim(),
                Category = string.IsNullOrWhiteSpace(item.Category) ? product?.CategoryName ?? "General" : item.Category.Trim(),
                CostLot = string.Empty,
                ProductId = productId,
                ProductName = string.IsNullOrWhiteSpace(item.ProductName) ? product?.ProductName ?? productId : item.ProductName.Trim(),
                Qty = Convert.ToInt32(item.Quantity),
                Unit = string.IsNullOrWhiteSpace(item.Unit) ? product?.IssueUnit ?? string.Empty : item.Unit.Trim(),
            });
        }

        dbContext.StockHeaders.Add(header);
        await dbContext.SaveChangesAsync();
        var requestSequence = await GetDailyRequestSequence(header);

        return CreatedAtAction(nameof(GetRequisition), new { headerId = header.HeaderId }, new
        {
            header.HeaderId,
            RequestNo = FormatRequestNo(header, requestSequence),
            Status = RequisitionStatuses.GetName(header.Status),
        });
    }

    [HttpPost("{headerId:int}/approve")]
    public async Task<IActionResult> ApproveRequisition(int headerId, ApproveRequisitionDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return BadRequest("Employee ID is required.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var requisition = await dbContext.StockHeaders
            .Include(header => header.Details)
            .FirstOrDefaultAsync(header => header.HeaderId == headerId && header.DocType == RequisitionDocType);

        if (requisition is null)
        {
            return NotFound("Requisition not found.");
        }

        if (requisition.Status != RequisitionStatuses.Pending && requisition.Status != RequisitionStatuses.Backlog)
        {
            return BadRequest("This request is not waiting for picking.");
        }

        if (request.Items.Count == 0)
        {
            return BadRequest("Issued quantities are required.");
        }

        var issueQuantities = BuildIssueQuantities(request.Items);

        if (issueQuantities.Count == 0 || issueQuantities.Values.Sum() <= 0)
        {
            return BadRequest("At least one issued quantity is required.");
        }

        var quantityError = ValidateIssueQuantities(requisition.Details, issueQuantities);

        if (quantityError is not null)
        {
            return BadRequest(quantityError);
        }

        var stockError = await ValidateStockAvailability(issueQuantities);

        if (stockError is not null)
        {
            return BadRequest(stockError);
        }

        var issueHeader = new StockHeader
        {
            CreateBy = request.EmployeeId.ToString(),
            CreateDate = DateTime.Now,
            Department = GetRequisitionDepartment(requisition),
            DocType = IssueDocType,
            EmployeeId = request.EmployeeId.ToString(),
            Remark = GetRequisitionDepartment(requisition),
            SourceRequisitionId = requisition.HeaderId,
            Status = StockHeaderStatuses.Completed,
            TransactionDate = DateTime.Now,
        };

        foreach (var detail in requisition.Details)
        {
            var issuedQty = issueQuantities.GetValueOrDefault(detail.DetailId);

            if (issuedQty <= 0)
            {
                continue;
            }

            issueHeader.Details.Add(new StockDetail
            {
                Barcode = detail.Barcode,
                Category = detail.Category,
                CostLot = detail.CostLot,
                ProductId = detail.ProductId,
                ProductName = detail.ProductName,
                Qty = issuedQty,
                SourceRequisitionDetailId = detail.DetailId,
                Unit = detail.Unit,
            });

            RequisitionProgress.RecordIssue(detail, issuedQty);
        }

        var fifoValidationError = await fifoCostService.ValidateAvailabilityAsync(
            issueHeader.Details.Select(detail => new FifoIssueLine(detail, detail.Qty)));

        if (fifoValidationError is not null)
        {
            return Conflict(fifoValidationError);
        }

        dbContext.StockHeaders.Add(issueHeader);
        await UpdateStockBalances(issueHeader.Details);

        RequisitionProgress.SyncStatus(requisition);
        var isCompleted = requisition.Status == RequisitionStatuses.Approved;
        requisition.HrRemark = AppendHrRemark(
            requisition.HrRemark,
            isCompleted ? $"Completed by {request.EmployeeId}" : $"Partial issue by {request.EmployeeId}",
            request.Remark);

        await dbContext.SaveChangesAsync();
        var fifoError = await fifoCostService.AllocateAsync(
            issueHeader.Details.Select(detail => new FifoIssueLine(detail, detail.Qty)));

        if (fifoError is not null)
        {
            return Conflict(fifoError);
        }

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new
        {
            requisition.HeaderId,
            IssueHeaderId = issueHeader.HeaderId,
            Status = RequisitionStatuses.GetName(requisition.Status),
        });
    }

    [HttpPost("{headerId:int}/reject")]
    public async Task<IActionResult> RejectRequisition(int headerId, RejectRequisitionDto request)
    {
        return await KeepRequisitionBacklog(headerId, request);
    }

    [HttpPost("{headerId:int}/backlog")]
    public async Task<IActionResult> KeepRequisitionBacklog(int headerId, RejectRequisitionDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return BadRequest("Employee ID is required.");
        }

        var requisition = await dbContext.StockHeaders
            .FirstOrDefaultAsync(header => header.HeaderId == headerId && header.DocType == RequisitionDocType);

        if (requisition is null)
        {
            return NotFound("Requisition not found.");
        }

        if (requisition.Status != RequisitionStatuses.Pending && requisition.Status != RequisitionStatuses.Backlog)
        {
            return BadRequest("This request is not waiting for picking.");
        }

        requisition.Status = RequisitionStatuses.Backlog;
        requisition.HrRemark = AppendHrRemark(requisition.HrRemark, $"Backlog by {request.EmployeeId}", request.Remark);
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            requisition.HeaderId,
            Status = RequisitionStatuses.GetName(requisition.Status),
        });
    }

    [HttpPost("{headerId:int}/deny")]
    public async Task<IActionResult> DenyRequisition(int headerId, RejectRequisitionDto request)
    {
        if (request.EmployeeId <= 0)
        {
            return BadRequest("Employee ID is required.");
        }

        var requisition = await dbContext.StockHeaders
            .FirstOrDefaultAsync(header => header.HeaderId == headerId && header.DocType == RequisitionDocType);

        if (requisition is null)
        {
            return NotFound("Requisition not found.");
        }

        if (requisition.Status != RequisitionStatuses.Pending && requisition.Status != RequisitionStatuses.Backlog)
        {
            return BadRequest("This request is not waiting for picking.");
        }

        requisition.Status = RequisitionStatuses.Rejected;
        requisition.HrRemark = AppendHrRemark(requisition.HrRemark, $"Denied by {request.EmployeeId}", request.Remark);
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            requisition.HeaderId,
            Status = RequisitionStatuses.GetName(requisition.Status),
        });
    }

    private async Task<string?> ValidateRequisition(CreateRequisitionDto request)
    {
        if (request.EmployeeId <= 0 && string.IsNullOrWhiteSpace(request.RequesterName))
        {
            return "Requester name is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Department))
        {
            return "Department is required.";
        }

        if (request.Items.Count == 0)
        {
            return "At least one item is required.";
        }

        if (request.IsUrgent && string.IsNullOrWhiteSpace(request.UrgentRemark))
        {
            return "Urgent reason is required.";
        }

        if (request.EmployeeId > 0 && !await dbContext.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId && employee.Status == 1))
        {
            return "Employee is not active or does not exist.";
        }

        var products = await GetProducts(request.Items);

        var duplicateProduct = request.Items
            .GroupBy(item => item.Code?.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => !string.IsNullOrWhiteSpace(group.Key) && group.Count() > 1);

        if (duplicateProduct is not null)
        {
            return $"Product {duplicateProduct.Key} is duplicated in this requisition.";
        }

        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.Code) || item.Quantity <= 0 || item.Quantity != Math.Truncate(item.Quantity))
            {
                return "Product code and positive whole-number quantity are required.";
            }

            if (!products.TryGetValue(item.Code.Trim(), out var product))
            {
                return $"Product {item.Code} does not exist.";
            }

            if (!string.Equals(product.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                return $"Product {item.Code} is not active.";
            }
        }

        return null;
    }

    private async Task<Dictionary<string, Product>> GetProducts(IReadOnlyList<CreateStockIssueDetailDto> items)
    {
        var productIds = items.Select(item => item.Code.Trim()).Distinct().ToList();

        return await dbContext.Products
            .Where(product => productIds.Contains(product.ProductId))
            .ToDictionaryAsync(product => product.ProductId);
    }

    private static Dictionary<int, int> BuildIssueQuantities(IReadOnlyList<ApproveRequisitionItemDto> requestItems)
    {
        return requestItems
            .GroupBy(item => item.DetailId)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
    }

    private static string? ValidateIssueQuantities(
        IEnumerable<StockDetail> details,
        IReadOnlyDictionary<int, int> issueQuantities)
    {
        var detailById = details.ToDictionary(detail => detail.DetailId);

        foreach (var (detailId, issueQty) in issueQuantities)
        {
            if (!detailById.TryGetValue(detailId, out var detail))
            {
                return $"Request item {detailId} does not exist.";
            }

            var remainingQty = RequisitionProgress.GetBacklogQty(detail);

            if (issueQty < 0)
            {
                return $"Issued quantity for product {detail.ProductId} cannot be negative.";
            }

            if (issueQty > remainingQty)
            {
                return $"Issued quantity for product {detail.ProductId} is more than remaining request. Remaining: {remainingQty}.";
            }
        }

        return null;
    }

    private async Task<string?> ValidateStockAvailability(IReadOnlyDictionary<int, int> issueQuantities)
    {
        var details = await dbContext.StockDetails
            .Where(detail => issueQuantities.Keys.Contains(detail.DetailId))
            .ToListAsync();
        var requestedQtyByProduct = details
            .GroupBy(detail => detail.ProductId)
            .ToDictionary(group => group.Key, group => group.Sum(detail => issueQuantities[detail.DetailId]));
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

    private async Task UpdateStockBalances(IEnumerable<StockDetail> details)
    {
        var productIds = details.Select(detail => detail.ProductId).Distinct().ToList();
        var balances = await dbContext.StockBalances
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .ToDictionaryAsync(balance => balance.ProductId);

        foreach (var detail in details)
        {
            if (!balances.TryGetValue(detail.ProductId, out var balance))
            {
                throw new InvalidOperationException($"Stock balance was not found for product {detail.ProductId}.");
            }

            if (balance.Qty < detail.Qty)
            {
                throw new InvalidOperationException($"Stock is not enough for product {detail.ProductId}.");
            }

            balance.Qty -= detail.Qty;
            balance.LastUpdate = DateTime.Now;
        }
    }

    private static object ToRequisitionDto(
        StockHeader header,
        IReadOnlyDictionary<int, Employee> employees,
        IReadOnlyDictionary<string, StockBalance> balances,
        int requestSequence)
    {
        var employeeId = int.TryParse(header.EmployeeId, out var parsedEmployeeId) ? parsedEmployeeId : 0;
        employees.TryGetValue(employeeId, out var employee);
        var department = GetRequisitionDepartment(header);
        var requesterName = GetRequisitionRequester(header);
        var hrRemark = GetHrRemark(header);
        var userRemark = ExtractUserRemark(header.Remark);

        return new
        {
            header.HeaderId,
            RequestNo = FormatRequestNo(header, requestSequence),
            CreatedAt = header.TransactionDate,
            Department = department,
            EmployeeId = employeeId,
            EmployeeName = employee?.EmployeeName ?? requesterName ?? header.EmployeeId,
            HrRemark = hrRemark,
            IsUrgent = header.IsUrgent,
            Remark = hrRemark,
            Status = RequisitionStatuses.GetName(header.Status),
            StatusId = header.Status,
            TotalItems = header.Details.Count,
            TotalQty = header.Details.Sum(RequisitionProgress.GetBacklogQty),
            TotalRequestedQty = header.Details.Sum(RequisitionProgress.GetRequestedQty),
            TotalFulfilledQty = header.Details.Sum(RequisitionProgress.GetFulfilledQty),
            TotalBacklogQty = header.Details.Sum(RequisitionProgress.GetBacklogQty),
            UrgentRemark = header.UrgentRemark,
            UserRemark = userRemark,
            Items = header.Details.OrderBy(detail => detail.DetailId).Select((detail, index) => new
            {
                detail.DetailId,
                LineNo = index + 1,
                Code = detail.ProductId,
                detail.Barcode,
                detail.ProductName,
                detail.Category,
                Quantity = detail.Qty,
                FulfilledQty = RequisitionProgress.GetFulfilledQty(detail),
                BacklogQty = RequisitionProgress.GetBacklogQty(detail),
                AvailableQty = balances.TryGetValue(detail.ProductId, out var balance) ? balance.Qty : 0,
                Unit = detail.Unit,
            }),
        };
    }

    private async Task<Dictionary<int, int>> GetDailyRequestSequences(IReadOnlyCollection<StockHeader> headers)
    {
        if (headers.Count == 0)
        {
            return [];
        }

        var firstDate = headers.Min(header => header.TransactionDate.Date);
        var lastDateExclusive = headers.Max(header => header.TransactionDate.Date).AddDays(1);
        var dailyHeaders = await dbContext.StockHeaders
            .AsNoTracking()
            .Where(header =>
                header.DocType == RequisitionDocType
                && header.TransactionDate >= firstDate
                && header.TransactionDate < lastDateExclusive)
            .Select(header => new { header.HeaderId, header.TransactionDate })
            .ToListAsync();

        var sequences = dailyHeaders
            .GroupBy(header => header.TransactionDate.Date)
            .SelectMany(group => group
                .OrderBy(header => header.HeaderId)
                .Select((header, index) => new { header.HeaderId, Sequence = index + 1 }))
            .ToDictionary(item => item.HeaderId, item => item.Sequence);

        return headers.ToDictionary(
            header => header.HeaderId,
            header => sequences.TryGetValue(header.HeaderId, out var sequence) ? sequence : 1);
    }

    private async Task<int> GetDailyRequestSequence(StockHeader header)
    {
        var documentDate = header.TransactionDate.Date;
        var nextDate = documentDate.AddDays(1);

        return await dbContext.StockHeaders
            .AsNoTracking()
            .Where(item =>
                item.DocType == RequisitionDocType
                && item.TransactionDate >= documentDate
                && item.TransactionDate < nextDate
                && item.HeaderId <= header.HeaderId)
            .CountAsync();
    }

    private static string FormatRequestNo(StockHeader header, int sequence)
    {
        var datePart = header.TransactionDate.ToString("yyMMdd", CultureInfo.InvariantCulture);
        var sequencePart = sequence.ToString("0000", CultureInfo.InvariantCulture);
        return $"RQ-{datePart}-{sequencePart}";
    }

    private static string BuildRemark(string department, string remark, string requesterName)
    {
        var safeDepartment = department.Trim();
        var safeRemark = remark.Trim();
        var safeRequesterName = requesterName.Trim();
        var parts = new List<string> { $"Department: {safeDepartment}" };

        if (!string.IsNullOrWhiteSpace(safeRequesterName))
        {
            parts.Add($"Requester: {safeRequesterName}");
        }

        if (!string.IsNullOrWhiteSpace(safeRemark))
        {
            parts.Add($"Remark: {safeRemark}");
        }

        return string.Join(" | ", parts);
    }

    private static string GetRequesterKey(CreateRequisitionDto request)
    {
        return request.EmployeeId > 0
            ? request.EmployeeId.ToString()
            : request.RequesterName.Trim()[..Math.Min(request.RequesterName.Trim().Length, 20)];
    }

    private static string ExtractDepartment(string remark)
    {
        const string prefix = "Department:";
        var parts = remark.Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var departmentPart = parts.FirstOrDefault(part => part.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

        return departmentPart is null ? remark : departmentPart[prefix.Length..].Trim();
    }

    private static string ExtractUserRemark(string remark)
    {
        const string prefix = "Remark:";
        var parts = remark.Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var remarkPart = parts.FirstOrDefault(part => part.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

        return remarkPart is null ? string.Empty : remarkPart[prefix.Length..].Trim();
    }

    private static string ExtractDisplayRemark(string remark)
    {
        var parts = remark.Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var displayParts = new List<string>();

        foreach (var part in parts)
        {
            if (part.StartsWith("Department:", StringComparison.OrdinalIgnoreCase)
                || part.StartsWith("Requester:", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (part.StartsWith("Remark:", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            displayParts.Add(ToDisplayWorkflowRemark(part));
        }

        return string.Join(" | ", displayParts.Where(item => !string.IsNullOrWhiteSpace(item)));
    }

    private static string ToDisplayWorkflowRemark(string remarkPart)
    {
        var colonIndex = remarkPart.IndexOf(':');
        var action = colonIndex >= 0 ? remarkPart[..colonIndex].Trim() : remarkPart.Trim();
        var note = colonIndex >= 0 ? remarkPart[(colonIndex + 1)..].Trim() : string.Empty;
        var label = action switch
        {
            var value when value.StartsWith("Completed by", StringComparison.OrdinalIgnoreCase) => "ได้ของครบ",
            var value when value.StartsWith("Partial issue by", StringComparison.OrdinalIgnoreCase) => "จ่ายบางส่วน",
            var value when value.StartsWith("Backlog by", StringComparison.OrdinalIgnoreCase) => "ค้าง",
            var value when value.StartsWith("Denied by", StringComparison.OrdinalIgnoreCase) => "ไม่ให้เบิก",
            _ => action,
        };

        return string.IsNullOrWhiteSpace(note) ? string.Empty : note;
    }

    private static string? ExtractRequester(string remark)
    {
        const string prefix = "Requester:";
        var parts = remark.Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var requesterPart = parts.FirstOrDefault(part => part.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

        return requesterPart is null ? null : requesterPart[prefix.Length..].Trim();
    }

    private static string GetRequisitionDepartment(StockHeader header)
    {
        return string.IsNullOrWhiteSpace(header.Department)
            ? ExtractDepartment(header.Remark)
            : header.Department.Trim();
    }

    private static string? GetRequisitionRequester(StockHeader header)
    {
        return string.IsNullOrWhiteSpace(header.RequesterName)
            ? ExtractRequester(header.Remark)
            : header.RequesterName.Trim();
    }

    private static string GetHrRemark(StockHeader header)
    {
        return string.IsNullOrWhiteSpace(header.HrRemark)
            ? ExtractDisplayRemark(header.Remark)
            : ExtractDisplayRemark(header.HrRemark);
    }

    private static string AppendHrRemark(string currentRemark, string action, string remark)
    {
        if (string.IsNullOrWhiteSpace(remark))
        {
            return currentRemark;
        }

        var label = action switch
        {
            var value when value.StartsWith("Completed by", StringComparison.OrdinalIgnoreCase) => "ได้ของครบ",
            var value when value.StartsWith("Partial issue by", StringComparison.OrdinalIgnoreCase) => "จ่ายบางส่วน",
            var value when value.StartsWith("Backlog by", StringComparison.OrdinalIgnoreCase) => "ค้าง",
            var value when value.StartsWith("Denied by", StringComparison.OrdinalIgnoreCase) => "ไม่ให้เบิก",
            _ => action,
        };
        var entry = remark.Trim();
        var nextRemark = string.IsNullOrWhiteSpace(currentRemark)
            ? entry
            : $"{currentRemark} | {entry}";

        return nextRemark.Length <= 500 ? nextRemark : nextRemark[..500];
    }
}
