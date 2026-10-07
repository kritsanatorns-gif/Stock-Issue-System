using StockIssueSystem.Api.Models;

namespace StockIssueSystem.Api.Services;

public static class ProductReadiness
{
    public static string? Validate(Product product)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(product.ReceiveUnit) || product.ReceiveUnit.Trim() == "-") missing.Add("หน่วยรับเข้า");
        if (string.IsNullOrWhiteSpace(product.IssueUnit) || product.IssueUnit.Trim() == "-") missing.Add("หน่วยเบิก");
        if (product.ConversionQty <= 0) missing.Add("อัตราแปลงที่มากกว่า 0");
        return missing.Count == 0 ? null
            : $"สินค้า {product.ProductId} ({product.ProductName}) ยังไม่พร้อมใช้งาน: ขาด {string.Join(", ", missing)} กรุณาให้เจ้าหน้าที่ไปที่ สินค้า > แก้ไข กรอกข้อมูลให้ครบก่อนรับเข้าหรือเบิก";
    }
}
