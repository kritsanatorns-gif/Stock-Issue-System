using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Supplier
{
    public int SupplierId { get; set; }

    [MaxLength(150)]
    public string SupplierName { get; set; } = string.Empty;

    public int SupplierStatus { get; set; } = 1;
    public DateTime CreatedDate { get; set; } = DateTime.Now;
}
