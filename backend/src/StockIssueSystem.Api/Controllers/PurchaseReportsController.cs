using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/reports")]
public sealed class PurchaseReportsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("purchases-by-supplier")]
    public async Task<ActionResult<IReadOnlyList<PurchaseBySupplierDto>>> GetPurchasesBySupplier([FromQuery] int? year)
    {
        var headers = await dbContext.StockHeaders.AsNoTracking()
            .Where(header => header.DocType == "RECEIVE" && header.Status != StockHeaderStatuses.Cancelled
                && (!year.HasValue || header.TransactionDate.Year == year.Value))
            .Select(header => new { header.HeaderId, header.SupplierId }).ToListAsync();
        var headerIds = headers.Select(header => header.HeaderId).ToList();
        var lots = await dbContext.StockCostLots.AsNoTracking()
            .Where(lot => headerIds.Contains(lot.ReceiveHeaderId) && lot.Status != 2)
            .Select(lot => new { lot.ReceiveHeaderId, lot.OriginalQty, lot.UnitCost }).ToListAsync();
        var supplierNames = await dbContext.Suppliers.AsNoTracking()
            .ToDictionaryAsync(supplier => supplier.SupplierId, supplier => supplier.SupplierName);

        return Ok(headers.GroupBy(header => header.SupplierId).Select(group =>
        {
            var headerIdsBySupplier = group.Select(header => header.HeaderId).ToHashSet();
            var supplierLots = lots.Where(lot => headerIdsBySupplier.Contains(lot.ReceiveHeaderId)).ToList();
            return new PurchaseBySupplierDto
            {
                SupplierId = group.Key,
                SupplierName = group.Key.HasValue && supplierNames.TryGetValue(group.Key.Value, out var name) ? name : "ไม่ระบุผู้ขาย",
                DocumentCount = group.Count(),
                ItemCount = supplierLots.Count,
                TotalQty = supplierLots.Sum(lot => lot.OriginalQty),
                TotalPurchase = supplierLots.Sum(lot => lot.OriginalQty * lot.UnitCost),
            };
        }).OrderByDescending(row => row.TotalPurchase).ThenBy(row => row.SupplierName).ToList());
    }
}
