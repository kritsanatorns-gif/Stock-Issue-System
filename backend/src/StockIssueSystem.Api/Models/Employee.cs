using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Employee
{
    public int EmployeeId { get; set; }

    [MaxLength(50)]
    public string? EmployeeName { get; set; }

    [MaxLength(50)]
    public string? Permission { get; set; }

    [MaxLength(50)]
    public string? Department { get; set; } = "HR";

    [MaxLength(50)]
    public string? Username { get; set; }

    [MaxLength(50)]
    public string? Password { get; set; }

    public int? Status { get; set; } = 1;
}
