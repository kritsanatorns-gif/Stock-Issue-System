namespace StockIssueSystem.Api.Models.DTOs;

public sealed class ProductFavoriteDto
{
    public int ProductFavoriteId { get; set; }

    public int EmployeeId { get; set; }

    public string ProductCode { get; set; } = string.Empty;

    public string Mode { get; set; } = string.Empty;
}
