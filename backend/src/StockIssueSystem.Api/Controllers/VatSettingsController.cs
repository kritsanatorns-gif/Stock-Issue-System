using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/vat-settings")]
public sealed class VatSettingsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateTime? date)
    {
        var target = (date ?? DateTime.Today).Date;
        var setting = await dbContext.VatSettings.AsNoTracking()
            .FirstOrDefaultAsync(item => item.EffectiveFrom == target);
        return Ok(new { vatRate = setting?.VatRate ?? 7m, effectiveFrom = setting?.EffectiveFrom, updatedAt = setting?.UpdatedAt });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] VatSetting request)
    {
        if (request.VatRate < 0 || request.VatRate > 100 || decimal.Round(request.VatRate, 2) != request.VatRate)
            return BadRequest("VAT rate must be between 0 and 100 with at most two decimal places.");

        if (request.EffectiveFrom.Year < 2000 || request.EffectiveFrom.Day != 1 || request.EffectiveFrom.TimeOfDay != TimeSpan.Zero)
            return BadRequest("EffectiveFrom must be the first day of the report month.");
        await using var transaction = await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var setting = await dbContext.VatSettings.FirstOrDefaultAsync(item => item.EffectiveFrom == request.EffectiveFrom);
        if (setting is null)
        {
            setting = new VatSetting { VatSettingId = await dbContext.VatSettings.MaxAsync(item => item.VatSettingId) + 1, EffectiveFrom = request.EffectiveFrom };
            dbContext.VatSettings.Add(setting);
        }

        setting.VatRate = request.VatRate;
        setting.UpdatedAt = DateTime.Now;
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { vatRate = setting.VatRate, effectiveFrom = setting.EffectiveFrom, updatedAt = setting.UpdatedAt });
    }
}
