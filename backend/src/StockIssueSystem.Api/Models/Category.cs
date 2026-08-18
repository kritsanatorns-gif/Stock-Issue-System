using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Category
{
    public int CategoryId { get; set; }

    [MaxLength(100)]
    public string CategoryName { get; set; } = string.Empty;

    public int CategoryStatus { get; set; } = 1;
}
