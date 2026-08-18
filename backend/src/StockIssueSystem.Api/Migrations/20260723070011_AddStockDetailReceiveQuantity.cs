using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStockDetailReceiveQuantity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ReceiveQty",
                schema: "dbo",
                table: "StockDetail",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiveUnit",
                schema: "dbo",
                table: "StockDetail",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReceiveQty",
                schema: "dbo",
                table: "StockDetail");

            migrationBuilder.DropColumn(
                name: "ReceiveUnit",
                schema: "dbo",
                table: "StockDetail");
        }
    }
}
