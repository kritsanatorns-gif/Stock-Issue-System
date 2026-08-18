using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;

namespace StockIssueSystem.Api.Services;

public sealed record FifoIssueLine(StockDetail Detail, int Quantity);

/// <summary>
/// Owns the only path that can consume or restore FIFO cost lots.
/// A stock movement is rejected when its physical balance and FIFO lots disagree.
/// </summary>
public sealed class FifoCostService(AppDbContext dbContext)
{
    public async Task<string?> ValidateAvailabilityAsync(
        IEnumerable<FifoIssueLine> source,
        CancellationToken cancellationToken = default)
    {
        var requirements = source
            .Where(line => line.Quantity > 0)
            .GroupBy(line => line.Detail.ProductId)
            .Select(group => new { ProductId = group.Key, Quantity = group.Sum(line => line.Quantity) })
            .ToList();

        if (requirements.Count == 0)
        {
            return "ไม่พบจำนวนสินค้าที่ต้องตัดต้นทุน FIFO";
        }

        var productIds = requirements.Select(requirement => requirement.ProductId).ToList();
        var lots = await dbContext.StockCostLots
            .AsNoTracking()
            .Where(lot => productIds.Contains(lot.ProductId) && lot.Status == 1 && lot.RemainingQty > 0)
            .Select(lot => new { lot.ProductId, lot.RemainingQty })
            .ToListAsync(cancellationToken);

        var availableByProduct = lots
            .GroupBy(lot => lot.ProductId)
            .ToDictionary(group => group.Key, group => group.Sum(lot => lot.RemainingQty));

        foreach (var requirement in requirements)
        {
            var available = availableByProduct.GetValueOrDefault(requirement.ProductId);

            if (available < requirement.Quantity)
            {
                return $"ไม่สามารถตัดต้นทุน FIFO ของสินค้า {requirement.ProductId} ได้ เนื่องจากล็อตต้นทุนคงเหลือ {available} แต่ต้องใช้ {requirement.Quantity}. กรุณาตรวจสอบรายการรับเข้า/ปรับสต๊อกก่อนเบิกสินค้า";
            }
        }

        return null;
    }

    public async Task<string?> AllocateAsync(
        IEnumerable<FifoIssueLine> source,
        CancellationToken cancellationToken = default)
    {
        var lines = source.Where(line => line.Quantity > 0).ToList();
        var validationError = await ValidateAvailabilityAsync(lines, cancellationToken);

        if (validationError is not null)
        {
            return validationError;
        }

        foreach (var line in lines.OrderBy(line => line.Detail.DetailId))
        {
            var remainingQty = line.Quantity;
            var lots = await dbContext.StockCostLots
                .Where(lot => lot.ProductId == line.Detail.ProductId && lot.Status == 1 && lot.RemainingQty > 0)
                .OrderBy(lot => lot.CreatedDate)
                .ThenBy(lot => lot.CostLotId)
                .ToListAsync(cancellationToken);

            foreach (var lot in lots)
            {
                if (remainingQty == 0)
                {
                    break;
                }

                var usedQty = Math.Min(remainingQty, lot.RemainingQty);
                lot.RemainingQty -= usedQty;
                remainingQty -= usedQty;

                dbContext.StockIssueCosts.Add(new StockIssueCost
                {
                    CostLotId = lot.CostLotId,
                    IssueDetailId = line.Detail.DetailId,
                    Qty = usedQty,
                    UnitCost = lot.UnitCost,
                    TotalCost = Math.Round(usedQty * lot.UnitCost, 2, MidpointRounding.AwayFromZero),
                });
            }

            if (remainingQty != 0)
            {
                return $"ไม่สามารถตัดต้นทุน FIFO ของสินค้า {line.Detail.ProductId} ได้ครบถ้วน";
            }
        }

        return null;
    }

    public async Task<string?> ValidateRestoreAsync(
        IEnumerable<FifoIssueLine> source,
        CancellationToken cancellationToken = default)
    {
        var lines = source.Where(line => line.Quantity > 0).ToList();
        var detailIds = lines.Select(line => line.Detail.DetailId).Distinct().ToList();
        var issueCosts = await dbContext.StockIssueCosts
            .AsNoTracking()
            .Where(cost => detailIds.Contains(cost.IssueDetailId))
            .ToListAsync(cancellationToken);

        foreach (var line in lines)
        {
            var allocations = issueCosts.Where(cost => cost.IssueDetailId == line.Detail.DetailId).ToList();

            if (allocations.Count == 0 || allocations.Any(cost => cost.CostLotId <= 0) || allocations.Sum(cost => cost.Qty) < line.Quantity)
            {
                return $"ไม่สามารถถอยยอดสินค้า {line.Detail.ProductId} ได้อย่างปลอดภัย เพราะไม่พบข้อมูลล็อตต้นทุน FIFO ครบถ้วน";
            }
        }

        var lotIds = issueCosts.Select(cost => cost.CostLotId).Distinct().ToList();
        var existingLotCount = await dbContext.StockCostLots
            .CountAsync(lot => lotIds.Contains(lot.CostLotId), cancellationToken);

        return existingLotCount == lotIds.Count
            ? null
            : "ไม่สามารถถอยยอดได้ เพราะพบล็อตต้นทุน FIFO บางรายการหายไป";
    }

    public async Task<string?> RestoreAsync(
        IEnumerable<FifoIssueLine> source,
        CancellationToken cancellationToken = default)
    {
        var lines = source.Where(line => line.Quantity > 0).ToList();
        var validationError = await ValidateRestoreAsync(lines, cancellationToken);

        if (validationError is not null)
        {
            return validationError;
        }

        var detailIds = lines.Select(line => line.Detail.DetailId).Distinct().ToList();
        var issueCosts = await dbContext.StockIssueCosts
            .Where(cost => detailIds.Contains(cost.IssueDetailId))
            .OrderByDescending(cost => cost.IssueCostId)
            .ToListAsync(cancellationToken);
        var lotIds = issueCosts.Select(cost => cost.CostLotId).Distinct().ToList();
        var lots = await dbContext.StockCostLots
            .Where(lot => lotIds.Contains(lot.CostLotId))
            .ToDictionaryAsync(lot => lot.CostLotId, cancellationToken);

        foreach (var line in lines.OrderBy(line => line.Detail.DetailId))
        {
            var remainingQty = line.Quantity;

            foreach (var cost in issueCosts.Where(cost => cost.IssueDetailId == line.Detail.DetailId))
            {
                if (remainingQty == 0)
                {
                    break;
                }

                var restoredQty = Math.Min(remainingQty, cost.Qty);
                var lot = lots[cost.CostLotId];
                lot.RemainingQty = Math.Min(lot.OriginalQty, lot.RemainingQty + restoredQty);
                lot.Status = 1;
                remainingQty -= restoredQty;
            }
        }

        return null;
    }
}
