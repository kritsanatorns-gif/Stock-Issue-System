namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateCategoryDto
{
    public string CategoryName { get; set; } = string.Empty;
    public int CategoryStatus { get; set; } = 1;
}
