namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateStockIssueDto
{
    public DateTime? CreatedAt { get; set; }
    public string Department { get; set; } = string.Empty;
    public string DocumentNo { get; set; } = string.Empty;
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public int? SupplierId { get; set; }
    public IReadOnlyList<CreateStockIssueDetailDto> Items { get; set; } = [];
}
