namespace StockIssueSystem.Api.Models;

public static class RequisitionStatuses
{
    public const int Pending = 6;
    public const int Approved = 7;
    public const int Backlog = 8;
    public const int Rejected = 9;

    public static string GetName(int status)
    {
        return status switch
        {
            Pending => "รอจัดของ",
            Approved => "ได้ของครบ",
            Backlog => "ค้าง",
            Rejected => "ไม่ให้เบิก",
            _ => status.ToString(),
        };
    }
}
