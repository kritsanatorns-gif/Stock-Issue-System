using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StockIssueSystem.Api.Data;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260710090000_AddMenuPermissions")]
    public partial class AddMenuPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Menu",
                schema: "dbo",
                columns: table => new
                {
                    MenuId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MenuCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MenuName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MenuPath = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<int>(type: "int", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Menu", x => x.MenuId);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeMenuPermission",
                schema: "dbo",
                columns: table => new
                {
                    EmployeeMenuPermissionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    MenuId = table.Column<int>(type: "int", nullable: false),
                    CanView = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeMenuPermission", x => x.EmployeeMenuPermissionId);
                    table.ForeignKey(
                        name: "FK_EmployeeMenuPermission_Menu_MenuId",
                        column: x => x.MenuId,
                        principalSchema: "dbo",
                        principalTable: "Menu",
                        principalColumn: "MenuId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM [dbo].[Menu] WHERE [MenuCode] = N'DASHBOARD')
                    INSERT INTO [dbo].[Menu] ([MenuCode], [MenuName], [MenuPath], [SortOrder], [IsActive])
                    VALUES (N'DASHBOARD', N'Dashboard', N'/', 1, 1);

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Menu] WHERE [MenuCode] = N'STOCK_OUT')
                    INSERT INTO [dbo].[Menu] ([MenuCode], [MenuName], [MenuPath], [SortOrder], [IsActive])
                    VALUES (N'STOCK_OUT', N'เบิกสินค้า', N'/stock-out', 2, 1);

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Menu] WHERE [MenuCode] = N'STOCK_IN')
                    INSERT INTO [dbo].[Menu] ([MenuCode], [MenuName], [MenuPath], [SortOrder], [IsActive])
                    VALUES (N'STOCK_IN', N'นำของเข้า', N'/stock-in', 3, 1);

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Menu] WHERE [MenuCode] = N'PRODUCTS')
                    INSERT INTO [dbo].[Menu] ([MenuCode], [MenuName], [MenuPath], [SortOrder], [IsActive])
                    VALUES (N'PRODUCTS', N'สินค้า', N'/products', 4, 1);

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Menu] WHERE [MenuCode] = N'HISTORY')
                    INSERT INTO [dbo].[Menu] ([MenuCode], [MenuName], [MenuPath], [SortOrder], [IsActive])
                    VALUES (N'HISTORY', N'ประวัติรายการ', N'/history', 5, 1);

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Menu] WHERE [MenuCode] = N'REPORTS')
                    INSERT INTO [dbo].[Menu] ([MenuCode], [MenuName], [MenuPath], [SortOrder], [IsActive])
                    VALUES (N'REPORTS', N'Reports', N'/reports', 6, 1);

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Menu] WHERE [MenuCode] = N'USERS')
                    INSERT INTO [dbo].[Menu] ([MenuCode], [MenuName], [MenuPath], [SortOrder], [IsActive])
                    VALUES (N'USERS', N'ผู้ใช้งาน', N'/users', 7, 1);
                """);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeMenuPermission_EmployeeId_MenuId",
                schema: "dbo",
                table: "EmployeeMenuPermission",
                columns: new[] { "EmployeeId", "MenuId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeMenuPermission_MenuId",
                schema: "dbo",
                table: "EmployeeMenuPermission",
                column: "MenuId");

            migrationBuilder.CreateIndex(
                name: "IX_Menu_MenuCode",
                schema: "dbo",
                table: "Menu",
                column: "MenuCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeMenuPermission",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Menu",
                schema: "dbo");
        }
    }
}
