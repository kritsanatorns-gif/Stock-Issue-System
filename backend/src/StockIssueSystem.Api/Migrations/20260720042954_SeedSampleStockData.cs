using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockIssueSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedSampleStockData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                SET NOCOUNT ON;

                IF NOT EXISTS (SELECT 1 FROM dbo.Product WHERE ProductId = 'PPE-GLOVE-NBR-M')
                BEGIN
                    INSERT INTO dbo.Product (ProductId, ProductName, Unit, Barcode, Img, Status, CreatedDate, CreatedName)
                    VALUES ('PPE-GLOVE-NBR-M', N'ถุงมือไนไตร M', N'แพ็ค', 'PPE001M', '', 'Active', GETDATE(), 'seed');
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.StockBalance WHERE ProductId = 'PPE-GLOVE-NBR-M' AND LocationId = 'MAIN')
                BEGIN
                    INSERT INTO dbo.StockBalance (ProductId, LocationId, Qty, LastUpdate)
                    VALUES ('PPE-GLOVE-NBR-M', 'MAIN', 48, GETDATE());
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.Product WHERE ProductId = 'PPE-MASK-3M-9001')
                BEGIN
                    INSERT INTO dbo.Product (ProductId, ProductName, Unit, Barcode, Img, Status, CreatedDate, CreatedName)
                    VALUES ('PPE-MASK-3M-9001', N'หน้ากาก 3M 9001', N'ชิ้น', 'PPE009001', '', 'Active', GETDATE(), 'seed');
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.StockBalance WHERE ProductId = 'PPE-MASK-3M-9001' AND LocationId = 'MAIN')
                BEGIN
                    INSERT INTO dbo.StockBalance (ProductId, LocationId, Qty, LastUpdate)
                    VALUES ('PPE-MASK-3M-9001', 'MAIN', 8, GETDATE());
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.Product WHERE ProductId = 'TAPE-OPP-2IN')
                BEGIN
                    INSERT INTO dbo.Product (ProductId, ProductName, Unit, Barcode, Img, Status, CreatedDate, CreatedName)
                    VALUES ('TAPE-OPP-2IN', N'เทป OPP 2 นิ้ว', N'ม้วน', 'PKG002', '', 'Active', GETDATE(), 'seed');
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.StockBalance WHERE ProductId = 'TAPE-OPP-2IN' AND LocationId = 'MAIN')
                BEGIN
                    INSERT INTO dbo.StockBalance (ProductId, LocationId, Qty, LastUpdate)
                    VALUES ('TAPE-OPP-2IN', 'MAIN', 12, GETDATE());
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.Product WHERE ProductId = 'BAG-ZIP-8X12')
                BEGIN
                    INSERT INTO dbo.Product (ProductId, ProductName, Unit, Barcode, Img, Status, CreatedDate, CreatedName)
                    VALUES ('BAG-ZIP-8X12', N'ถุงซิป 8x12', N'แพ็ค', 'PKG0812', '', 'Active', GETDATE(), 'seed');
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.StockBalance WHERE ProductId = 'BAG-ZIP-8X12' AND LocationId = 'MAIN')
                BEGIN
                    INSERT INTO dbo.StockBalance (ProductId, LocationId, Qty, LastUpdate)
                    VALUES ('BAG-ZIP-8X12', 'MAIN', 450, GETDATE());
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.Product WHERE ProductId = 'TOOL-CUTTER-L')
                BEGIN
                    INSERT INTO dbo.Product (ProductId, ProductName, Unit, Barcode, Img, Status, CreatedDate, CreatedName)
                    VALUES ('TOOL-CUTTER-L', N'คัตเตอร์ใหญ่', N'ชิ้น', 'TOOL001', '', 'Active', GETDATE(), 'seed');
                END;

                IF NOT EXISTS (SELECT 1 FROM dbo.StockBalance WHERE ProductId = 'TOOL-CUTTER-L' AND LocationId = 'MAIN')
                BEGIN
                    INSERT INTO dbo.StockBalance (ProductId, LocationId, Qty, LastUpdate)
                    VALUES ('TOOL-CUTTER-L', 'MAIN', 0, GETDATE());
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE balance
                FROM dbo.StockBalance balance
                INNER JOIN dbo.Product product ON product.ProductId = balance.ProductId
                WHERE product.CreatedName = 'seed'
                    AND balance.LocationId = 'MAIN'
                    AND balance.ProductId IN (
                        'PPE-GLOVE-NBR-M',
                        'PPE-MASK-3M-9001',
                        'TAPE-OPP-2IN',
                        'BAG-ZIP-8X12',
                        'TOOL-CUTTER-L'
                    );

                DELETE FROM dbo.Product
                WHERE CreatedName = 'seed'
                    AND ProductId IN (
                        'PPE-GLOVE-NBR-M',
                        'PPE-MASK-3M-9001',
                        'TAPE-OPP-2IN',
                        'BAG-ZIP-8X12',
                        'TOOL-CUTTER-L'
                    );
                """);
        }
    }
}
