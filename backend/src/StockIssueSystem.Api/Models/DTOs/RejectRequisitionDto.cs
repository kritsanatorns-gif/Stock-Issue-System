namespace StockIssueSystem.Api.Models.DTOs;

public sealed class RejectRequisitionDto
{
    public int EmployeeId { get; set; }
    public string Remark { get; set; } = string.Empty;
}
