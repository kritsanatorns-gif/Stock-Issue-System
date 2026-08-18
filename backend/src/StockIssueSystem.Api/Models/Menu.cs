using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Menu
{
    public int MenuId { get; set; }

    [MaxLength(50)]
    public string MenuCode { get; set; } = string.Empty;

    [MaxLength(100)]
    public string MenuName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? MenuPath { get; set; }

    public int SortOrder { get; set; }

    public int IsActive { get; set; } = 1;
}
