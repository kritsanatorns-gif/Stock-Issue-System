namespace StockIssueSystem.Api.Models.DTOs;

public sealed class DepartmentDto
{
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string DivisionName { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public string UnitRef { get; set; } = string.Empty;
    public int DepartmentStatus { get; set; }
}
