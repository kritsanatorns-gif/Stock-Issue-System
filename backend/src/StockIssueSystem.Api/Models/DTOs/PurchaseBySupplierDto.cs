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

public sealed class SupplierPurchaseItemDto
{
    public DateTime ReceivedAt { get; set; }
    public int ReceiveHeaderId { get; set; }
    public string PoInvoiceNo { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TotalPurchase { get; set; }
    public string Unit { get; set; } = string.Empty;
}

public sealed class PurchaseTrendDto
{
    public DateTime PeriodStart { get; set; }
    public decimal TotalPurchase { get; set; }
}
