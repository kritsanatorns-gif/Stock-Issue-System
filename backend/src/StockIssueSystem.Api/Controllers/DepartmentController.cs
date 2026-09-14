using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/departments")]
public sealed class DepartmentController(AppDbContext dbContext) : ControllerBase
{

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DepartmentDto>>> GetDepartments()
    {
        var departments = await dbContext.Departments
            .OrderBy(department => department.DepartmentId)
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
        var validationError = ValidateDepartment(request.DepartmentName, request.DivisionName);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var department = new Department
        {
            DepartmentName = request.DepartmentName.Trim(),
            DivisionName = string.IsNullOrWhiteSpace(request.DivisionName) ? request.DepartmentName.Trim() : request.DivisionName.Trim(),
            DepartmentStatus = request.DepartmentStatus,
        };

        dbContext.Departments.Add(department);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDepartment), new
        {
            departmentId = department.DepartmentId,
        }, ToDto(department));
    }

    [HttpPost("import-hr")]
    public async Task<ActionResult<object>> ImportFromHr()
    {
        var hrDepartments = new List<(string DivisionName, string DepartmentName)>();

        await using (var connection = new SqlConnection(dbContext.Database.GetConnectionString()))
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT DISTINCT
                    LTRIM(RTRIM(ISNULL(Department, N''))) AS DivisionName,
                    LTRIM(RTRIM(ISNULL(Division, N''))) AS DepartmentName
                FROM MARSHR.HRM.dbo.EMPLOYEE
                WHERE LTRIM(RTRIM(ISNULL(Department, N''))) <> N''
                    AND LTRIM(RTRIM(ISNULL(Division, N''))) <> N''
                ORDER BY DivisionName, DepartmentName
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                hrDepartments.Add((
                    reader["DivisionName"]?.ToString()?.Trim() ?? string.Empty,
                    reader["DepartmentName"]?.ToString()?.Trim() ?? string.Empty));
            }
        }

        var existingKeys = (await dbContext.Departments
            .Select(department => new { department.DivisionName, department.DepartmentName })
            .ToListAsync())
            .Select(department => $"{department.DivisionName.Trim()}\u001f{department.DepartmentName.Trim()}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var newDepartments = hrDepartments
            .Where(department => existingKeys.Add($"{department.DivisionName}\u001f{department.DepartmentName}"))
            .Select(department => new Department
            {
                DivisionName = department.DivisionName,
                DepartmentName = department.DepartmentName,
                DepartmentStatus = 1,
            })
            .ToList();

        if (newDepartments.Count > 0)
        {
            dbContext.Departments.AddRange(newDepartments);
            await dbContext.SaveChangesAsync();
        }

        return Ok(new
        {
            imported = newDepartments.Count,
            skipped = hrDepartments.Count - newDepartments.Count,
            total = hrDepartments.Count,
        });
    }

    [HttpPut("{departmentId:int}")]
    public async Task<ActionResult<DepartmentDto>> UpdateDepartment(int departmentId, UpdateDepartmentDto request)
    {
        var validationError = ValidateDepartment(request.DepartmentName, request.DivisionName);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var department = await dbContext.Departments.FindAsync(departmentId);

        if (department is null)
        {
            return NotFound("Department not found.");
        }

        department.DepartmentName = request.DepartmentName.Trim();
        department.DivisionName = string.IsNullOrWhiteSpace(request.DivisionName) ? request.DepartmentName.Trim() : request.DivisionName.Trim();
        department.DepartmentStatus = request.DepartmentStatus;

        await dbContext.SaveChangesAsync();

        return Ok(ToDto(department));
    }

    private static string? ValidateDepartment(string departmentName, string divisionName)
    {
        if (string.IsNullOrWhiteSpace(departmentName) || string.IsNullOrWhiteSpace(divisionName))
        {
            return "Division and department name are required.";
        }

        return null;
    }

    private static DepartmentDto ToDto(Department department)
    {
        return new DepartmentDto
        {
            DepartmentId = department.DepartmentId,
            DepartmentName = department.DepartmentName,
            DivisionName = department.DivisionName,
            DepartmentStatus = department.DepartmentStatus,
        };
    }
}
