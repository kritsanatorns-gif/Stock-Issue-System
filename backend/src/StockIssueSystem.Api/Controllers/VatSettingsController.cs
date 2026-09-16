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
    public async Task<IActionResult> Get()
    {
        var setting = await dbContext.VatSettings.AsNoTracking().FirstOrDefaultAsync(item => item.VatSettingId == 1);
        return Ok(new { vatRate = setting?.VatRate ?? 7m, updatedAt = setting?.UpdatedAt });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] VatSetting request)
    {
        if (request.VatRate < 0 || request.VatRate > 100 || decimal.Round(request.VatRate, 2) != request.VatRate)
            return BadRequest("VAT rate must be between 0 and 100 with at most two decimal places.");

        var setting = await dbContext.VatSettings.FirstOrDefaultAsync(item => item.VatSettingId == 1);
        if (setting is null)
        {
            setting = new VatSetting { VatSettingId = 1 };
            dbContext.VatSettings.Add(setting);
        }

        setting.VatRate = request.VatRate;
        setting.UpdatedAt = DateTime.Now;
        await dbContext.SaveChangesAsync();
        return Ok(new { vatRate = setting.VatRate, updatedAt = setting.UpdatedAt });
    }
}
