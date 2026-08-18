namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateStockAdjustItemDto
{
    public string Barcode { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public decimal NewQty { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
}
