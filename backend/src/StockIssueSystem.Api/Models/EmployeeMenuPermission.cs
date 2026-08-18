namespace StockIssueSystem.Api.Models;

public sealed class EmployeeMenuPermission
{
    public int EmployeeMenuPermissionId { get; set; }

    public int EmployeeId { get; set; }

    public int MenuId { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.Now;
}
