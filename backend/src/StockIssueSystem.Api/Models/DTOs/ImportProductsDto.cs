namespace StockIssueSystem.Api.Models.DTOs;

public sealed class ImportProductsDto
{
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public IReadOnlyList<ImportProductRowDto> Items { get; set; } = [];
}
