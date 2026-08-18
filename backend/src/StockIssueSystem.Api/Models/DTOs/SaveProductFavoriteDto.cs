namespace StockIssueSystem.Api.Models.DTOs;

public sealed class SaveProductFavoriteDto
{
    public int EmployeeId { get; set; }

    public string ProductCode { get; set; } = string.Empty;

    public string Mode { get; set; } = string.Empty;

    public bool IsFavorite { get; set; }
}
