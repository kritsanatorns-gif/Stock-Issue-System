using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Product
{
    public int Id { get; set; }

    [MaxLength(50)]
    public string ProductId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string ProductName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string CategoryName { get; set; } = "General";

    [MaxLength(20)]
    public string ReceiveUnit { get; set; } = string.Empty;

    [MaxLength(20)]
    public string IssueUnit { get; set; } = string.Empty;

    public decimal ConversionQty { get; set; } = 1;

    public decimal MinQty { get; set; } = 10;

    [MaxLength(100)]
    public string Barcode { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Img { get; set; } = string.Empty;

    [MaxLength(500)]
    public string ProductRemark { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Status { get; set; } = "Active";

    public DateTime CreatedDate { get; set; } = DateTime.Now;

    [MaxLength(20)]
    public string CreatedName { get; set; } = string.Empty;
}
