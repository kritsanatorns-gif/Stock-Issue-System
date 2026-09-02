namespace StockIssueSystem.Api.Models;

public static class ThailandDateTime
{
    private static readonly TimeZoneInfo ThailandTimeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");

    public static DateTime FromClient(DateTime? value)
    {
        var dateTime = value ?? DateTime.Now;

        return dateTime.Kind == DateTimeKind.Utc
            ? TimeZoneInfo.ConvertTimeFromUtc(dateTime, ThailandTimeZone)
            : dateTime;
    }
}
