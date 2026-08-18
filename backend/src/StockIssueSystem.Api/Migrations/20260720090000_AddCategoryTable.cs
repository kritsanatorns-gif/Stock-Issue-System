using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations;

public partial class AddCategoryTable : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Category",
            schema: "dbo",
            columns: table => new
            {
                CategoryId = table.Column<int>(type: "int", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                CategoryName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                CategoryStatus = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Category", x => x.CategoryId);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Category_CategoryName",
            schema: "dbo",
            table: "Category",
            column: "CategoryName",
            unique: true);

        migrationBuilder.InsertData(
            schema: "dbo",
            table: "Category",
            columns: new[] { "CategoryName", "CategoryStatus" },
            values: new object[,]
            {
                { "General", 1 },
                { "PPE", 1 },
                { "Packing", 1 },
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "Category",
            schema: "dbo");
    }
}
