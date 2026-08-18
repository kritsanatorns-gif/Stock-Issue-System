namespace StockIssueSystem.Api.Models.DTOs;

public sealed class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public LoginUserDto Employee { get; set; } = new();
    public string[] Roles { get; set; } = [];
}
