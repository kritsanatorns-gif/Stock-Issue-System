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
            .OrderBy(department => department.DivisionName == "" || department.DepartmentName == "" ? 1 : 0)
            .ThenBy(department => department.DivisionName)
            .ThenBy(department => department.DepartmentName)
            .ThenBy(department => department.UnitName)
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
            UnitName = request.UnitName?.Trim() ?? string.Empty,
            UnitRef = request.UnitRef?.Trim() ?? string.Empty,
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
        var hrDepartments = new List<(string DivisionName, string DepartmentName, string UnitName, string UnitRef)>();

        await using (var connection = new SqlConnection(dbContext.Database.GetConnectionString()))
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT
                    COALESCE(NULLIF(LTRIM(RTRIM(unitRef.Department)) COLLATE DATABASE_DEFAULT, N''), employee.DivisionName COLLATE DATABASE_DEFAULT, N'') AS DivisionName,
                    COALESCE(NULLIF(LTRIM(RTRIM(unitRef.Division)) COLLATE DATABASE_DEFAULT, N''), employee.DepartmentName COLLATE DATABASE_DEFAULT, N'') AS DepartmentName,
                    LTRIM(RTRIM(unitRef.Name1)) AS UnitName,
                    LTRIM(RTRIM(unitRef.UnitRefID)) AS UnitRef
                FROM MARSHR.HRM.dbo.Unitref AS unitRef
                OUTER APPLY
                (
                    SELECT
                        MIN(LTRIM(RTRIM(employee.Department))) AS DivisionName,
                        MIN(LTRIM(RTRIM(employee.Division))) AS DepartmentName
                    FROM MARSHR.HRM.dbo.EMPLOYEE AS employee
                    WHERE LTRIM(RTRIM(employee.UnitRef)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(unitRef.UnitRefID)) COLLATE DATABASE_DEFAULT
                        AND LTRIM(RTRIM(ISNULL(employee.Department, N''))) <> N''
                        AND LTRIM(RTRIM(ISNULL(employee.Division, N''))) <> N''
                ) AS employee
                WHERE LTRIM(RTRIM(ISNULL(unitRef.Name1, N''))) <> N''
                ORDER BY
                    CASE WHEN DivisionName = N'' OR DepartmentName = N'' THEN 1 ELSE 0 END,
                    DivisionName COLLATE DATABASE_DEFAULT,
                    DepartmentName COLLATE DATABASE_DEFAULT,
                    3
                """;

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                hrDepartments.Add((
                    reader["DivisionName"]?.ToString()?.Trim() ?? string.Empty,
                    reader["DepartmentName"]?.ToString()?.Trim() ?? string.Empty,
                    reader["UnitName"]?.ToString()?.Trim() ?? string.Empty,
                    reader["UnitRef"]?.ToString()?.Trim() ?? string.Empty));
            }
        }

        var newDepartments = hrDepartments
            .DistinctBy(department => department.UnitRef, StringComparer.OrdinalIgnoreCase)
            .Select(department => new Department
            {
                DivisionName = department.DivisionName,
                DepartmentName = department.DepartmentName,
                UnitName = department.UnitName,
                UnitRef = department.UnitRef,
                DepartmentStatus = 1,
            })
            .ToList();

        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        dbContext.Departments.RemoveRange(dbContext.Departments);
        dbContext.Departments.AddRange(newDepartments);
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new
        {
            imported = newDepartments.Count,
            skipped = 0,
            total = hrDepartments.Count,
        });
    }

    [HttpDelete]
    public async Task<ActionResult<object>> ClearDepartments()
    {
        var departments = await dbContext.Departments.ToListAsync();
        dbContext.Departments.RemoveRange(departments);
        await dbContext.SaveChangesAsync();

        return Ok(new { deleted = departments.Count });
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
        department.UnitName = request.UnitName?.Trim() ?? string.Empty;
        department.UnitRef = request.UnitRef?.Trim() ?? string.Empty;
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
            UnitName = department.UnitName,
            UnitRef = department.UnitRef,
            DepartmentStatus = department.DepartmentStatus,
        };
    }
}
