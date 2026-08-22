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
    public async Task<ActionResult<IReadOnlyList<PurchaseBySupplierDto>>> GetPurchasesBySupplier(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var endOfDay = endDate?.Date.AddDays(1);
        var lots = await (
            from lot in dbContext.StockCostLots.AsNoTracking()
            join header in dbContext.StockHeaders.AsNoTracking() on lot.ReceiveHeaderId equals header.HeaderId
            where header.DocType == "RECEIVE" && header.Status != StockHeaderStatuses.Cancelled
                && lot.Status != 2
                && lot.SupplierId.HasValue
                && (!year.HasValue || header.TransactionDate.Year == year.Value)
                && (!month.HasValue || header.TransactionDate.Month == month.Value)
                && (!startDate.HasValue || header.TransactionDate >= startDate.Value.Date)
                && (!endOfDay.HasValue || header.TransactionDate < endOfDay.Value)
            select new { lot.SupplierId, lot.SupplierName, lot.ReceiveHeaderId, lot.OriginalQty, lot.UnitCost }
        ).ToListAsync();
        
        return Ok(lots.GroupBy(lot => new { lot.SupplierId, lot.SupplierName }).Select(group => new PurchaseBySupplierDto
        {
            SupplierId = group.Key.SupplierId,
            SupplierName = string.IsNullOrWhiteSpace(group.Key.SupplierName) ? "ไม่ระบุผู้ขาย" : group.Key.SupplierName,
            DocumentCount = group.Select(lot => lot.ReceiveHeaderId).Distinct().Count(),
            ItemCount = group.Count(),
            TotalQty = group.Sum(lot => lot.OriginalQty),
            TotalPurchase = group.Sum(lot => lot.OriginalQty * lot.UnitCost),
        }).OrderByDescending(row => row.TotalPurchase).ThenBy(row => row.SupplierName).ToList());
    }

    [HttpGet("purchases-by-supplier/{supplierId:int}/items")]
    public async Task<ActionResult<IReadOnlyList<SupplierPurchaseItemDto>>> GetSupplierPurchaseItems(
        int supplierId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var endOfDay = endDate?.Date.AddDays(1);
        var items = await (
            from lot in dbContext.StockCostLots.AsNoTracking()
            join detail in dbContext.StockDetails.AsNoTracking() on lot.ReceiveDetailId equals detail.DetailId
            join header in dbContext.StockHeaders.AsNoTracking() on lot.ReceiveHeaderId equals header.HeaderId
            where lot.SupplierId == supplierId
                && lot.Status != 2
                && header.DocType == "RECEIVE"
                && header.Status != StockHeaderStatuses.Cancelled
                && (!year.HasValue || header.TransactionDate.Year == year.Value)
                && (!month.HasValue || header.TransactionDate.Month == month.Value)
                && (!startDate.HasValue || header.TransactionDate >= startDate.Value.Date)
                && (!endOfDay.HasValue || header.TransactionDate < endOfDay.Value)
            orderby header.TransactionDate descending, lot.CostLotId descending
            select new SupplierPurchaseItemDto
            {
                ReceivedAt = header.TransactionDate,
                ReceiveHeaderId = header.HeaderId,
                PoInvoiceNo = header.PoInvoiceNo,
                ProductCode = detail.ProductId,
                ProductName = detail.ProductName,
                Quantity = lot.OriginalQty,
                Unit = detail.Unit,
                UnitCost = lot.UnitCost,
                TotalPurchase = lot.OriginalQty * lot.UnitCost,
            }
        ).ToListAsync();

        return Ok(items);
    }

    [HttpGet("purchase-trend")]
    public async Task<ActionResult<IReadOnlyList<PurchaseTrendDto>>> GetPurchaseTrend(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? period = "monthly")
    {
        var endOfDay = endDate?.Date.AddDays(1);
        var purchases = await (
            from lot in dbContext.StockCostLots.AsNoTracking()
            join header in dbContext.StockHeaders.AsNoTracking() on lot.ReceiveHeaderId equals header.HeaderId
            where header.DocType == "RECEIVE" && header.Status != StockHeaderStatuses.Cancelled
                && lot.Status != 2
                && lot.SupplierId.HasValue
                && (!startDate.HasValue || header.TransactionDate >= startDate.Value.Date)
                && (!endOfDay.HasValue || header.TransactionDate < endOfDay.Value)
            select new { header.TransactionDate, TotalPurchase = lot.OriginalQty * lot.UnitCost }
        ).ToListAsync();

        var isDaily = string.Equals(period, "daily", StringComparison.OrdinalIgnoreCase);

        return Ok(purchases
            .GroupBy(row => isDaily
                ? row.TransactionDate.Date
                : new DateTime(row.TransactionDate.Year, row.TransactionDate.Month, 1))
            .Select(group => new PurchaseTrendDto
            {
                PeriodStart = group.Key,
                TotalPurchase = group.Sum(row => row.TotalPurchase),
            })
            .OrderBy(row => row.PeriodStart)
            .ToList());
    }

}
