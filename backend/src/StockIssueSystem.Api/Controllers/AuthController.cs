using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<LoginUserDto>>> GetUsers()
    {
        var permissionNames = await GetPermissionNames();
        var menuPermissions = await GetEmployeeMenuPermissions();
        var users = await dbContext.Employees
            .OrderBy(user => user.EmployeeId)
            .ToListAsync();

        return Ok(users.Select(user => ToLoginUserDto(user, permissionNames, menuPermissions)).ToList());
    }

    [HttpPost("users")]
    public async Task<ActionResult<LoginUserDto>> CreateUser(CreateLoginUserDto request)
    {
        if (string.IsNullOrWhiteSpace(request.EmployeeCode)
            || string.IsNullOrWhiteSpace(request.FullName)
            || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest("Employee code, full name, and password are required.");
        }

        if (!int.TryParse(request.EmployeeCode.Trim(), out var employeeId))
        {
            return BadRequest("Employee code must be a number.");
        }

        var exists = await dbContext.Employees.AnyAsync(user => user.EmployeeId == employeeId);

        if (exists)
        {
            return Conflict("Employee code already exists.");
        }

        var user = new Employee
        {
            EmployeeId = employeeId,
            EmployeeName = request.FullName.Trim(),
            Username = employeeId.ToString(),
            Password = request.Password.Trim(),
            Permission = NormalizePermissionId(request.Role),
            Department = "HR",
            Status = 1,
        };

        dbContext.Employees.Add(user);
        await dbContext.SaveChangesAsync();

        var permissionNames = await GetPermissionNames();
        var menuPermissions = await GetEmployeeMenuPermissions(user.EmployeeId);

        return CreatedAtAction(nameof(GetUsers), new
        {
            id = user.EmployeeId,
        }, ToLoginUserDto(user, permissionNames, menuPermissions));
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login(LoginDto request)
    {
        var employeeCode = request.EmployeeCode.Trim();
        var password = request.Password.Trim();
        var user = await dbContext.Employees
            .FirstOrDefaultAsync(employee =>
                (employee.EmployeeId.ToString() == employeeCode || employee.Username == employeeCode)
                && employee.Password == password
                && employee.Status == 1);

        if (user is null)
        {
            return Unauthorized("Invalid employee code or password.");
        }

        var permissionNames = await GetPermissionNames();
        var menuPermissions = await GetEmployeeMenuPermissions(user.EmployeeId);
        var employee = ToLoginUserDto(user, permissionNames, menuPermissions);

        return Ok(new LoginResponseDto
        {
            Token = $"dev-token-{user.EmployeeId}",
            Employee = employee,
            Roles = [employee.Role],
        });
    }

    private async Task<IReadOnlyDictionary<string, string>> GetPermissionNames()
    {
        return await dbContext.Permissions
            .Where(permission => permission.PermissionName != null)
            .ToDictionaryAsync(
                permission => permission.PermissionId.ToString(),
                permission => permission.PermissionName ?? string.Empty);
    }

    private async Task<IReadOnlyDictionary<int, List<int>>> GetEmployeeMenuPermissions(int? employeeId = null)
    {
        var query = dbContext.EmployeeMenuPermissions.AsQueryable();

        if (employeeId is not null)
        {
            query = query.Where(permission => permission.EmployeeId == employeeId);
        }

        var permissions = await query
            .OrderBy(permission => permission.MenuId)
            .ToListAsync();

        return permissions
            .GroupBy(permission => permission.EmployeeId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(permission => permission.MenuId).ToList());
    }

    private static LoginUserDto ToLoginUserDto(
        Employee user,
        IReadOnlyDictionary<string, string> permissionNames,
        IReadOnlyDictionary<int, List<int>> menuPermissions)
    {
        var permissionId = user.Permission ?? string.Empty;

        return new LoginUserDto
        {
            Id = user.EmployeeId,
            EmployeeCode = user.EmployeeId.ToString(),
            FullName = user.EmployeeName ?? string.Empty,
            Department = string.IsNullOrWhiteSpace(user.Department) ? "HR" : user.Department,
            Role = permissionNames.GetValueOrDefault(permissionId, permissionId),
            IsActive = user.Status == 1,
            MenuIds = menuPermissions.GetValueOrDefault(user.EmployeeId, []),
        };
    }

    private static string NormalizePermissionId(string permission)
    {
        return string.IsNullOrWhiteSpace(permission) ? "3" : permission.Trim();
    }
}
