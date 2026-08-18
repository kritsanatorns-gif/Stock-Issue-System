using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    public partial class SeedStockHeaderStatuses : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (
                    SELECT 1
                    FROM sys.columns columns
                    INNER JOIN sys.tables tables
                        ON columns.object_id = tables.object_id
                    INNER JOIN sys.schemas schemas
                        ON tables.schema_id = schemas.schema_id
                    WHERE schemas.name = N'dbo'
                        AND tables.name = N'Status'
                        AND columns.name = N'StatusTable'
                        AND columns.max_length < 100
                )
                BEGIN
                    ALTER TABLE dbo.Status ALTER COLUMN StatusTable nvarchar(50) NULL
                END

                IF NOT EXISTS (SELECT 1 FROM dbo.Status WHERE StatusId = 3)
                BEGIN
                    INSERT INTO dbo.Status (StatusId, StatusName, StatusTable, StatusSortOrder, StatusIsActive)
                    VALUES (3, N'สำเร็จ', N'StockHeader', 3, 1)
                END

                IF NOT EXISTS (SELECT 1 FROM dbo.Status WHERE StatusId = 4)
                BEGIN
                    INSERT INTO dbo.Status (StatusId, StatusName, StatusTable, StatusSortOrder, StatusIsActive)
                    VALUES (4, N'ถอยยอด', N'StockHeader', 4, 1)
                END

                IF NOT EXISTS (SELECT 1 FROM dbo.Status WHERE StatusId = 5)
                BEGIN
                    INSERT INTO dbo.Status (StatusId, StatusName, StatusTable, StatusSortOrder, StatusIsActive)
                    VALUES (5, N'ถอยยอดบางส่วน', N'StockHeader', 5, 1)
                END

                UPDATE dbo.Status
                SET StatusName = N'สำเร็จ',
                    StatusTable = N'StockHeader',
                    StatusSortOrder = 3,
                    StatusIsActive = 1
                WHERE StatusId = 3

                UPDATE dbo.Status
                SET StatusName = N'ถอยยอด',
                    StatusTable = N'StockHeader',
                    StatusSortOrder = 4,
                    StatusIsActive = 1
                WHERE StatusId = 4

                UPDATE dbo.Status
                SET StatusName = N'ถอยยอดบางส่วน',
                    StatusTable = N'StockHeader',
                    StatusSortOrder = 5,
                    StatusIsActive = 1
                WHERE StatusId = 5

                UPDATE dbo.StockHeader
                SET Status = CASE Status
                    WHEN 1 THEN 3
                    WHEN 2 THEN 4
                    WHEN 101 THEN 3
                    WHEN 102 THEN 4
                    ELSE Status
                END
                WHERE Status IN (1, 2, 101, 102)

                DELETE FROM dbo.Status
                WHERE StatusId IN (101, 102)
                    AND StatusTable = N'StockHeader'
            """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE dbo.StockHeader
                SET Status = CASE Status
                    WHEN 3 THEN 1
                    WHEN 4 THEN 2
                    ELSE Status
                END
                WHERE Status IN (3, 4)

                DELETE FROM dbo.Status
                WHERE StatusId IN (3, 4, 5)
                    AND StatusTable = N'StockHeader'
            """);
        }
    }
}
