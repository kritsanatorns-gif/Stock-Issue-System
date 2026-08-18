using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Status
{
    public int StatusId { get; set; }

    [MaxLength(50)]
    public string? StatusName { get; set; }

    [MaxLength(10)]
    public string? StatusTable { get; set; }

    public int? StatusSortOrder { get; set; }

    public int? StatusIsActive { get; set; }
}
