using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StockIssueSystem.Api.Data;

#nullable disable

namespace StockIssueSystem.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260820090000_AddPoInvoiceNoToStockHeader")]
public partial class AddPoInvoiceNoToStockHeader : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF COL_LENGTH('dbo.StockHeader', 'PoInvoiceNo') IS NULL
            BEGIN
                ALTER TABLE dbo.StockHeader
                ADD PoInvoiceNo nvarchar(100) NOT NULL
                    CONSTRAINT DF_StockHeader_PoInvoiceNo DEFAULT N''
            END
        """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DECLARE @constraintName sysname;
            SELECT @constraintName = dc.name
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
            INNER JOIN sys.tables t ON t.object_id = c.object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE s.name = 'dbo'
              AND t.name = 'StockHeader'
              AND c.name = 'PoInvoiceNo';

            IF COL_LENGTH('dbo.StockHeader', 'PoInvoiceNo') IS NOT NULL
            BEGIN
                IF @constraintName IS NOT NULL
                    EXEC('ALTER TABLE dbo.StockHeader DROP CONSTRAINT [' + @constraintName + ']');

                ALTER TABLE dbo.StockHeader DROP COLUMN PoInvoiceNo;
            END
        """);
    }
}
