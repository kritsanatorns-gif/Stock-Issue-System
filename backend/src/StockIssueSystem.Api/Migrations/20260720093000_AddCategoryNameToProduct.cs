using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryNameToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryName",
                schema: "dbo",
                table: "Product",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "General");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CategoryName",
                schema: "dbo",
                table: "Product");
        }
    }
}
