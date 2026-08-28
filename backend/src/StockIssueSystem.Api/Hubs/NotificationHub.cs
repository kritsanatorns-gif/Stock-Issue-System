using Microsoft.AspNetCore.SignalR;

namespace StockIssueSystem.Api.Hubs;

public sealed class NotificationHub : Hub
{
    public const string HrGroup = "notification-hr";

    public Task JoinHrNotifications() => Groups.AddToGroupAsync(Context.ConnectionId, HrGroup);

    public Task JoinRequesterNotifications(int employeeId)
    {
        return employeeId > 0
            ? Groups.AddToGroupAsync(Context.ConnectionId, $"notification-requester-{employeeId}")
            : Task.CompletedTask;
    }

    public static string RequesterGroup(int employeeId) => $"notification-requester-{employeeId}";
}
