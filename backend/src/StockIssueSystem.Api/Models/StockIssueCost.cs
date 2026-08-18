namespace StockIssueSystem.Api.Models;

public sealed class StockIssueCost
{
    public int IssueCostId { get; set; }
    public int IssueDetailId { get; set; }
    public int CostLotId { get; set; }
    public int Qty { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TotalCost { get; set; }
}
