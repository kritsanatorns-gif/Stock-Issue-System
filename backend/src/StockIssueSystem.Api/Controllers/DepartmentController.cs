using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;
using System.Text.RegularExpressions;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/departments")]
public sealed class DepartmentController(AppDbContext dbContext) : ControllerBase
{
    private static readonly Regex DepartmentCodePattern = new(@"^[A-Za-z0-9._/-]+$", RegexOptions.Compiled);
    private static readonly Regex DepartmentNamePattern = new(@"^[A-Za-z0-9\u0E00-\u0E7F\s._/-]+$", RegexOptions.Compiled);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DepartmentDto>>> GetDepartments()
    {
        var departments = await dbContext.Departments
            .OrderBy(department => department.DepartmentCode)
            .Select(department => ToDto(department))
            .ToListAsync();

        return Ok(departments);
    }

    [HttpGet("{departmentId:int}")]
    public async Task<ActionResult<DepartmentDto>> GetDepartment(int departmentId)
    {
        var department = await dbContext.Departments.FindAsync(departmentId);

        if (department is null)
        {
            return NotFound("Department not found.");
        }

        return Ok(ToDto(department));
    }

    [HttpPost]
    public async Task<ActionResult<DepartmentDto>> CreateDepartment(CreateDepartmentDto request)
    {
        var validationError = ValidateDepartment(request.DepartmentCode, request.DepartmentName);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var departmentCode = request.DepartmentCode.Trim();

        if (await dbContext.Departments.AnyAsync(department => department.DepartmentCode == departmentCode))
        {
            return Conflict("Department code already exists.");
        }

        var department = new Department
        {
            DepartmentCode = departmentCode,
            DepartmentName = request.DepartmentName.Trim(),
            DepartmentStatus = request.DepartmentStatus,
        };

        dbContext.Departments.Add(department);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDepartment), new
        {
            departmentId = department.DepartmentId,
        }, ToDto(department));
    }

    [HttpPut("{departmentId:int}")]
    public async Task<ActionResult<DepartmentDto>> UpdateDepartment(int departmentId, UpdateDepartmentDto request)
    {
        var validationError = ValidateDepartment(request.DepartmentCode, request.DepartmentName);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var department = await dbContext.Departments.FindAsync(departmentId);

        if (department is null)
        {
            return NotFound("Department not found.");
        }

        var departmentCode = request.DepartmentCode.Trim();

        if (await dbContext.Departments.AnyAsync(item =>
            item.DepartmentId != departmentId && item.DepartmentCode == departmentCode))
        {
            return Conflict("Department code already exists.");
        }

        department.DepartmentCode = departmentCode;
        department.DepartmentName = request.DepartmentName.Trim();
        department.DepartmentStatus = request.DepartmentStatus;

        await dbContext.SaveChangesAsync();

        return Ok(ToDto(department));
    }

    private static string? ValidateDepartment(string departmentCode, string departmentName)
    {
        if (string.IsNullOrWhiteSpace(departmentCode) || string.IsNullOrWhiteSpace(departmentName))
        {
            return "Department code and name are required.";
        }

        if (!DepartmentCodePattern.IsMatch(departmentCode.Trim()))
        {
            return "Department code supports English letters, numbers, and . _ / - only.";
        }

        if (!DepartmentNamePattern.IsMatch(departmentName.Trim()))
        {
            return "Department name contains invalid characters.";
        }

        return null;
    }

    private static DepartmentDto ToDto(Department department)
    {
        return new DepartmentDto
        {
            DepartmentId = department.DepartmentId,
            DepartmentCode = department.DepartmentCode,
            DepartmentName = department.DepartmentName,
            DepartmentStatus = department.DepartmentStatus,
        };
    }
}
