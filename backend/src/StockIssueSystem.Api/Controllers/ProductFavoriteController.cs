using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/product-favorites")]
public sealed class ProductFavoriteController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductFavoriteDto>>> GetFavorites(
        [FromQuery] int employeeId,
        [FromQuery] string mode)
    {
        var normalizedMode = NormalizeMode(mode);

        if (employeeId <= 0 || normalizedMode is null)
        {
            return BadRequest("Employee ID and mode are required.");
        }

        var favorites = await dbContext.ProductFavorites
            .Where(favorite => favorite.EmployeeId == employeeId && favorite.Mode == normalizedMode)
            .OrderBy(favorite => favorite.ProductCode)
            .Select(favorite => new ProductFavoriteDto
            {
                ProductFavoriteId = favorite.ProductFavoriteId,
                EmployeeId = favorite.EmployeeId,
                ProductCode = favorite.ProductCode,
                Mode = favorite.Mode,
            })
            .ToListAsync();

        return Ok(favorites);
    }

    [HttpPut]
    public async Task<IActionResult> SaveFavorite(SaveProductFavoriteDto request)
    {
        var normalizedMode = NormalizeMode(request.Mode);
        var productCode = request.ProductCode.Trim();

        if (request.EmployeeId <= 0 || string.IsNullOrWhiteSpace(productCode) || normalizedMode is null)
        {
            return BadRequest("Employee ID, product code, and mode are required.");
        }

        var existingFavorite = await dbContext.ProductFavorites.FirstOrDefaultAsync(favorite =>
            favorite.EmployeeId == request.EmployeeId
            && favorite.ProductCode == productCode
            && favorite.Mode == normalizedMode);

        if (request.IsFavorite)
        {
            if (existingFavorite is null)
            {
                dbContext.ProductFavorites.Add(new ProductFavorite
                {
                    EmployeeId = request.EmployeeId,
                    ProductCode = productCode,
                    Mode = normalizedMode,
                });

                await dbContext.SaveChangesAsync();
            }

            return NoContent();
        }

        if (existingFavorite is not null)
        {
            dbContext.ProductFavorites.Remove(existingFavorite);
            await dbContext.SaveChangesAsync();
        }

        return NoContent();
    }

    private static string? NormalizeMode(string mode)
    {
        if (string.IsNullOrWhiteSpace(mode))
        {
            return null;
        }

        var normalizedMode = mode.Trim().ToLowerInvariant();

        return normalizedMode is "issue" or "receive" ? normalizedMode : null;
    }
}
