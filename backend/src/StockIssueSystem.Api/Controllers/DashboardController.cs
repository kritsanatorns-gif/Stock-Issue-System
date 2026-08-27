using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(AppDbContext dbContext) : ControllerBase
{
    private const decimal DefaultLowStockThreshold = 10;
    private const string RequisitionDocType = "REQUISITION";

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);

        var requisitionTodayCount = await dbContext.StockHeaders
            .Where(header => header.DocType == RequisitionDocType
                && header.TransactionDate >= today
                && header.TransactionDate < tomorrow)
            .CountAsync();

        var stockRows = await dbContext.StockBalances
            .GroupJoin(
                dbContext.Products,
                balance => balance.ProductId,
                product => product.ProductId,
                (balance, products) => new
                {
                    Balance = balance,
                    Product = products.FirstOrDefault(),
                })
            .ToListAsync();

        var lowStockItems = stockRows
            // Each product can define its own reorder/low-stock point.  Fall back
            // to 10 only for older product records that do not yet have a value.
            .Where(row => row.Balance.Qty > 0
                && row.Balance.Qty <= (row.Product == null || row.Product.MinQty < 0
                    ? DefaultLowStockThreshold
                    : row.Product.MinQty))
            .OrderBy(row => row.Balance.Qty)
            .ThenBy(row => row.Balance.ProductId)
            .Select(row => new
            {
                row.Balance.ProductId,
                ProductName = row.Product?.ProductName ?? row.Balance.ProductId,
                Barcode = row.Product?.Barcode ?? string.Empty,
                Unit = row.Product?.IssueUnit ?? string.Empty,
                LocationId = row.Balance.LocationId,
                Qty = row.Balance.Qty,
                MinQty = row.Product == null || row.Product.MinQty < 0
                    ? DefaultLowStockThreshold
                    : row.Product.MinQty,
                Status = "ใกล้หมด",
                LastUpdate = row.Balance.LastUpdate,
            })
            .ToList();

        var outOfStockItems = stockRows
            .Where(row => row.Balance.Qty <= 0)
            .OrderBy(row => row.Balance.ProductId)
            .Select(row => new
            {
                row.Balance.ProductId,
                ProductName = row.Product?.ProductName ?? row.Balance.ProductId,
                Barcode = row.Product?.Barcode ?? string.Empty,
                Unit = row.Product?.IssueUnit ?? string.Empty,
                LocationId = row.Balance.LocationId,
                Qty = row.Balance.Qty,
                MinQty = row.Product == null || row.Product.MinQty < 0
                    ? DefaultLowStockThreshold
                    : row.Product.MinQty,
                Status = "สินค้าหมด",
                LastUpdate = row.Balance.LastUpdate,
            })
            .ToList();

        return Ok(new
        {
            IssueTodayQty = requisitionTodayCount,
            LowStockCount = lowStockItems.Count,
            OutOfStockCount = outOfStockItems.Count,
            LowStockThreshold = DefaultLowStockThreshold,
            CriticalStockItems = outOfStockItems.Concat(lowStockItems).ToList(),
        });
    }
}
