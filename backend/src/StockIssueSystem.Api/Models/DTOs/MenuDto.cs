namespace StockIssueSystem.Api.Models.DTOs;

public sealed class MenuDto
{
    public int MenuId { get; set; }

    public string MenuCode { get; set; } = string.Empty;

    public string MenuName { get; set; } = string.Empty;

    public string MenuPath { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
