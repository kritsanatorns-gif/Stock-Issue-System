using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class StockHeader
{
    public int HeaderId { get; set; }

    [MaxLength(20)]
    public string DocType { get; set; } = string.Empty;

    [MaxLength(20)]
    public string EmployeeId { get; set; } = string.Empty;

    public DateTime TransactionDate { get; set; } = DateTime.Now;

    [MaxLength(50)]
    public string Department { get; set; } = string.Empty;

    [MaxLength(100)]
    public string RequesterName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string HrRemark { get; set; } = string.Empty;

    public bool IsUrgent { get; set; }

    [MaxLength(500)]
    public string UrgentRemark { get; set; } = string.Empty;

    [MaxLength(255)]
    public string Remark { get; set; } = string.Empty;

    public int Status { get; set; } = 1;

    // Links an ISSUE document back to the requisition it fulfills.
    public int? SourceRequisitionId { get; set; }

    public int? SupplierId { get; set; }

    [MaxLength(20)]
    public string CreateBy { get; set; } = string.Empty;

    public DateTime CreateDate { get; set; } = DateTime.Now;

    public List<StockDetail> Details { get; set; } = [];
}
