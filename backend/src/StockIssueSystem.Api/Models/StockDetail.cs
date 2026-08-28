using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class StockDetail
{
    public int DetailId { get; set; }

    public int HeaderId { get; set; }

    [MaxLength(50)]
    public string ProductId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Barcode { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(50)]
    public string CostLot { get; set; } = string.Empty;

    [MaxLength(200)]
    public string ProductName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Remark { get; set; } = string.Empty;

    public int Qty { get; set; }

    public int? FulfilledQty { get; set; }

    // Links an ISSUE line back to its exact requisition line for safe reversals.
    public int? SourceRequisitionDetailId { get; set; }

    public decimal? ReceiveQty { get; set; }

    [MaxLength(20)]
    public string ReceiveUnit { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Unit { get; set; } = string.Empty;

    public StockHeader? Header { get; set; }
}
