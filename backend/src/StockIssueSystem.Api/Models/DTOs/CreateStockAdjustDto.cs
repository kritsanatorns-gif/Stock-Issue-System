namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateStockAdjustDto
{
    public DateTime? CreatedAt { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public IReadOnlyList<CreateStockAdjustItemDto> Items { get; set; } = [];
    public string Remark { get; set; } = string.Empty;
}
