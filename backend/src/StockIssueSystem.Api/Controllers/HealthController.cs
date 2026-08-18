using Microsoft.AspNetCore.Mvc;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "Healthy",
            service = "Stock Issue System API",
            checkedAt = DateTime.UtcNow,
        });
    }
}
