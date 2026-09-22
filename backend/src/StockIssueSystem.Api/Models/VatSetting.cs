namespace StockIssueSystem.Api.Models;

public sealed class VatSetting
{
    public int VatSettingId { get; set; }
    public decimal VatRate { get; set; } = 7m;
    public DateTime EffectiveFrom { get; set; } = new(1900, 1, 1);
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
