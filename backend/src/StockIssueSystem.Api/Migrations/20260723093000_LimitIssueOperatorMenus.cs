using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StockIssueSystem.Api.Data;

#nullable disable

namespace StockIssueSystem.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260723093000_LimitIssueOperatorMenus")]
public partial class LimitIssueOperatorMenus : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DELETE permission
            FROM dbo.EmployeeMenuPermission permission
            INNER JOIN dbo.Employee employee
                ON employee.EmployeeId = permission.EmployeeId
            INNER JOIN dbo.Menu menu
                ON menu.MenuId = permission.MenuId
            WHERE employee.Permission = '3'
                AND menu.MenuCode NOT IN (N'DASHBOARD', N'STOCK_OUT');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
