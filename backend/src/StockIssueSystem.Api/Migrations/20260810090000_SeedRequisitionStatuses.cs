using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations;

public partial class SeedRequisitionStatuses : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Status WHERE StatusId = 6)
            BEGIN
                INSERT INTO dbo.Status (StatusId, StatusName, StatusTable, StatusSortOrder, StatusIsActive)
                VALUES (6, N'รอจัดของ', N'Requisition', 6, 1)
            END

            IF NOT EXISTS (SELECT 1 FROM dbo.Status WHERE StatusId = 7)
            BEGIN
                INSERT INTO dbo.Status (StatusId, StatusName, StatusTable, StatusSortOrder, StatusIsActive)
                VALUES (7, N'ได้ของครบ', N'Requisition', 7, 1)
            END

            IF NOT EXISTS (SELECT 1 FROM dbo.Status WHERE StatusId = 8)
            BEGIN
                INSERT INTO dbo.Status (StatusId, StatusName, StatusTable, StatusSortOrder, StatusIsActive)
                VALUES (8, N'ค้าง', N'Requisition', 8, 1)
            END

            IF NOT EXISTS (SELECT 1 FROM dbo.Status WHERE StatusId = 9)
            BEGIN
                INSERT INTO dbo.Status (StatusId, StatusName, StatusTable, StatusSortOrder, StatusIsActive)
                VALUES (9, N'ไม่ให้เบิก', N'Requisition', 9, 1)
            END

            UPDATE dbo.Status
            SET StatusName = N'รอจัดของ',
                StatusTable = N'Requisition',
                StatusSortOrder = 6,
                StatusIsActive = 1
            WHERE StatusId = 6

            UPDATE dbo.Status
            SET StatusName = N'ได้ของครบ',
                StatusTable = N'Requisition',
                StatusSortOrder = 7,
                StatusIsActive = 1
            WHERE StatusId = 7

            UPDATE dbo.Status
            SET StatusName = N'ค้าง',
                StatusTable = N'Requisition',
                StatusSortOrder = 8,
                StatusIsActive = 1
            WHERE StatusId = 8

            UPDATE dbo.Status
            SET StatusName = N'ไม่ให้เบิก',
                StatusTable = N'Requisition',
                StatusSortOrder = 9,
                StatusIsActive = 1
            WHERE StatusId = 9
        """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE dbo.Status
            SET StatusName = N'รอจัดของ',
                StatusTable = N'Requisition',
                StatusSortOrder = 6,
                StatusIsActive = 1
            WHERE StatusId = 6

            UPDATE dbo.Status
            SET StatusName = N'จบงาน',
                StatusTable = N'Requisition',
                StatusSortOrder = 7,
                StatusIsActive = 1
            WHERE StatusId = 7

            UPDATE dbo.Status
            SET StatusName = N'งานค้าง',
                StatusTable = N'Requisition',
                StatusSortOrder = 8,
                StatusIsActive = 1
            WHERE StatusId = 8

            DELETE FROM dbo.Status
            WHERE StatusId = 9
                AND StatusTable = N'Requisition'
        """);
    }
}
