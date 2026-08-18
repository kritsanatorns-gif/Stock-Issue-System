namespace StockIssueSystem.Api.Models.DTOs;

public sealed class DepartmentDto
{
    public int DepartmentId { get; set; }
    public string DepartmentCode { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public int DepartmentStatus { get; set; }
}
