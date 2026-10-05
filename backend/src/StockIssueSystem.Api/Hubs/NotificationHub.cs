using Microsoft.AspNetCore.SignalR;

namespace StockIssueSystem.Api.Hubs;

public sealed class NotificationHub : Hub
{
    public Task JoinUnitNotifications(string? unitRef) => !string.IsNullOrWhiteSpace(unitRef)
        ? Groups.AddToGroupAsync(Context.ConnectionId, UnitGroup(unitRef))
        : Task.CompletedTask;

    public Task JoinRequesterNotifications(int employeeId) => employeeId > 0
        ? Groups.AddToGroupAsync(Context.ConnectionId, RequesterGroup(employeeId))
        : Task.CompletedTask;

    public Task JoinDepartmentNotifications(string? department) => !string.IsNullOrWhiteSpace(department)
        ? Groups.AddToGroupAsync(Context.ConnectionId, DepartmentGroup(department))
        : Task.CompletedTask;

    public static string RequesterGroup(int employeeId) => $"notification-requester-{employeeId}";
    public static string DepartmentGroup(string department) => $"notification-department-{department.Trim().ToUpperInvariant()}";
    public static string UnitGroup(string unitRef) => $"notification-unit-{unitRef.Trim().ToUpperInvariant()}";
}
