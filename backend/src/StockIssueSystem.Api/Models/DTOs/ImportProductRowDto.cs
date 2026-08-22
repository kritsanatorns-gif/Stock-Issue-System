namespace StockIssueSystem.Api.Models.DTOs;

public sealed class ImportProductRowDto
{
    public string Barcode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = "General";
    public decimal ConversionQty { get; set; } = 1;
    public string IssueUnit { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string ProductRemark { get; set; } = string.Empty;
    public string ReceiveUnit { get; set; } = string.Empty;
    public decimal ReceiveQty { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public int StockQty { get; set; }
    public decimal UnitCost { get; set; }
}
