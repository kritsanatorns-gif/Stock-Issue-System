using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Department
{
    public int DepartmentId { get; set; }

    [MaxLength(200)]
    public string DepartmentCode { get; set; } = string.Empty;

    [MaxLength(50)]
    public string DepartmentName { get; set; } = string.Empty;

    public int DepartmentStatus { get; set; } = 1;
}
