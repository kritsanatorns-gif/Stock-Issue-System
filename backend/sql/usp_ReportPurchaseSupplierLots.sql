-- ดึงล็อตรับเข้าสำหรับรายงานยอดซื้อแยกตามซัพพลาย อ่านอย่างเดียว ไม่แก้ไขยอดคลัง
-- @Year / @Month: ปี ค.ศ. และเดือนที่ต้องการ; NULL คือไม่กรองเงื่อนไขนั้น
-- @StartDate: ตั้งแต่วันเริ่มต้น รวมวันนั้น; @EndExclusive: ก่อนวันถัดจากวันสิ้นสุด
-- ถ้าระบุหลายตัวกรอง ต้องตรงทุกเงื่อนไข เหมือนรายงานเดิม
-- API ใช้ผลนี้นับใบรับเข้าไม่ซ้ำ นับล็อต รวมจำนวน มูลค่า และ VAT ต่อซัพพลาย
CREATE OR ALTER PROCEDURE dbo.usp_ReportPurchaseSupplierLots
    @Year int = NULL,
    @Month int = NULL,
    @StartDate datetime2 = NULL,
    @EndExclusive datetime2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT lot.SupplierId, lot.SupplierName, lot.ReceiveHeaderId,
           lot.OriginalQty, lot.UnitCost, lot.VatAmount
    FROM dbo.StockCostLot AS lot
    INNER JOIN dbo.StockHeader AS header ON lot.ReceiveHeaderId = header.HeaderId
    WHERE header.DocType = N'RECEIVE'
      -- ตัดเอกสารยกเลิก (4) และล็อตยกเลิก (2) แต่ยังนับล็อตที่เบิกหมดแล้ว
      AND header.Status <> 4 AND lot.Status <> 2
      -- รายงานนี้ใช้เฉพาะล็อตที่มีรหัสซัพพลาย ตามเงื่อนไขเดิม
      AND lot.SupplierId IS NOT NULL
      AND (@Year IS NULL OR YEAR(header.TransactionDate) = @Year)
      AND (@Month IS NULL OR MONTH(header.TransactionDate) = @Month)
      AND (@StartDate IS NULL OR header.TransactionDate >= @StartDate)
      AND (@EndExclusive IS NULL OR header.TransactionDate < @EndExclusive);
END;
