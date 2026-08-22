namespace StockIssueSystem.Api.Models;

public sealed class AuditLog
{
    public long AuditLogId { get; set; }
    public DateTime OccurredAt { get; set; }
    public int? EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string Resource { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string IpAddress { get; set; } = string.Empty;
}
