namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CancelStockDocumentDto
{
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public IReadOnlyList<CancelStockDocumentItemDto> Items { get; set; } = [];
    public string Remark { get; set; } = string.Empty;
}

public sealed class CancelStockDocumentItemDto
{
    public int DetailId { get; set; }
    public string Code { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
}
