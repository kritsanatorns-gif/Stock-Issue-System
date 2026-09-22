using StockIssueSystem.Api.Models;

namespace StockIssueSystem.Api.Services;

public static class RequisitionProgress
{
    public static int GetRequestedQty(StockDetail detail) => Math.Max(0, detail.Qty);

    public static int GetFulfilledQty(StockDetail detail) => Math.Clamp(
        detail.FulfilledQty ?? 0,
        0,
        GetRequestedQty(detail));

    public static int GetDeniedQty(StockDetail detail) => Math.Clamp(
        detail.DeniedQty ?? 0,
        0,
        GetRequestedQty(detail) - GetFulfilledQty(detail));

    public static int GetBacklogQty(StockDetail detail) =>
        GetRequestedQty(detail) - GetFulfilledQty(detail) - GetDeniedQty(detail);

    public static void RecordDenial(StockDetail detail)
    {
        var remainingQty = GetBacklogQty(detail);
        if (remainingQty <= 0) throw new InvalidOperationException("This requisition item has no remaining quantity.");
        detail.DeniedQty = GetDeniedQty(detail) + remainingQty;
    }

    public static void RecordIssue(StockDetail detail, int quantity)
    {
        if (quantity <= 0 || quantity > GetBacklogQty(detail))
        {
            throw new InvalidOperationException("Issued quantity is outside the remaining requisition quantity.");
        }

        detail.FulfilledQty = GetFulfilledQty(detail) + quantity;
    }

    public static bool TryRollbackIssue(StockDetail detail, int quantity)
    {
        var fulfilledQty = GetFulfilledQty(detail);

        if (quantity <= 0 || quantity > fulfilledQty)
        {
            return false;
        }

        detail.FulfilledQty = fulfilledQty - quantity;
        return true;
    }

    public static void SyncStatus(StockHeader requisition)
    {
        if (requisition.Status == RequisitionStatuses.Rejected)
        {
            return;
        }

        if (requisition.Details.Count > 0 && requisition.Details.All(detail => GetBacklogQty(detail) == 0))
        {
            requisition.Status = requisition.Details.All(detail => GetFulfilledQty(detail) == 0)
                ? RequisitionStatuses.Rejected
                : RequisitionStatuses.Approved;
        }
        else if (requisition.Status != RequisitionStatuses.AwaitingApproval)
        {
            requisition.Status = RequisitionStatuses.Backlog;
        }
    }
}
