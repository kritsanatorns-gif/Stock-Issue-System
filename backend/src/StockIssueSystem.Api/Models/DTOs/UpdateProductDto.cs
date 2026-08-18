namespace StockIssueSystem.Api.Models.DTOs;

public sealed class UpdateProductDto
{
    public string Barcode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = "General";
    public string ImageName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string ProductRemark { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
}
