using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Services;

[AttributeUsage(AttributeTargets.Method)]
public sealed class RequireStaffMenuAttribute(int menuId) : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var services = context.HttpContext.RequestServices;
        var id = services.GetRequiredService<StaffSession>().Read(context.HttpContext.Request.Headers.Authorization);
        if (id is null) { context.Result = new UnauthorizedObjectResult("กรุณาเข้าสู่ระบบใหม่"); return; }
        var db = services.GetRequiredService<AppDbContext>();
        var employee = await db.Employees.AsNoTracking().SingleOrDefaultAsync(e => e.EmployeeId == id && e.Status == 1);
        if (employee is null) { context.Result = new UnauthorizedResult(); return; }
        var role = await db.Permissions.Where(p => p.PermissionId.ToString() == employee.Permission).Select(p => p.PermissionName).FirstOrDefaultAsync() ?? "";
        var admin = role.Contains("admin", StringComparison.OrdinalIgnoreCase) || role.Contains("ผู้ดูแล");
        if (!admin && !await db.EmployeeMenuPermissions.AnyAsync(p => p.EmployeeId == id && p.MenuId == menuId))
        { context.Result = new ObjectResult("ไม่มีสิทธิ์ดำเนินการรายการนี้") { StatusCode = 403 }; return; }
        // The acting employee comes from the validated session, never the submitted ID.
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is ApproveRequisitionDto approve) approve.EmployeeId = id.Value;
            if (argument is RejectRequisitionDto reject) reject.EmployeeId = id.Value;
            if (argument is CancelStockDocumentDto cancel) cancel.EmployeeId = id.Value;
        }
        await next();
    }
}
