using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StockIssueSystem.Api.Data;

#nullable disable

namespace StockIssueSystem.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260723090000_DropUnusedStockAndProductColumns")]
public partial class DropUnusedStockAndProductColumns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_StockHeader_DocNo",
            schema: "dbo",
            table: "StockHeader");

        migrationBuilder.DropColumn(
            name: "DocNo",
            schema: "dbo",
            table: "StockHeader");

        migrationBuilder.DropColumn(
            name: "ApprovedBy",
            schema: "dbo",
            table: "StockHeader");

        migrationBuilder.DropColumn(
            name: "Unit",
            schema: "dbo",
            table: "Product");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "DocNo",
            schema: "dbo",
            table: "StockHeader",
            type: "nvarchar(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: string.Empty);

        migrationBuilder.AddColumn<string>(
            name: "ApprovedBy",
            schema: "dbo",
            table: "StockHeader",
            type: "nvarchar(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: string.Empty);

        migrationBuilder.AddColumn<string>(
            name: "Unit",
            schema: "dbo",
            table: "Product",
            type: "nvarchar(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: string.Empty);

        migrationBuilder.CreateIndex(
            name: "IX_StockHeader_DocNo",
            schema: "dbo",
            table: "StockHeader",
            column: "DocNo",
            unique: true);
    }
}
