namespace StockIssueSystem.Api.Models.DTOs;

public sealed class RejectRequisitionDto
{
    public int EmployeeId { get; set; }
    public string ItemRemark { get; set; } = string.Empty;
    public string Remark { get; set; } = string.Empty;
}
