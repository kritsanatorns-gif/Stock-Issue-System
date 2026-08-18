namespace StockIssueSystem.Api.Models.DTOs;

public sealed class LoginDto
{
    public string EmployeeCode { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
