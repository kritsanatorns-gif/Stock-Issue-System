using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Supplier
{
    public int SupplierId { get; set; }

    [MaxLength(50)]
    public string AccountId { get; set; } = string.Empty;

    [MaxLength(150)]
    public string ShortName { get; set; } = string.Empty;

    [MaxLength(250)]
    public string AccountName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(150)]
    public string SupplierName { get; set; } = string.Empty;

    public int SupplierStatus { get; set; } = 1;
    public DateTime CreatedDate { get; set; } = DateTime.Now;
}
