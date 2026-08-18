using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StockIssueSystem.Api.Data;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260710100000_RemoveCanViewFromEmployeeMenuPermission")]
    public partial class RemoveCanViewFromEmployeeMenuPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanView",
                schema: "dbo",
                table: "EmployeeMenuPermission");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CanView",
                schema: "dbo",
                table: "EmployeeMenuPermission",
                type: "int",
                nullable: false,
                defaultValue: 1);
        }
    }
}
