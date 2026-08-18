using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;
using System.Text.RegularExpressions;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/categories")]
public sealed class CategoryController(AppDbContext dbContext) : ControllerBase
{
    private static readonly Regex CategoryNamePattern = new(@"^[A-Za-z0-9\u0E00-\u0E7F\s._/-]+$", RegexOptions.Compiled);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories()
    {
        var categories = await dbContext.Categories
            .AsNoTracking()
            .OrderBy(category => category.CategoryName)
            .Select(category => new CategoryDto
            {
                CategoryId = category.CategoryId,
                CategoryName = category.CategoryName,
                CategoryStatus = category.CategoryStatus,
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{categoryId:int}")]
    public async Task<ActionResult<CategoryDto>> GetCategory(int categoryId)
    {
        var category = await dbContext.Categories
            .AsNoTracking()
            .Where(item => item.CategoryId == categoryId)
            .Select(item => new CategoryDto
            {
                CategoryId = item.CategoryId,
                CategoryName = item.CategoryName,
                CategoryStatus = item.CategoryStatus,
            })
            .FirstOrDefaultAsync();

        return category is null ? NotFound("Category not found.") : Ok(category);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> CreateCategory(CreateCategoryDto request)
    {
        var categoryName = request.CategoryName.Trim();

        if (string.IsNullOrWhiteSpace(categoryName))
        {
            return BadRequest("Category name is required.");
        }

        if (!CategoryNamePattern.IsMatch(categoryName))
        {
            return BadRequest("Category name contains invalid characters.");
        }

        var isDuplicate = await dbContext.Categories
            .AnyAsync(category => category.CategoryName == categoryName);

        if (isDuplicate)
        {
            return Conflict("Category name already exists.");
        }

        var category = new Category
        {
            CategoryName = categoryName,
            CategoryStatus = request.CategoryStatus == 2 ? 2 : 1,
        };

        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync();

        var response = new CategoryDto
        {
            CategoryId = category.CategoryId,
            CategoryName = category.CategoryName,
            CategoryStatus = category.CategoryStatus,
        };

        return CreatedAtAction(nameof(GetCategory), new { categoryId = category.CategoryId }, response);
    }

    [HttpPut("{categoryId:int}")]
    public async Task<ActionResult<CategoryDto>> UpdateCategory(int categoryId, UpdateCategoryDto request)
    {
        var categoryName = request.CategoryName.Trim();

        if (string.IsNullOrWhiteSpace(categoryName))
        {
            return BadRequest("Category name is required.");
        }

        if (!CategoryNamePattern.IsMatch(categoryName))
        {
            return BadRequest("Category name contains invalid characters.");
        }

        var category = await dbContext.Categories.FirstOrDefaultAsync(item => item.CategoryId == categoryId);

        if (category is null)
        {
            return NotFound("Category not found.");
        }

        var isDuplicate = await dbContext.Categories
            .AnyAsync(item => item.CategoryId != categoryId && item.CategoryName == categoryName);

        if (isDuplicate)
        {
            return Conflict("Category name already exists.");
        }

        category.CategoryName = categoryName;
        category.CategoryStatus = request.CategoryStatus == 2 ? 2 : 1;

        await dbContext.SaveChangesAsync();

        return Ok(new CategoryDto
        {
            CategoryId = category.CategoryId,
            CategoryName = category.CategoryName,
            CategoryStatus = category.CategoryStatus,
        });
    }
}
