namespace StockIssueSystem.Api.Models.DTOs;

public sealed class StockIssueDto
{
    public int HeaderId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Department { get; set; } = string.Empty;
    public string Division { get; set; } = string.Empty;
    public string DocumentNo { get; set; } = string.Empty;
    public string CancelNo { get; set; } = string.Empty;
    public int? RequestHeaderId { get; set; }
    public string PoInvoiceNo { get; set; } = string.Empty;
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeeDepartment { get; set; } = string.Empty;
    public IReadOnlyList<StockIssueDetailDto> Items { get; set; } = [];
    public string Status { get; set; } = string.Empty;
    public int TotalItems { get; set; }
    public decimal TotalQty { get; set; }
}
