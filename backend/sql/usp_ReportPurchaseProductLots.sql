-- ดึงล็อตรับเข้าสำหรับรายงานยอดซื้อแยกตามสินค้า อ่านข้อมูลเท่านั้น ไม่เปลี่ยนสต็อก
-- @StartDate: วันเริ่มต้น (รวมวันนี้), NULL หมายถึงไม่กรองวันเริ่มต้น
-- @EndExclusive: วันถัดจากวันสิ้นสุด (ไม่รวมวันนี้), NULL หมายถึงไม่จำกัดวันสิ้นสุด
-- ส่งจำนวนรับเดิม ต้นทุนต่อหน่วย และ VAT ให้ API รวมยอดและเรียงลำดับแบบเดิม
CREATE OR ALTER PROCEDURE dbo.usp_ReportPurchaseProductLots
    @StartDate datetime2 = NULL,
    @EndExclusive datetime2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT detail.ProductId, detail.ProductName, detail.Category, detail.Unit,
           lot.OriginalQty, lot.UnitCost, lot.VatAmount
    FROM dbo.StockCostLot AS lot
    INNER JOIN dbo.StockDetail AS detail ON lot.ReceiveDetailId = detail.DetailId
    INNER JOIN dbo.StockHeader AS header ON lot.ReceiveHeaderId = header.HeaderId
    WHERE header.DocType = N'RECEIVE'
      -- ไม่นับเอกสารยกเลิก (4) และล็อตยกเลิก (2); ล็อตที่เบิกหมดแล้วยังนับเป็นยอดซื้อ
      AND header.Status <> 4
      AND lot.Status <> 2
      AND (@StartDate IS NULL OR header.TransactionDate >= @StartDate)
      AND (@EndExclusive IS NULL OR header.TransactionDate < @EndExclusive);
END;
