using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations;

public partial class AddUrgentRequisitionFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF COL_LENGTH('dbo.StockHeader', 'IsUrgent') IS NULL
            BEGIN
                ALTER TABLE dbo.StockHeader
                ADD IsUrgent bit NOT NULL CONSTRAINT DF_StockHeader_IsUrgent DEFAULT 0
            END

            IF COL_LENGTH('dbo.StockHeader', 'UrgentRemark') IS NULL
            BEGIN
                ALTER TABLE dbo.StockHeader
                ADD UrgentRemark nvarchar(500) NOT NULL CONSTRAINT DF_StockHeader_UrgentRemark DEFAULT N''
            END
        """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DECLARE @urgentRemarkConstraint sysname;
            SELECT @urgentRemarkConstraint = dc.name
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
            INNER JOIN sys.tables t ON t.object_id = c.object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE s.name = 'dbo'
                AND t.name = 'StockHeader'
                AND c.name = 'UrgentRemark';

            IF COL_LENGTH('dbo.StockHeader', 'UrgentRemark') IS NOT NULL
            BEGIN
                IF @urgentRemarkConstraint IS NOT NULL
                    EXEC('ALTER TABLE dbo.StockHeader DROP CONSTRAINT [' + @urgentRemarkConstraint + ']');

                ALTER TABLE dbo.StockHeader DROP COLUMN UrgentRemark
            END

            DECLARE @isUrgentConstraint sysname;
            SELECT @isUrgentConstraint = dc.name
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
            INNER JOIN sys.tables t ON t.object_id = c.object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE s.name = 'dbo'
                AND t.name = 'StockHeader'
                AND c.name = 'IsUrgent';

            IF COL_LENGTH('dbo.StockHeader', 'IsUrgent') IS NOT NULL
            BEGIN
                IF @isUrgentConstraint IS NOT NULL
                    EXEC('ALTER TABLE dbo.StockHeader DROP CONSTRAINT [' + @isUrgentConstraint + ']');

                ALTER TABLE dbo.StockHeader DROP COLUMN IsUrgent
            END
        """);
    }
}
