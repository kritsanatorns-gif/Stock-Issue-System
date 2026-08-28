namespace StockIssueSystem.Api.Models.DTOs;

public sealed class ApproveRequisitionDto
{
    public int EmployeeId { get; set; }
    public string Remark { get; set; } = string.Empty;
    public List<ApproveRequisitionItemDto> Items { get; set; } = [];
}

public sealed class ApproveRequisitionItemDto
{
    public int DetailId { get; set; }
    public int Quantity { get; set; }
    public string Remark { get; set; } = string.Empty;
}
