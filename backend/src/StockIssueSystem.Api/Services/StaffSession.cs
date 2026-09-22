using System.Globalization;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace StockIssueSystem.Api.Services;

public sealed class StaffSession(IDataProtectionProvider provider)
{
    private readonly ITimeLimitedDataProtector protector = provider.CreateProtector("StockIssue.StaffSession.v1").ToTimeLimitedDataProtector();

    public string Issue(int employeeId) => protector.Protect(employeeId.ToString(CultureInfo.InvariantCulture), TimeSpan.FromHours(4));

    public int? Read(string? authorization)
    {
        if (authorization is null || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        try
        {
            return int.TryParse(protector.Unprotect(authorization[7..].Trim()), out var id) && id > 0 ? id : null;
        }
        catch (CryptographicException) { return null; }
        catch (FormatException) { return null; }
    }
}
