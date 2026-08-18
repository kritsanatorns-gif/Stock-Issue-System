namespace StockIssueSystem.Api.Models.DTOs;

public sealed class UpdateEmployeeDto
{
    public int EmployeeId { get; set; }

    public string EmployeeName { get; set; } = string.Empty;

    public string Permission { get; set; } = string.Empty;

    public string Department { get; set; } = "HR";

    public string Username { get; set; } = string.Empty;

    public string? Password { get; set; }

    public int Status { get; set; } = 1;

    public List<int>? MenuIds { get; set; }
}
