using System.ComponentModel.DataAnnotations;

namespace StockIssueSystem.Api.Models;

public sealed class Permission
{
    public int PermissionId { get; set; }

    [MaxLength(50)]
    public string? PermissionName { get; set; }

    public int Permissionstatus { get; set; } = 1;
}
