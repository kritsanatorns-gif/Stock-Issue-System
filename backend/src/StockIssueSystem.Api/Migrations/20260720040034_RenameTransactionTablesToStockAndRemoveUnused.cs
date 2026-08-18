using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameTransactionTablesToStockAndRemoveUnused : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "login");

            migrationBuilder.DropTable(
                name: "StockIssueDetail",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "StockIssueHeader",
                schema: "dbo");

            migrationBuilder.DropForeignKey(
                name: "FK_TransactionDetail_TransactionHeader_HeaderId",
                schema: "dbo",
                table: "TransactionDetail");

            migrationBuilder.DropPrimaryKey(
                name: "PK_TransactionDetail",
                schema: "dbo",
                table: "TransactionDetail");

            migrationBuilder.DropPrimaryKey(
                name: "PK_TransactionHeader",
                schema: "dbo",
                table: "TransactionHeader");

            migrationBuilder.RenameTable(
                name: "TransactionHeader",
                schema: "dbo",
                newName: "StockHeader",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "TransactionDetail",
                schema: "dbo",
                newName: "StockDetail",
                newSchema: "dbo");

            migrationBuilder.RenameIndex(
                name: "IX_TransactionHeader_DocNo",
                schema: "dbo",
                table: "StockHeader",
                newName: "IX_StockHeader_DocNo");

            migrationBuilder.RenameIndex(
                name: "IX_TransactionDetail_HeaderId",
                schema: "dbo",
                table: "StockDetail",
                newName: "IX_StockDetail_HeaderId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_StockHeader",
                schema: "dbo",
                table: "StockHeader",
                column: "HeaderId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_StockDetail",
                schema: "dbo",
                table: "StockDetail",
                column: "DetailId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockDetail_StockHeader_HeaderId",
                schema: "dbo",
                table: "StockDetail",
                column: "HeaderId",
                principalSchema: "dbo",
                principalTable: "StockHeader",
                principalColumn: "HeaderId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockDetail_StockHeader_HeaderId",
                schema: "dbo",
                table: "StockDetail");

            migrationBuilder.DropPrimaryKey(
                name: "PK_StockDetail",
                schema: "dbo",
                table: "StockDetail");

            migrationBuilder.DropPrimaryKey(
                name: "PK_StockHeader",
                schema: "dbo",
                table: "StockHeader");

            migrationBuilder.RenameTable(
                name: "StockHeader",
                schema: "dbo",
                newName: "TransactionHeader",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "StockDetail",
                schema: "dbo",
                newName: "TransactionDetail",
                newSchema: "dbo");

            migrationBuilder.RenameIndex(
                name: "IX_StockHeader_DocNo",
                schema: "dbo",
                table: "TransactionHeader",
                newName: "IX_TransactionHeader_DocNo");

            migrationBuilder.RenameIndex(
                name: "IX_StockDetail_HeaderId",
                schema: "dbo",
                table: "TransactionDetail",
                newName: "IX_TransactionDetail_HeaderId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TransactionHeader",
                schema: "dbo",
                table: "TransactionHeader",
                column: "HeaderId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TransactionDetail",
                schema: "dbo",
                table: "TransactionDetail",
                column: "DetailId");

            migrationBuilder.AddForeignKey(
                name: "FK_TransactionDetail_TransactionHeader_HeaderId",
                schema: "dbo",
                table: "TransactionDetail",
                column: "HeaderId",
                principalSchema: "dbo",
                principalTable: "TransactionHeader",
                principalColumn: "HeaderId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.CreateTable(
                name: "login",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EmployeeCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_login", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_login_EmployeeCode",
                table: "login",
                column: "EmployeeCode",
                unique: true);
        }
    }
}
