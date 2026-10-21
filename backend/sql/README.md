# Purchase product report pilot

## รายงานยอดซื้อแยกตามซัพพลาย

`dbo.usp_ReportPurchaseSupplierLots` ดึงล็อตรับเข้าที่มีซัพพลายและไม่ถูกยกเลิก
รองรับปี เดือน และช่วงวันที่ API รวมยอดและเรียงลำดับเหมือนเดิม ไม่มีการแก้ยอดสต็อก
ติดตั้งด้วย `./sql/install-supplier-report.ps1` ซึ่งสำรอง SP ทั้งสองตัวก่อนแก้
เพิ่มคอมเมนต์ภาษาไทยและทดสอบข้อมูลชั่วคราว 6 กรณี รวมทั้งเทียบข้อมูลจริงกับวิธีเดิม

ย้อนกลับโดยตั้ง `Reports:UsePurchaseSupplierStoredProcedure=false` แล้วรีสตาร์ต API
โค้ด LINQ เดิมยังอยู่ใน Controller ส่วน SP ตัวสินค้าสลับแยกกันด้วย
`Reports:UsePurchaseProductStoredProcedure=false`
ต้องติดตั้ง SP ในฐานข้อมูลปลายทางก่อนนำ API ใหม่ขึ้นใช้งาน

`GET /api/reports/purchases-by-product` now loads its rows using
`dbo.usp_ReportPurchaseProductLots`. The existing C# grouping, ordering and JSON
shape remain unchanged. Other reports and stock mutations are unchanged.

Install on each destination database before deploying the API:

```powershell
./sql/install-purchase-product-report.ps1
```

The script reads the API appsettings.json connection, backs up an existing
procedure (or writes a DROP rollback if newly created), installs inside a
transaction and compares five date filters against the previous query.
Alternatively execute `usp_ReportPurchaseProductLots.sql` in SSMS in the
StockIssueSystem database. The runtime account needs EXECUTE permission.

Run `./sql/verify-purchase-product-fixtures.ps1` for tests with temporary tables
covering date boundaries, cancelled documents/lots, non-receive documents,
multiple lots and zero-cost stock. These tests do not write business tables.

## Switch back

Set `Reports:UsePurchaseProductStoredProcedure` to `false` in configuration
(environment variable `Reports__UsePurchaseProductStoredProcedure=false`) and
restart the API. This runs the original LINQ query still present in the controller.
Switch back before executing the procedure rollback script.

Original controller backup:
`D:\Stock Issue System\.tmp\stored-procedure-backup-20261015-092048\PurchaseReportsController.cs`.
Procedure rollback backups: `D:\Stock Issue System\.tmp\procedure-backups`.

No speed improvement is claimed: the live database had no matching purchase
rows during verification. Test performance with representative data later.
