namespace StockIssueSystem.Api.Models;

public sealed class StockCostLot
{
    public int CostLotId { get; set; }
    public string ProductId { get; set; } = string.Empty;
    public int ReceiveHeaderId { get; set; }
    public int ReceiveDetailId { get; set; }
    public decimal UnitCost { get; set; }
    public int OriginalQty { get; set; }
    public int RemainingQty { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.Now;
    public int Status { get; set; } = 1;
}
