using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReceiveVatSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TotalVat",
                schema: "dbo",
                table: "StockIssueCost",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitVat",
                schema: "dbo",
                table: "StockIssueCost",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                schema: "dbo",
                table: "StockIssueCost",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "HasVatSnapshot",
                schema: "dbo",
                table: "StockHeader",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PurchaseSubtotal",
                schema: "dbo",
                table: "StockHeader",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatAmount",
                schema: "dbo",
                table: "StockHeader",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                schema: "dbo",
                table: "StockHeader",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitVat",
                schema: "dbo",
                table: "StockCostLot",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatAmount",
                schema: "dbo",
                table: "StockCostLot",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                schema: "dbo",
                table: "StockCostLot",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalVat",
                schema: "dbo",
                table: "StockIssueCost");

            migrationBuilder.DropColumn(
                name: "UnitVat",
                schema: "dbo",
                table: "StockIssueCost");

            migrationBuilder.DropColumn(
                name: "VatRate",
                schema: "dbo",
                table: "StockIssueCost");

            migrationBuilder.DropColumn(
                name: "HasVatSnapshot",
                schema: "dbo",
                table: "StockHeader");

            migrationBuilder.DropColumn(
                name: "PurchaseSubtotal",
                schema: "dbo",
                table: "StockHeader");

            migrationBuilder.DropColumn(
                name: "VatAmount",
                schema: "dbo",
                table: "StockHeader");

            migrationBuilder.DropColumn(
                name: "VatRate",
                schema: "dbo",
                table: "StockHeader");

            migrationBuilder.DropColumn(
                name: "UnitVat",
                schema: "dbo",
                table: "StockCostLot");

            migrationBuilder.DropColumn(
                name: "VatAmount",
                schema: "dbo",
                table: "StockCostLot");

            migrationBuilder.DropColumn(
                name: "VatRate",
                schema: "dbo",
                table: "StockCostLot");
        }
    }
}
