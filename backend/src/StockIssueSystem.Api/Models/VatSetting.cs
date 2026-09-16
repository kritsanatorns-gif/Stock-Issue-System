namespace StockIssueSystem.Api.Models;

public sealed class VatSetting
{
    public int VatSettingId { get; set; }
    public decimal VatRate { get; set; } = 7m;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
