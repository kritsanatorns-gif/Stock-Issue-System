namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CategoryDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int CategoryStatus { get; set; }
}
