using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;

namespace StockIssueSystem.Api.Models;

public static class StockHeaderStatuses
{
    public const int Completed = 3;
    public const int Cancelled = 4;
    public const int PartiallyCancelled = 5;
    public const string TableName = "StockHeader";

    private const string CompletedName = "สำเร็จ";
    private const string CancelledName = "ถอยยอด";
    private const string PartiallyCancelledName = "ถอยยอดบางส่วน";

    public static async Task<IReadOnlyDictionary<int, string>> GetNames(AppDbContext dbContext)
    {
        return await dbContext.Statuses
            .AsNoTracking()
            .Where(status =>
                status.StatusTable == TableName
                && status.StatusIsActive == 1
                && status.StatusName != null)
            .ToDictionaryAsync(
                status => status.StatusId,
                status => status.StatusName ?? string.Empty);
    }

    public static string GetName(IReadOnlyDictionary<int, string> names, int statusId)
    {
        if (names.TryGetValue(statusId, out var statusName) && !string.IsNullOrWhiteSpace(statusName))
        {
            return statusName;
        }

        return statusId switch
        {
            Completed or 1 or 101 => CompletedName,
            Cancelled or 2 or 102 => CancelledName,
            PartiallyCancelled => PartiallyCancelledName,
            _ => statusId.ToString(),
        };
    }
}
