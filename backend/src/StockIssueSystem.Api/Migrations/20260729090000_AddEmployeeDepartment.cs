using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    public partial class AddEmployeeDepartment : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Department",
                schema: "dbo",
                table: "Employee",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "HR");

            migrationBuilder.Sql("""
                UPDATE dbo.Employee
                SET Department = 'HR'
                WHERE Department IS NULL OR LTRIM(RTRIM(Department)) = ''
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Department",
                schema: "dbo",
                table: "Employee");
        }
    }
}
