namespace StockIssueSystem.Api.Models.DTOs;

// ผลลัพธ์หนึ่งล็อตจาก Stored Procedure เพื่อสรุปยอดซัพพลายด้วยกติกาเดิมของ API
public sealed class PurchaseSupplierLotRow
{
    public int? SupplierId { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public int ReceiveHeaderId { get; set; }
    public int OriginalQty { get; set; }
    public decimal UnitCost { get; set; }
    public decimal VatAmount { get; set; }
}
