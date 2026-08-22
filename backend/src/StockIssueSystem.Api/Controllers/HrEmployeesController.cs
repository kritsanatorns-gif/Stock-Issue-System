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
    public async Task<ActionResult<IReadOnlyList<HrEmployeeDto>>> GetEmployees([FromQuery] string? department = null)
    {
        var employeeDepartment = department?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(employeeDepartment))
        {
            return BadRequest("Department is required.");
        }

        await using var connection = new SqlConnection(dbContext.Database.GetConnectionString());
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT CAST(Code AS nvarchar(50)) AS Code,
                LTRIM(RTRIM(ISNULL(Name1, N'') + N' ' + ISNULL(Lastname1, N''))) AS Name,
                ISNULL(Department, N'') AS Department,
                ISNULL(UnitRef, N'') AS UnitRef
            FROM MARSHR.HRM.dbo.EMPLOYEE
            WHERE Department = @Department
            ORDER BY Code
            """;
        command.Parameters.Add(new SqlParameter("@Department", SqlDbType.NVarChar, 100) { Value = employeeDepartment });

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
                UnitRef = reader["UnitRef"]?.ToString() ?? string.Empty,
            });
        }

        return Ok(employees);
    }

    [HttpGet("{code}")]
    public async Task<ActionResult<HrEmployeeDto>> GetEmployee(string code, [FromQuery] string? department = null)
    {
        var employeeCode = code.Trim();
        var employeeDepartment = department?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(employeeCode))
        {
            return BadRequest("Employee code is required.");
        }

        await using var connection = new SqlConnection(dbContext.Database.GetConnectionString());
        await using var command = connection.CreateCommand();

        command.CommandText = """
            SELECT TOP (1)
                CAST(Code AS nvarchar(50)) AS Code,
                LTRIM(RTRIM(ISNULL(Name1, N'') + N' ' + ISNULL(Lastname1, N''))) AS Name,
                ISNULL(Department, N'') AS Department,
                ISNULL(UnitRef, N'') AS UnitRef
            FROM MARSHR.HRM.dbo.EMPLOYEE
            WHERE CAST(Code AS nvarchar(50)) = @Code
                AND (@Department = N'' OR Department = @Department)
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
            UnitRef = reader["UnitRef"]?.ToString() ?? string.Empty,
        });
    }
}
