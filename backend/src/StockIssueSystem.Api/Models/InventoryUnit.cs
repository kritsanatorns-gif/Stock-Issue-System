using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class InventoryUnit
{
    public int UnitId { get; set; }

    [MaxLength(50)]
    public string UnitName { get; set; } = string.Empty;

    public int UnitStatus { get; set; } = 1;
}
