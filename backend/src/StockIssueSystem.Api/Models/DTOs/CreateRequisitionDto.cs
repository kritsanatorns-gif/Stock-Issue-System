namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateRequisitionDto
{
    public int EmployeeId { get; set; }
    public string Department { get; set; } = string.Empty;
    public string RequesterName { get; set; } = string.Empty;
    public bool IsUrgent { get; set; }
    public string UrgentRemark { get; set; } = string.Empty;
    public string Remark { get; set; } = string.Empty;
    public IReadOnlyList<CreateStockIssueDetailDto> Items { get; set; } = [];
}
