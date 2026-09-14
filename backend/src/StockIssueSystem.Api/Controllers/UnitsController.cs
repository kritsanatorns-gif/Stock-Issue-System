using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/units")]
public sealed class UnitsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetUnits() => Ok(await dbContext.InventoryUnits
        .AsNoTracking().OrderBy(unit => unit.UnitName)
        .Select(unit => new { unit.UnitId, unit.UnitName, unit.UnitStatus }).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> CreateUnit([FromBody] InventoryUnit request)
    {
        var name = request.UnitName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Unit name is required.");
        if (await dbContext.InventoryUnits.AnyAsync(unit => unit.UnitName == name)) return Conflict("Unit name already exists.");
        var unit = new InventoryUnit { UnitName = name, UnitStatus = request.UnitStatus == 2 ? 2 : 1 };
        dbContext.InventoryUnits.Add(unit);
        await dbContext.SaveChangesAsync();
        return Ok(new { unit.UnitId, unit.UnitName, unit.UnitStatus });
    }

    [HttpPut("{unitId:int}")]
    public async Task<IActionResult> UpdateUnit(int unitId, [FromBody] InventoryUnit request)
    {
        var unit = await dbContext.InventoryUnits.FindAsync(unitId);
        if (unit is null) return NotFound();
        var name = request.UnitName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Unit name is required.");
        if (await dbContext.InventoryUnits.AnyAsync(item => item.UnitId != unitId && item.UnitName == name)) return Conflict("Unit name already exists.");
        unit.UnitName = name;
        unit.UnitStatus = request.UnitStatus == 2 ? 2 : 1;
        await dbContext.SaveChangesAsync();
        return Ok(new { unit.UnitId, unit.UnitName, unit.UnitStatus });
    }
}
