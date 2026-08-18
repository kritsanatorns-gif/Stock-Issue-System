using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class StockBalance
{
    public int BalanceId { get; set; }

    [MaxLength(50)]
    public string ProductId { get; set; } = string.Empty;

    [MaxLength(20)]
    public string LocationId { get; set; } = string.Empty;

    public int Qty { get; set; }

    public DateTime LastUpdate { get; set; } = DateTime.Now;
}
