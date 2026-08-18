using Microsoft.AspNetCore.Mvc;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/uploads")]
public sealed class UploadController(IWebHostEnvironment environment) : ControllerBase
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    };

    [HttpPost("products")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UploadProductImage(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("Image file is required.");
        }

        var extension = Path.GetExtension(file.FileName);

        if (!AllowedExtensions.Contains(extension))
        {
            return BadRequest("Only JPG, PNG, and WEBP files are allowed.");
        }

        var uploadsRoot = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads", "products");

        Directory.CreateDirectory(uploadsRoot);

        var fileName = $"{DateTime.Now:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var filePath = Path.Combine(uploadsRoot, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/uploads/products/{fileName}";

        return Ok(new
        {
            FileName = fileName,
            Url = relativeUrl,
        });
    }
}
