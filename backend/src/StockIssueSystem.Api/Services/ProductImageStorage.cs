namespace StockIssueSystem.Api.Services;

public sealed class ProductImageStorage(IConfiguration configuration, IWebHostEnvironment environment)
{
    // พาธสัมพัทธ์อ้างอิงโฟลเดอร์ API เพื่อใช้ได้ทั้งเครื่องพัฒนาและ IIS
    public string Root
    {
        get
        {
            var path = configuration["ProductImages:Path"];
            if (string.IsNullOrWhiteSpace(path)) path = @"\\pluto\data\PictureCenter\Supplyes\Express";
            return Path.GetFullPath(path, environment.ContentRootPath);
        }
    }

    public async Task<string> SaveAsync(Stream source, string productId, string extension)
    {
        var code = productId.Trim();
        if (string.IsNullOrWhiteSpace(code) || code.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || code is "." or "..")
            throw new ArgumentException("รหัสสินค้าไม่สามารถใช้เป็นชื่อไฟล์รูปได้");
        Directory.CreateDirectory(Root);
        for (var suffix = 0; ; suffix++)
        {
            var name = code + (suffix == 0 ? "" : $"({suffix})") + extension.ToLowerInvariant();
            var path = Path.Combine(Root, name);
            FileStream output;
            try { output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None); }
            catch (IOException) when (File.Exists(path)) { continue; }
            try
            {
                await using (output) { await source.CopyToAsync(output); }
            }
            catch
            {
                // หากเขียนไม่ครบ ลบไฟล์ที่เพิ่งสร้าง ไม่ทิ้งรูปเสียไว้ในแชร์
                File.Delete(path);
                throw;
            }
            return name;
        }
    }
}
