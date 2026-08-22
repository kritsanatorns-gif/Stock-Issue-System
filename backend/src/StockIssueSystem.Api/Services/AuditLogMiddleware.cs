using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;

namespace StockIssueSystem.Api.Services;

public sealed class AuditLogMiddleware(RequestDelegate next, IServiceScopeFactory scopeFactory, ILogger<AuditLogMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var isDataChange = HttpMethods.IsPost(context.Request.Method)
            || HttpMethods.IsPut(context.Request.Method)
            || HttpMethods.IsPatch(context.Request.Method)
            || HttpMethods.IsDelete(context.Request.Method);

        await next(context);

        if (!isDataChange || !context.Request.Path.StartsWithSegments("/api"))
        {
            return;
        }

        try
        {
            var employeeId = GetEmployeeId(context.Request.Headers.Authorization);
            await using var scope = scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var employeeName = employeeId.HasValue
                ? await dbContext.Employees
                    .Where(employee => employee.EmployeeId == employeeId.Value)
                    .Select(employee => employee.EmployeeName ?? string.Empty)
                    .FirstOrDefaultAsync() ?? string.Empty
                : string.Empty;

            dbContext.AuditLogs.Add(new AuditLog
            {
                ActionType = context.Request.Method,
                EmployeeId = employeeId,
                EmployeeName = employeeName,
                IpAddress = context.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
                OccurredAt = DateTime.Now,
                Resource = context.Request.Path.Value ?? string.Empty,
                StatusCode = context.Response.StatusCode,
            });
            await dbContext.SaveChangesAsync();
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Unable to save audit log for {Method} {Path}", context.Request.Method, context.Request.Path);
        }
    }

    private static int? GetEmployeeId(string? authorization)
    {
        const string prefix = "Bearer dev-token-";
        var value = authorization?.Trim() ?? string.Empty;

        return value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            && int.TryParse(value[prefix.Length..], out var employeeId)
            ? employeeId
            : null;
    }
}
