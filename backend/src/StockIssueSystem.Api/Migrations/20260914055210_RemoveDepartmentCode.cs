using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    public partial class RemoveDepartmentCode : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Department') AND name = N'UX_Department_DepartmentCode_NotEmpty')
                    DROP INDEX UX_Department_DepartmentCode_NotEmpty ON dbo.Department;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Department') AND name = N'IX_Department_DepartmentCode')
                    DROP INDEX IX_Department_DepartmentCode ON dbo.Department;
                """);
            migrationBuilder.DropColumn(name: "DepartmentCode", schema: "dbo", table: "Department");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "DepartmentCode", schema: "dbo", table: "Department", type: "nvarchar(200)", maxLength: 200, nullable: false, defaultValue: "");
        }
    }
}
