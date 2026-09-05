namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateSupplierDto
{
    public string SupplierName { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}
