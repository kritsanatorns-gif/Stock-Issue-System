namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateStockIssueDetailDto
{
    public string Barcode { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string CostLot { get; set; } = string.Empty;
    public string ImageName { get; set; } = string.Empty;
    public int LineNo { get; set; }
    public decimal MinQty { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal ConversionQty { get; set; } = 1;
    public decimal Quantity { get; set; }
    public decimal? ReceiveQuantity { get; set; }
    public string ReceiveUnit { get; set; } = string.Empty;
    public decimal StockQty { get; set; }
    public string Unit { get; set; } = string.Empty;
}
