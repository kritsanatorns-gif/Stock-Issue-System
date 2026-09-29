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
    [HttpGet("stock-status-trend")]
    public async Task<IActionResult> GetStockStatusTrend([FromQuery] int year)
    {
        var months = Enumerable.Range(1, 12)
            .Select(month => new DateTime(year, month, 1).AddMonths(1))
            .ToList();
        var firstCutoff = months[0];

        var products = await (
            from product in dbContext.Products.AsNoTracking()
            join balance in dbContext.StockBalances.AsNoTracking().Where(row => row.LocationId == "MAIN")
                on product.ProductId equals balance.ProductId into balances
            from balance in balances.DefaultIfEmpty()
            select new { product.ProductId, product.MinQty, product.CreatedDate, CurrentQty = balance == null ? 0 : balance.Qty }
        ).ToListAsync();
        var movements = await (
            from detail in dbContext.StockDetails.AsNoTracking()
            join header in dbContext.StockHeaders.AsNoTracking() on detail.HeaderId equals header.HeaderId
            where header.TransactionDate >= firstCutoff
                && header.Status != StockHeaderStatuses.Cancelled
                && (header.DocType == "RECEIVE" || header.DocType == "ISSUE")
            select new { detail.ProductId, detail.Qty, header.DocType, header.TransactionDate }
        ).ToListAsync();

        return Ok(months.Select(cutoff =>
        {
            // A future month has no closing balance yet. Keep the month on the
            // chart axis, but return zero values so it renders without bars.
            if (cutoff.AddMonths(-1) > DateTime.Today)
            {
                return new
                {
                    periodStart = cutoff.AddMonths(-1),
                    productCount = 0,
                    available = 0,
                    low = 0,
                    outOfStock = 0,
                };
            }
            var future = movements.Where(row => row.TransactionDate >= cutoff)
                .GroupBy(row => row.ProductId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Sum(row => row.DocType == "ISSUE" ? row.Qty : -row.Qty));
            var productsAtPeriodEnd = products.Where(product => product.CreatedDate < cutoff).ToList();
            var statusCounts = productsAtPeriodEnd.Select(product =>
            {
                var qty = product.CurrentQty + (future.TryGetValue(product.ProductId, out var delta) ? delta : 0);
                return qty <= 0 ? "out" : product.MinQty > 0 && qty <= product.MinQty ? "low" : "available";
            }).GroupBy(status => status).ToDictionary(group => group.Key, group => group.Count());
            return new
            {
                periodStart = cutoff.AddMonths(-1),
                productCount = productsAtPeriodEnd.Count,
                available = statusCounts.GetValueOrDefault("available"),
                low = statusCounts.GetValueOrDefault("low"),
                outOfStock = statusCounts.GetValueOrDefault("out"),
            };
        }));
    }

    [HttpGet("purchases-by-product")]
    public async Task<IActionResult> GetPurchasesByProduct(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var endOfDay = endDate?.Date.AddDays(1);
        var lots = await (
            from lot in dbContext.StockCostLots.AsNoTracking()
            join detail in dbContext.StockDetails.AsNoTracking() on lot.ReceiveDetailId equals detail.DetailId
            join header in dbContext.StockHeaders.AsNoTracking() on lot.ReceiveHeaderId equals header.HeaderId
            where header.DocType == "RECEIVE" && header.Status != StockHeaderStatuses.Cancelled && lot.Status != 2
                && (!startDate.HasValue || header.TransactionDate >= startDate.Value.Date)
                && (!endOfDay.HasValue || header.TransactionDate < endOfDay.Value)
            select new { detail.ProductId, detail.ProductName, detail.Category, detail.Unit, lot.OriginalQty, lot.UnitCost, lot.VatAmount }
        ).ToListAsync();

        return Ok(lots.GroupBy(row => new { row.ProductId, row.ProductName, row.Category, row.Unit })
            .Select(group => new
            {
                productCode = group.Key.ProductId,
                productName = group.Key.ProductName,
                category = group.Key.Category,
                unit = group.Key.Unit,
                purchaseQty = group.Sum(row => row.OriginalQty),
                purchaseAmount = group.Sum(row => row.OriginalQty * row.UnitCost),
                totalVat = group.Sum(row => row.VatAmount),
            })
            .OrderBy(row => row.productName).ThenBy(row => row.productCode).ToList());
    }

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
            select new { lot.SupplierId, lot.SupplierName, lot.ReceiveHeaderId, lot.OriginalQty, lot.UnitCost, lot.VatAmount }
        ).ToListAsync();
        
        return Ok(lots.GroupBy(lot => new { lot.SupplierId, lot.SupplierName }).Select(group => new PurchaseBySupplierDto
        {
            SupplierId = group.Key.SupplierId,
            SupplierName = string.IsNullOrWhiteSpace(group.Key.SupplierName) ? "ไม่ระบุซัพพลาย" : group.Key.SupplierName,
            DocumentCount = group.Select(lot => lot.ReceiveHeaderId).Distinct().Count(),
            ItemCount = group.Count(),
            TotalQty = group.Sum(lot => lot.OriginalQty),
            TotalVat = group.Sum(lot => lot.VatAmount),
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
                TotalVat = lot.VatAmount,
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
            select new { header.TransactionDate, lot.OriginalQty, TotalPurchase = lot.OriginalQty * lot.UnitCost, TotalVat = lot.VatAmount }
        ).ToListAsync();

        var isDaily = string.Equals(period, "daily", StringComparison.OrdinalIgnoreCase);

        return Ok(purchases
            .GroupBy(row => isDaily
                ? row.TransactionDate.Date
                : new DateTime(row.TransactionDate.Year, row.TransactionDate.Month, 1))
            .Select(group => new PurchaseTrendDto
            {
                TotalQty = group.Sum(row => row.OriginalQty),
                PeriodStart = group.Key,
                TotalVat = group.Sum(row => row.TotalVat),
                TotalPurchase = group.Sum(row => row.TotalPurchase),
            })
            .OrderBy(row => row.PeriodStart)
            .ToList());
    }

}
