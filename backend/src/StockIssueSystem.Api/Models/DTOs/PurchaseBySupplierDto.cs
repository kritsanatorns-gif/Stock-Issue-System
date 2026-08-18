namespace StockIssueSystem.Api.Models.DTOs;

public sealed class PurchaseBySupplierDto
{
    public int? SupplierId { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public int DocumentCount { get; set; }
    public int ItemCount { get; set; }
    public int TotalQty { get; set; }
    public decimal TotalPurchase { get; set; }
}
