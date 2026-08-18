using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class EmployeeController(AppDbContext dbContext) : ControllerBase
{
    private static readonly Regex EmployeeNamePattern = new(@"^[A-Za-z\u0E00-\u0E7F\s]+$", RegexOptions.Compiled);
    private static readonly Regex ThaiCharacterPattern = new(@"[\u0E00-\u0E7F]", RegexOptions.Compiled);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmployeeDto>>> GetEmployees()
    {
        var permissionNames = await GetPermissionNames();
        var menuPermissions = await GetEmployeeMenuPermissions();
        var employees = await dbContext.Employees
            .OrderBy(employee => employee.EmployeeId)
            .ToListAsync();

        return Ok(employees.Select(employee => ToDto(employee, permissionNames, menuPermissions)).ToList());
    }

    [HttpGet("menus")]
    public async Task<ActionResult<IReadOnlyList<MenuDto>>> GetMenus()
    {
        var menus = await dbContext.Menus
            .Where(menu => menu.IsActive == 1)
            .OrderBy(menu => menu.SortOrder)
            .ThenBy(menu => menu.MenuId)
            .Select(menu => new MenuDto
            {
                MenuId = menu.MenuId,
                MenuCode = menu.MenuCode,
                MenuName = menu.MenuName,
                MenuPath = menu.MenuPath ?? string.Empty,
                SortOrder = menu.SortOrder,
            })
            .ToListAsync();

        return Ok(menus);
    }

    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions()
    {
        var permissions = await dbContext.Permissions
            .Where(permission => permission.Permissionstatus == 1)
            .OrderBy(permission => permission.PermissionId)
            .Select(permission => new
            {
                permission.PermissionId,
                permission.PermissionName,
            })
            .ToListAsync();

        return Ok(permissions);
    }

    [HttpGet("statuses")]
    public async Task<IActionResult> GetStatuses()
    {
        var statuses = await dbContext.Statuses
            .Where(status => status.StatusId <= 2 && status.StatusIsActive == 1)
            .OrderBy(status => status.StatusSortOrder)
            .Select(status => new
            {
                status.StatusId,
                status.StatusName,
            })
            .ToListAsync();

        return Ok(statuses);
    }

    [HttpGet("{employeeId:int}")]
    public async Task<ActionResult<EmployeeDto>> GetEmployee(int employeeId)
    {
        var employee = await dbContext.Employees.FindAsync(employeeId);

        if (employee is null)
        {
            return NotFound("Employee not found.");
        }

        var permissionNames = await GetPermissionNames();
        var menuPermissions = await GetEmployeeMenuPermissions(employeeId);

        return Ok(ToDto(employee, permissionNames, menuPermissions));
    }

    [HttpPost]
    public async Task<ActionResult<EmployeeDto>> CreateEmployee(CreateEmployeeDto request)
    {
        var validationError = ValidateEmployee(request.EmployeeId, request.EmployeeName, request.Username, request.Password);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var exists = await dbContext.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId);

        if (exists)
        {
            return Conflict("Employee ID already exists.");
        }

        var employee = new Employee
        {
            EmployeeId = request.EmployeeId,
            EmployeeName = request.EmployeeName.Trim(),
            Department = NormalizeDepartment(request.Department),
            Permission = NormalizePermissionId(request.Permission),
            Username = request.Username.Trim(),
            Password = request.Password.Trim(),
            Status = request.Status,
        };

        dbContext.Employees.Add(employee);
        await dbContext.SaveChangesAsync();
        await SaveEmployeeMenuPermissions(employee.EmployeeId, request.MenuIds ?? []);

        var permissionNames = await GetPermissionNames();
        var menuPermissions = await GetEmployeeMenuPermissions(employee.EmployeeId);

        return CreatedAtAction(nameof(GetEmployee), new
        {
            employeeId = employee.EmployeeId,
        }, ToDto(employee, permissionNames, menuPermissions));
    }

    [HttpPut("{employeeId:int}")]
    public async Task<ActionResult<EmployeeDto>> UpdateEmployee(int employeeId, UpdateEmployeeDto request)
    {
        var employee = await dbContext.Employees.FindAsync(employeeId);
        var newEmployeeId = request.EmployeeId > 0 ? request.EmployeeId : employeeId;

        if (employee is null)
        {
            return NotFound("Employee not found.");
        }

        var validationError = ValidateEmployeeForUpdate(newEmployeeId, request.EmployeeName, request.Username);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        if (newEmployeeId != employeeId
            && await dbContext.Employees.AnyAsync(item => item.EmployeeId == newEmployeeId))
        {
            return Conflict("Employee ID already exists.");
        }

        var savedEmployee = employee;

        if (newEmployeeId != employeeId)
        {
            savedEmployee = new Employee
            {
                EmployeeId = newEmployeeId,
                Password = string.IsNullOrWhiteSpace(request.Password)
                    ? employee.Password
                    : request.Password.Trim(),
            };

            dbContext.Employees.Remove(employee);
            dbContext.Employees.Add(savedEmployee);
        }
        else if (!string.IsNullOrWhiteSpace(request.Password))
        {
            savedEmployee.Password = request.Password.Trim();
        }

        savedEmployee.EmployeeName = request.EmployeeName.Trim();
        savedEmployee.Department = NormalizeDepartment(request.Department);
        savedEmployee.Permission = NormalizePermissionId(request.Permission);
        savedEmployee.Username = request.Username.Trim();
        savedEmployee.Status = request.Status;

        await dbContext.SaveChangesAsync();

        if (request.MenuIds is not null)
        {
            await SaveEmployeeMenuPermissions(savedEmployee.EmployeeId, request.MenuIds);
        }

        var permissionNames = await GetPermissionNames();
        var menuPermissions = await GetEmployeeMenuPermissions(savedEmployee.EmployeeId);

        return Ok(ToDto(savedEmployee, permissionNames, menuPermissions));
    }

    private async Task SaveEmployeeMenuPermissions(
        int employeeId,
        IReadOnlyCollection<int> menuIds)
    {
        var existingPermissions = await dbContext.EmployeeMenuPermissions
            .Where(permission => permission.EmployeeId == employeeId)
            .ToListAsync();

        dbContext.EmployeeMenuPermissions.RemoveRange(existingPermissions);

        var validMenuIds = await dbContext.Menus
            .Where(menu => menu.IsActive == 1
                && menuIds.Contains(menu.MenuId))
            .Select(menu => menu.MenuId)
            .ToListAsync();

        foreach (var menuId in validMenuIds.Distinct())
        {
            dbContext.EmployeeMenuPermissions.Add(new EmployeeMenuPermission
            {
                EmployeeId = employeeId,
                MenuId = menuId,
            });
        }

        await dbContext.SaveChangesAsync();
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

    private static EmployeeDto ToDto(
        Employee employee,
        IReadOnlyDictionary<string, string> permissionNames,
        IReadOnlyDictionary<int, List<int>> menuPermissions)
    {
        var permissionId = employee.Permission ?? string.Empty;

        return new EmployeeDto
        {
            EmployeeId = employee.EmployeeId,
            EmployeeName = employee.EmployeeName ?? string.Empty,
            Department = string.IsNullOrWhiteSpace(employee.Department) ? "HR" : employee.Department,
            Permission = permissionId,
            PermissionId = permissionId,
            PermissionName = permissionNames.GetValueOrDefault(permissionId, permissionId),
            Username = employee.Username ?? string.Empty,
            Status = employee.Status ?? 0,
            MenuIds = menuPermissions.GetValueOrDefault(employee.EmployeeId, []),
        };
    }

    private static string NormalizePermissionId(string permission)
    {
        return string.IsNullOrWhiteSpace(permission) ? "3" : permission.Trim();
    }

    private static string NormalizeDepartment(string department)
    {
        return string.IsNullOrWhiteSpace(department) ? "HR" : department.Trim();
    }

    private static string? ValidateEmployee(int employeeId, string employeeName, string username, string password)
    {
        if (employeeId <= 0)
        {
            return "Employee ID is required.";
        }

        if (string.IsNullOrWhiteSpace(employeeName)
            || string.IsNullOrWhiteSpace(username)
            || string.IsNullOrWhiteSpace(password))
        {
            return "Employee name, username, and password are required.";
        }

        if (!EmployeeNamePattern.IsMatch(employeeName.Trim()))
        {
            return "Employee name must not contain numbers or special characters.";
        }

        if (ThaiCharacterPattern.IsMatch(username.Trim()))
        {
            return "Username must not contain Thai characters.";
        }

        return null;
    }

    private static string? ValidateEmployeeForUpdate(int employeeId, string employeeName, string username)
    {
        if (employeeId <= 0)
        {
            return "Employee ID is required.";
        }

        if (string.IsNullOrWhiteSpace(employeeName) || string.IsNullOrWhiteSpace(username))
        {
            return "Employee name and username are required.";
        }

        if (!EmployeeNamePattern.IsMatch(employeeName.Trim()))
        {
            return "Employee name must not contain numbers or special characters.";
        }

        if (ThaiCharacterPattern.IsMatch(username.Trim()))
        {
            return "Username must not contain Thai characters.";
        }

        return null;
    }
}
