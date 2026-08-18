namespace StockIssueSystem.Api.Models.DTOs;

public sealed class EmployeeDto
{
    public int EmployeeId { get; set; }

    public string EmployeeName { get; set; } = string.Empty;

    public string Permission { get; set; } = string.Empty;

    public string PermissionId { get; set; } = string.Empty;

    public string PermissionName { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    public string Username { get; set; } = string.Empty;

    public int Status { get; set; }

    public List<int> MenuIds { get; set; } = [];
}
