using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStockCostLotAndIssueCost : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StockCostLot",
                schema: "dbo",
                columns: table => new
                {
                    CostLotId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ReceiveHeaderId = table.Column<int>(type: "int", nullable: false),
                    ReceiveDetailId = table.Column<int>(type: "int", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OriginalQty = table.Column<int>(type: "int", nullable: false),
                    RemainingQty = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    Status = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockCostLot", x => x.CostLotId);
                });

            migrationBuilder.CreateTable(
                name: "StockIssueCost",
                schema: "dbo",
                columns: table => new
                {
                    IssueCostId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IssueDetailId = table.Column<int>(type: "int", nullable: false),
                    CostLotId = table.Column<int>(type: "int", nullable: false),
                    Qty = table.Column<int>(type: "int", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockIssueCost", x => x.IssueCostId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StockCostLot_ProductId_RemainingQty_CreatedDate",
                schema: "dbo",
                table: "StockCostLot",
                columns: new[] { "ProductId", "RemainingQty", "CreatedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_StockIssueCost_CostLotId",
                schema: "dbo",
                table: "StockIssueCost",
                column: "CostLotId");

            migrationBuilder.CreateIndex(
                name: "IX_StockIssueCost_IssueDetailId",
                schema: "dbo",
                table: "StockIssueCost",
                column: "IssueDetailId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StockCostLot",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "StockIssueCost",
                schema: "dbo");
        }
    }
}
