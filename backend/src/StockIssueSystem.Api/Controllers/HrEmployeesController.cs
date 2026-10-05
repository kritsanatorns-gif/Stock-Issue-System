using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/hr-employees")]
public sealed class HrEmployeesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<HrEmployeeDto>>> GetEmployees([FromQuery] string? department = null, [FromQuery] string? unitRef = null)
    {
        var employeeDepartment = department?.Trim() ?? string.Empty;
        var employeeUnitRef = unitRef?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(employeeDepartment))
        {
            return BadRequest("Department is required.");
        }

        await using var connection = new SqlConnection(dbContext.Database.GetConnectionString());
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT CAST(employee.Code AS nvarchar(50)) AS Code,
                LTRIM(RTRIM(ISNULL(employee.Name1, N'') + N' ' + ISNULL(employee.Lastname1, N''))) AS Name,
                ISNULL(employee.Department, N'') AS Department,
                ISNULL(employee.Division, N'') AS Division,
                ISNULL(employee.UnitRef, N'') AS UnitRef,
                ISNULL(unitRef.Name1, N'') AS UnitName
            FROM MARSHR.HRM.dbo.EMPLOYEE AS employee
            LEFT JOIN MARSHR.HRM.dbo.Unitref AS unitRef
                ON LTRIM(RTRIM(unitRef.UnitRefID)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(employee.UnitRef)) COLLATE DATABASE_DEFAULT
            WHERE employee.Division = @Department
                AND (@UnitRef = N'' OR employee.UnitRef = @UnitRef)
            ORDER BY employee.Code
            """;
        command.Parameters.Add(new SqlParameter("@Department", SqlDbType.NVarChar, 100) { Value = employeeDepartment });
        command.Parameters.Add(new SqlParameter("@UnitRef", SqlDbType.NVarChar, 100) { Value = employeeUnitRef });

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        var employees = new List<HrEmployeeDto>();

        while (await reader.ReadAsync())
        {
            employees.Add(new HrEmployeeDto
            {
                Code = reader["Code"]?.ToString() ?? string.Empty,
                Name = reader["Name"]?.ToString() ?? string.Empty,
                Department = reader["Department"]?.ToString() ?? string.Empty,
                Division = reader["Division"]?.ToString() ?? string.Empty,
                UnitRef = reader["UnitRef"]?.ToString() ?? string.Empty,
                UnitName = reader["UnitName"]?.ToString() ?? string.Empty,
            });
        }

        return Ok(employees);
    }

    [HttpGet("{code}")]
    public async Task<ActionResult<HrEmployeeDto>> GetEmployee(string code, [FromQuery] string? department = null, [FromQuery] string? unitRef = null)
    {
        var employeeCode = code.Trim();
        var employeeDepartment = department?.Trim() ?? string.Empty;
        var employeeUnitRef = unitRef?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(employeeCode))
        {
            return BadRequest("Employee code is required.");
        }

        await using var connection = new SqlConnection(dbContext.Database.GetConnectionString());
        await using var command = connection.CreateCommand();

        command.CommandText = """
            SELECT TOP (1)
                CAST(employee.Code AS nvarchar(50)) AS Code,
                LTRIM(RTRIM(ISNULL(employee.Name1, N'') + N' ' + ISNULL(employee.Lastname1, N''))) AS Name,
                ISNULL(employee.Department, N'') AS Department,
                ISNULL(employee.Division, N'') AS Division,
                ISNULL(employee.UnitRef, N'') AS UnitRef,
                ISNULL(unitRef.Name1, N'') AS UnitName
            FROM MARSHR.HRM.dbo.EMPLOYEE AS employee
            LEFT JOIN MARSHR.HRM.dbo.Unitref AS unitRef
                ON LTRIM(RTRIM(unitRef.UnitRefID)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(employee.UnitRef)) COLLATE DATABASE_DEFAULT
            WHERE CAST(employee.Code AS nvarchar(50)) = @Code
                AND (@Department = N'' OR employee.Division = @Department)
                AND (@UnitRef = N'' OR employee.UnitRef = @UnitRef)
        """;
        command.CommandType = CommandType.Text;
        command.Parameters.Add(new SqlParameter("@Code", SqlDbType.NVarChar, 50)
        {
            Value = employeeCode,
        });
        command.Parameters.Add(new SqlParameter("@Department", SqlDbType.NVarChar, 50)
        {
            Value = employeeDepartment,
        });
        command.Parameters.Add(new SqlParameter("@UnitRef", SqlDbType.NVarChar, 100)
        {
            Value = employeeUnitRef,
        });

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow);

        if (!await reader.ReadAsync())
        {
            return NotFound("HR employee not found.");
        }

        return Ok(new HrEmployeeDto
        {
            Code = reader["Code"]?.ToString() ?? string.Empty,
            Name = reader["Name"]?.ToString() ?? string.Empty,
            Department = reader["Department"]?.ToString() ?? string.Empty,
            Division = reader["Division"]?.ToString() ?? string.Empty,
            UnitRef = reader["UnitRef"]?.ToString() ?? string.Empty,
            UnitName = reader["UnitName"]?.ToString() ?? string.Empty,
        });
    }
}
