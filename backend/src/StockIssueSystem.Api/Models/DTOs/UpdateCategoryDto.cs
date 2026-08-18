namespace StockIssueSystem.Api.Models.DTOs;

public sealed class UpdateCategoryDto
{
    public string CategoryName { get; set; } = string.Empty;
    public int CategoryStatus { get; set; } = 1;
}
