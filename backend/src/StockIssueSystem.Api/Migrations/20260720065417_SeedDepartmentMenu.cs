using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedDepartmentMenu : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                SET IDENTITY_INSERT dbo.Menu ON;

                IF NOT EXISTS (SELECT 1 FROM dbo.Menu WHERE MenuId = 8)
                BEGIN
                    INSERT INTO dbo.Menu (MenuId, MenuCode, MenuName, MenuPath, SortOrder, IsActive)
                    VALUES (8, 'DEPARTMENTS', N'Department', '/departments', 8, 1);
                END;
                ELSE
                BEGIN
                    UPDATE dbo.Menu
                    SET MenuCode = 'DEPARTMENTS',
                        MenuName = N'Department',
                        MenuPath = '/departments',
                        SortOrder = 8,
                        IsActive = 1
                    WHERE MenuId = 8;
                END;

                SET IDENTITY_INSERT dbo.Menu OFF;

                INSERT INTO dbo.EmployeeMenuPermission (EmployeeId, MenuId, CreatedDate)
                SELECT employee.EmployeeId, 8, GETDATE()
                FROM dbo.Employee employee
                WHERE employee.Permission = '1'
                    AND NOT EXISTS (
                        SELECT 1
                        FROM dbo.EmployeeMenuPermission existingPermission
                        WHERE existingPermission.EmployeeId = employee.EmployeeId
                            AND existingPermission.MenuId = 8
                    );
                """);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM dbo.EmployeeMenuPermission
                WHERE MenuId = 8;

                DELETE FROM dbo.Menu
                WHERE MenuId = 8 AND MenuCode = 'DEPARTMENTS';
                """);

        }
    }
}
