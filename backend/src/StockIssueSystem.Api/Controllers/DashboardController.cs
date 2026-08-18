using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(AppDbContext dbContext) : ControllerBase
{
    private const int LowStockThreshold = 10;
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
            .Where(row => row.Balance.Qty > 0 && row.Balance.Qty <= LowStockThreshold)
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
                MinQty = LowStockThreshold,
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
                MinQty = LowStockThreshold,
                Status = "สินค้าหมด",
                LastUpdate = row.Balance.LastUpdate,
            })
            .ToList();

        return Ok(new
        {
            IssueTodayQty = requisitionTodayCount,
            LowStockCount = lowStockItems.Count,
            OutOfStockCount = outOfStockItems.Count,
            LowStockThreshold,
            CriticalStockItems = outOfStockItems.Concat(lowStockItems).ToList(),
        });
    }
}
