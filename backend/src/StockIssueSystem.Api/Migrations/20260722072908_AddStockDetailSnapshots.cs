using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStockDetailSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                schema: "dbo",
                table: "StockDetail",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                schema: "dbo",
                table: "StockDetail",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CostLot",
                schema: "dbo",
                table: "StockDetail",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProductName",
                schema: "dbo",
                table: "StockDetail",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE detail
                SET
                    detail.Barcode = ISNULL(product.Barcode, ''),
                    detail.Category = ISNULL(NULLIF(product.CategoryName, ''), 'General'),
                    detail.ProductName = ISNULL(NULLIF(product.ProductName, ''), detail.ProductId)
                FROM dbo.StockDetail detail
                LEFT JOIN dbo.Product product ON product.ProductId = detail.ProductId
                WHERE detail.Barcode = ''
                   OR detail.Category = ''
                   OR detail.ProductName = '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Barcode",
                schema: "dbo",
                table: "StockDetail");

            migrationBuilder.DropColumn(
                name: "Category",
                schema: "dbo",
                table: "StockDetail");

            migrationBuilder.DropColumn(
                name: "CostLot",
                schema: "dbo",
                table: "StockDetail");

            migrationBuilder.DropColumn(
                name: "ProductName",
                schema: "dbo",
                table: "StockDetail");
        }
    }
}
