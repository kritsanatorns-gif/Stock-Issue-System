namespace StockIssueSystem.Api.Models.DTOs;

public sealed class CreateLoginUserDto
{
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "issueOperator";
}
