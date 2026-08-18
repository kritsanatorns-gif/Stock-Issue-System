using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedStockAdjustMenu : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                SET IDENTITY_INSERT dbo.Menu ON;

                IF NOT EXISTS (SELECT 1 FROM dbo.Menu WHERE MenuId = 9)
                BEGIN
                    INSERT INTO dbo.Menu (MenuId, MenuCode, MenuName, MenuPath, SortOrder, IsActive)
                    VALUES (9, 'STOCK_ADJUST', N'ปรับสต๊อก', '/stock-adjust', 9, 1);
                END;
                ELSE
                BEGIN
                    UPDATE dbo.Menu
                    SET MenuCode = 'STOCK_ADJUST',
                        MenuName = N'ปรับสต๊อก',
                        MenuPath = '/stock-adjust',
                        SortOrder = 9,
                        IsActive = 1
                    WHERE MenuId = 9;
                END;

                SET IDENTITY_INSERT dbo.Menu OFF;

                INSERT INTO dbo.EmployeeMenuPermission (EmployeeId, MenuId, CreatedDate)
                SELECT employee.EmployeeId, 9, GETDATE()
                FROM dbo.Employee employee
                WHERE employee.Permission = '1'
                    AND NOT EXISTS (
                        SELECT 1
                        FROM dbo.EmployeeMenuPermission existingPermission
                        WHERE existingPermission.EmployeeId = employee.EmployeeId
                            AND existingPermission.MenuId = 9
                    );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM dbo.EmployeeMenuPermission
                WHERE MenuId = 9;

                DELETE FROM dbo.Menu
                WHERE MenuId = 9 AND MenuCode = 'STOCK_ADJUST';
                """);
        }
    }
}
