using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProductUnitConversionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ConversionQty",
                schema: "dbo",
                table: "Product",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 1m);

            migrationBuilder.AddColumn<string>(
                name: "IssueUnit",
                schema: "dbo",
                table: "Product",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReceiveUnit",
                schema: "dbo",
                table: "Product",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE dbo.Product
                SET
                    IssueUnit = CASE WHEN ISNULL(IssueUnit, '') = '' THEN ISNULL(Unit, '') ELSE IssueUnit END,
                    ReceiveUnit = CASE WHEN ISNULL(ReceiveUnit, '') = '' THEN ISNULL(Unit, '') ELSE ReceiveUnit END,
                    ConversionQty = CASE WHEN ConversionQty <= 0 THEN 1 ELSE ConversionQty END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConversionQty",
                schema: "dbo",
                table: "Product");

            migrationBuilder.DropColumn(
                name: "IssueUnit",
                schema: "dbo",
                table: "Product");

            migrationBuilder.DropColumn(
                name: "ReceiveUnit",
                schema: "dbo",
                table: "Product");
        }
    }
}
