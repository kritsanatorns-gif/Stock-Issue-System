using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStockIssueDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StockIssueHeader",
                schema: "dbo",
                columns: table => new
                {
                    StockIssueHeaderId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DocumentNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    EmployeeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Department = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TotalItems = table.Column<int>(type: "int", nullable: false),
                    TotalQty = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "สำเร็จ")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockIssueHeader", x => x.StockIssueHeaderId);
                });

            migrationBuilder.CreateTable(
                name: "StockIssueDetail",
                schema: "dbo",
                columns: table => new
                {
                    StockIssueDetailId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StockIssueHeaderId = table.Column<int>(type: "int", nullable: false),
                    LineNo = table.Column<int>(type: "int", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Barcode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CostLot = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StockQty = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MinQty = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockIssueDetail", x => x.StockIssueDetailId);
                    table.ForeignKey(
                        name: "FK_StockIssueDetail_StockIssueHeader_StockIssueHeaderId",
                        column: x => x.StockIssueHeaderId,
                        principalSchema: "dbo",
                        principalTable: "StockIssueHeader",
                        principalColumn: "StockIssueHeaderId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StockIssueDetail_StockIssueHeaderId",
                schema: "dbo",
                table: "StockIssueDetail",
                column: "StockIssueHeaderId");

            migrationBuilder.CreateIndex(
                name: "IX_StockIssueHeader_DocumentNo",
                schema: "dbo",
                table: "StockIssueHeader",
                column: "DocumentNo",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StockIssueDetail",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "StockIssueHeader",
                schema: "dbo");
        }
    }
}
