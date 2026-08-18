namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateDepartmentDto
{
    public string DepartmentCode { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public int DepartmentStatus { get; set; } = 1;
}
