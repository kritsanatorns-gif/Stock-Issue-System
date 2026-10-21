namespace StockIssueSystem.Api.Models.DTOs;

public sealed class PurchaseProductLotRow
{
    public string ProductId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public int OriginalQty { get; set; }
    public decimal UnitCost { get; set; }
    public decimal VatAmount { get; set; }
}
