namespace StockIssueSystem.Api.Models.DTOs;

public sealed class SupplierDto
{
    public int SupplierId { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int SupplierStatus { get; set; }
}
