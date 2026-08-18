using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class ProductFavorite
{
    public int ProductFavoriteId { get; set; }

    public int EmployeeId { get; set; }

    [MaxLength(100)]
    public string ProductCode { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Mode { get; set; } = string.Empty;

    public DateTime CreatedDate { get; set; } = DateTime.Now;
}
