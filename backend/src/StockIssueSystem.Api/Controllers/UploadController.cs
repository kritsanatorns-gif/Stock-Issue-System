using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using System.IO.Compression;
using System.Text.Json;
using System.Xml.Linq;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/uploads")]
public sealed class UploadController(IWebHostEnvironment environment, AppDbContext dbContext) : ControllerBase
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    };

    [HttpPost("products")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UploadProductImage(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("Image file is required.");
        }

        var extension = Path.GetExtension(file.FileName);

        if (!AllowedExtensions.Contains(extension))
        {
            return BadRequest("Only JPG, PNG, and WEBP files are allowed.");
        }

        var uploadsRoot = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads", "products");

        Directory.CreateDirectory(uploadsRoot);

        var fileName = $"{DateTime.Now:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var filePath = Path.Combine(uploadsRoot, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/uploads/products/{fileName}";

        return Ok(new
        {
            FileName = fileName,
            Url = relativeUrl,
        });
    }

    [HttpPost("products-from-excel")]
    [RequestSizeLimit(30 * 1024 * 1024)]
    public async Task<IActionResult> ImportProductImages(IFormFile? file, [FromForm] string? items)
    {
        if (file is null || file.Length == 0 || string.IsNullOrWhiteSpace(items)) return BadRequest("Excel file and item mapping are required.");
        var mappings = JsonSerializer.Deserialize<List<ExcelImageItem>>(items, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        var lookup = mappings.Where(x => !string.IsNullOrWhiteSpace(x.ProductId)).ToDictionary(x => $"{x.SheetName}|{x.RowNo}", x => x.ProductId, StringComparer.OrdinalIgnoreCase);
        var root = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads", "products");
        Directory.CreateDirectory(root);
        var saved = 0;
        await using var input = file.OpenReadStream();
        using var archive = new ZipArchive(input, ZipArchiveMode.Read);
        XNamespace r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
        XNamespace xdr = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
        XNamespace a = "http://schemas.openxmlformats.org/drawingml/2006/main";
        var workbook = XDocument.Load(archive.GetEntry("xl/workbook.xml")!.Open());
        var workbookRels = Relationships(archive, "xl/_rels/workbook.xml.rels");
        foreach (var sheet in workbook.Descendants().Where(x => x.Name.LocalName == "sheet"))
        {
            var sheetName = (string?)sheet.Attribute("name") ?? "";
            var sheetRelationship = workbookRels.GetValueOrDefault((string?)sheet.Attribute(r + "id") ?? "");
            var sheetPath = Resolve("xl/workbook.xml", sheetRelationship?.Target);
            var worksheet = XDocument.Load(archive.GetEntry(sheetPath)!.Open());
            XNamespace spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var defaultHeight = (double?)worksheet.Root?.Element(spreadsheet + "sheetFormatPr")?.Attribute("defaultRowHeight") ?? 15;
            var rowHeights = worksheet.Descendants(spreadsheet + "row")
                .ToDictionary(row => (int)row.Attribute("r")!, row =>
                    (bool?)row.Attribute("hidden") == true ? 0 : ((double?)row.Attribute("ht") ?? defaultHeight) * 12700);
            var sheetRels = Relationships(archive, RelPath(sheetPath));
            var drawingRelationship = sheetRels.Values.FirstOrDefault(x => x.Type.EndsWith("/drawing", StringComparison.OrdinalIgnoreCase));
            var drawingPath = Resolve(sheetPath, drawingRelationship?.Target);
            if (string.IsNullOrEmpty(drawingPath) || archive.GetEntry(drawingPath) is null) continue;
            var drawing = XDocument.Load(archive.GetEntry(drawingPath)!.Open());
            var drawingRels = Relationships(archive, RelPath(drawingPath));
            var bestRowCoverage = new Dictionary<int, double>();
            foreach (var anchor in drawing.Descendants().Where(x => x.Name == xdr + "twoCellAnchor" || x.Name == xdr + "oneCellAnchor"))
            {
                var firstRow = int.TryParse(anchor.Element(xdr + "from")?.Element(xdr + "row")?.Value, out var zeroRow) ? zeroRow + 1 : 0;
                var lastRow = int.TryParse(anchor.Element(xdr + "to")?.Element(xdr + "row")?.Value, out var zeroEndRow)
                    ? Math.Max(firstRow, zeroEndRow + 1)
                    : firstRow;
                if (anchor.Name == xdr + "oneCellAnchor" && firstRow > 0)
                {
                    // Excel stores this anchor's size in EMUs, not an ending row.
                    // One point = 12700 EMUs. Account for custom/hidden row heights.
                    var remainingHeight = ((double?)anchor.Element(xdr + "from")?.Element(xdr + "rowOff") ?? 0)
                        + ((double?)anchor.Element(xdr + "ext")?.Attribute("cy") ?? 0);
                    while (lastRow < 1048576)
                    {
                        remainingHeight -= rowHeights.GetValueOrDefault(lastRow, defaultHeight * 12700);
                        if (remainingHeight <= 0) break;
                        lastRow++;
                    }
                }
                else if (lastRow > firstRow && (long?)anchor.Element(xdr + "to")?.Element(xdr + "rowOff") == 0)
                {
                    // An image ending exactly at a row boundary excludes that row.
                    lastRow--;
                }
                var embed = anchor.Descendants(a + "blip").Select(x => (string?)x.Attribute(r + "embed")).FirstOrDefault();
                var rowCoverage = new Dictionary<int, double>();
                if (anchor.Name == xdr + "oneCellAnchor")
                {
                    var imageTop = (double?)anchor.Element(xdr + "from")?.Element(xdr + "rowOff") ?? 0;
                    var imageBottom = imageTop + ((double?)anchor.Element(xdr + "ext")?.Attribute("cy") ?? 0);
                    double rowTop = 0;
                    for (var row = firstRow; row <= lastRow; row++)
                    {
                        var rowHeight = rowHeights.GetValueOrDefault(row, defaultHeight * 12700);
                        rowCoverage[row] = Math.Max(0, Math.Min(rowTop + rowHeight, imageBottom) - Math.Max(rowTop, imageTop));
                        rowTop += rowHeight;
                    }
                }
                var productIds = Enumerable.Range(firstRow, lastRow - firstRow + 1)
                    .Where(row =>
                    {
                        var coverage = rowCoverage.GetValueOrDefault(row, rowHeights.GetValueOrDefault(row, defaultHeight * 12700));
                        if (coverage <= bestRowCoverage.GetValueOrDefault(row)) return false;
                        bestRowCoverage[row] = coverage;
                        return true;
                    })
                    .Select(row => lookup.GetValueOrDefault($"{sheetName}|{row}"))
                    .Where(productId => !string.IsNullOrWhiteSpace(productId))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (productIds.Count == 0 || string.IsNullOrEmpty(embed) || !drawingRels.TryGetValue(embed, out var imageRel)) continue;
                var image = archive.GetEntry(Resolve(drawingPath, imageRel.Target));
                if (image is null || !AllowedExtensions.Contains(Path.GetExtension(image.FullName))) continue;
                var name = $"{DateTime.Now:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{Path.GetExtension(image.FullName).ToLowerInvariant()}";
                await using (var output = System.IO.File.Create(Path.Combine(root, name))) await using (var source = image.Open()) await source.CopyToAsync(output);
                var products = await dbContext.Products.Where(x => productIds.Contains(x.ProductId)).ToListAsync();
                foreach (var product in products)
                {
                    product.Img = name;
                    saved++;
                }
            }
        }
        await dbContext.SaveChangesAsync();
        return Ok(new { SavedCount = saved });
    }

    private sealed record ExcelImageItem(string SheetName, int RowNo, string ProductId);
    private sealed record Relationship(string Target, string Type);
    private static Dictionary<string, Relationship> Relationships(ZipArchive archive, string path) => archive.GetEntry(path) is null ? [] : XDocument.Load(archive.GetEntry(path)!.Open()).Descendants().Where(x => x.Name.LocalName == "Relationship").ToDictionary(x => (string?)x.Attribute("Id") ?? "", x => new Relationship((string?)x.Attribute("Target") ?? "", (string?)x.Attribute("Type") ?? ""));
    private static string RelPath(string path) => $"{Path.GetDirectoryName(path)!.Replace('\\', '/')}/_rels/{Path.GetFileName(path)}.rels";
    private static string Resolve(string source, string? target) => string.IsNullOrWhiteSpace(target) ? "" : new Uri(new Uri("http://local/" + source), target).AbsolutePath.TrimStart('/');
}
