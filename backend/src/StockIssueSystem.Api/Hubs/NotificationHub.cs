using Microsoft.AspNetCore.SignalR;

namespace StockIssueSystem.Api.Hubs;

public sealed class NotificationHub : Hub
{
    public const string HrGroup = "notification-hr";

    public Task JoinHrNotifications() => Groups.AddToGroupAsync(Context.ConnectionId, HrGroup);

    public Task JoinRequesterNotifications(int employeeId) => employeeId > 0
        ? Groups.AddToGroupAsync(Context.ConnectionId, RequesterGroup(employeeId))
        : Task.CompletedTask;

    public Task JoinDepartmentNotifications(string? department) => !string.IsNullOrWhiteSpace(department)
        ? Groups.AddToGroupAsync(Context.ConnectionId, DepartmentGroup(department))
        : Task.CompletedTask;

    public static string RequesterGroup(int employeeId) => $"notification-requester-{employeeId}";
    public static string DepartmentGroup(string department) => $"notification-department-{department.Trim().ToUpperInvariant()}";
}
