using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.RegularExpressions;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(AppDbContext dbContext) : ControllerBase
{
    private const int DefaultMinQty = 10;
    private const string MainLocationId = "MAIN";
    private const string IssueDocType = "ISSUE";
    private const string ReceiveDocType = "RECEIVE";
    private static readonly Regex CodePattern = new(@"^[A-Za-z0-9._/-]+$", RegexOptions.Compiled);
    private static readonly Regex PlainNamePattern = new(@"^[A-Za-z0-9\u0E00-\u0E7F\s.,_/#()+""'-]+$", RegexOptions.Compiled);

    [HttpGet]
    public async Task<IActionResult> GetProducts([FromQuery] string? search, [FromQuery] int? supplierId)
    {
        var query = dbContext.Products.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();

            query = query.Where(product =>
                product.ProductId.Contains(keyword)
                || product.ProductName.Contains(keyword)
                || product.Barcode.Contains(keyword));
        }

        if (supplierId is > 0)
        {
            query = query.Where(product => dbContext.StockCostLots.Any(lot =>
                lot.ProductId == product.ProductId
                && lot.SupplierId == supplierId
                && lot.Status != 2));
        }

        var productRows = await query
            .GroupJoin(
                dbContext.StockBalances.AsNoTracking().Where(balance => balance.LocationId == MainLocationId),
                product => product.ProductId,
                balance => balance.ProductId,
                (product, balances) => new
                {
                    Product = product,
                    Balance = balances.FirstOrDefault(),
                })
            .OrderBy(row => row.Product.ProductId)
            .Select(row => new
            {
                Id = row.Product.ProductId,
                Code = row.Product.ProductId,
                ProductId = row.Product.ProductId,
                Barcode = row.Product.Barcode,
                Name = row.Product.ProductName,
                ProductName = row.Product.ProductName,
                Category = row.Product.CategoryName,
                CategoryName = row.Product.CategoryName,
                Unit = row.Product.IssueUnit,
                IssueUnit = row.Product.IssueUnit,
                ReceiveUnit = row.Product.ReceiveUnit,
                ConversionQty = row.Product.ConversionQty <= 0 ? 1 : row.Product.ConversionQty,
                StockQty = row.Balance == null ? 0 : row.Balance.Qty,
                MinQty = row.Product.MinQty,
                LocationId = row.Balance == null ? MainLocationId : row.Balance.LocationId,
                ImageName = row.Product.Img,
                ProductRemark = row.Product.ProductRemark,
                LastRemark = dbContext.StockDetails
                    .Where(detail => detail.ProductId == row.Product.ProductId)
                    .Join(
                        dbContext.StockHeaders,
                        detail => detail.HeaderId,
                        header => header.HeaderId,
                        (detail, header) => new
                        {
                            header.DocType,
                            header.Remark,
                            header.Status,
                            header.TransactionDate,
                        })
                    .Where(item =>
                        item.Remark != ""
                        && item.Remark != "Import Excel"
                        && (item.DocType != IssueDocType
                            || item.Status == StockHeaderStatuses.Cancelled
                            || item.Status == StockHeaderStatuses.PartiallyCancelled))
                    .OrderByDescending(item => item.TransactionDate)
                    .Select(item => item.Remark)
                    .FirstOrDefault() ?? string.Empty,
                LastRemarkSource = dbContext.StockDetails
                    .Where(detail => detail.ProductId == row.Product.ProductId)
                    .Join(
                        dbContext.StockHeaders,
                        detail => detail.HeaderId,
                        header => header.HeaderId,
                        (detail, header) => new
                        {
                            header.DocType,
                            header.Remark,
                            header.Status,
                            header.TransactionDate,
                        })
                    .Where(item =>
                        item.Remark != ""
                        && item.Remark != "Import Excel"
                        && (item.DocType != IssueDocType
                            || item.Status == StockHeaderStatuses.Cancelled
                            || item.Status == StockHeaderStatuses.PartiallyCancelled))
                    .OrderByDescending(item => item.TransactionDate)
                    .Select(item =>
                        item.Status == StockHeaderStatuses.Cancelled && item.DocType == IssueDocType ? "ถอยยอดใบเบิก"
                        : item.Status == StockHeaderStatuses.Cancelled && item.DocType == ReceiveDocType ? "ถอยยอดรับเข้า"
                        : item.Status == StockHeaderStatuses.PartiallyCancelled && item.DocType == IssueDocType ? "ถอยยอดใบเบิกบางส่วน"
                        : item.Status == StockHeaderStatuses.PartiallyCancelled && item.DocType == ReceiveDocType ? "ถอยยอดรับเข้าบางส่วน"
                        : item.Status == StockHeaderStatuses.Cancelled ? "ถอยยอด"
                        : item.Status == StockHeaderStatuses.PartiallyCancelled ? "ถอยยอดบางส่วน"
                        : item.DocType == "ADJUST" ? "ปรับสต๊อก"
                        : item.DocType == ReceiveDocType ? "รับเข้า"
                        : item.DocType)
                    .FirstOrDefault() ?? string.Empty,
                LastReceiveQty = dbContext.StockDetails
                    .Where(detail => detail.ProductId == row.Product.ProductId)
                    .Join(
                        dbContext.StockHeaders,
                        detail => detail.HeaderId,
                        header => header.HeaderId,
                        (detail, header) => new
                        {
                            detail.Qty,
                            detail.ReceiveQty,
                            header.DocType,
                            header.TransactionDate,
                        })
                    .Where(item => item.DocType == ReceiveDocType)
                    .OrderByDescending(item => item.TransactionDate)
                    .Select(item => (decimal?)(item.ReceiveQty ?? item.Qty))
                    .FirstOrDefault()
                    ?? dbContext.StockCostLots
                        .Where(lot => lot.ProductId == row.Product.ProductId)
                        .OrderByDescending(lot => lot.CreatedDate)
                        .ThenByDescending(lot => lot.CostLotId)
                        .Select(lot => (decimal?)lot.OriginalQty / (row.Product.ConversionQty <= 0 ? 1 : row.Product.ConversionQty))
                        .FirstOrDefault()
                    ?? 0,
                TotalReceiveQty = dbContext.StockDetails
                    .Where(detail => detail.ProductId == row.Product.ProductId)
                    .Join(
                        dbContext.StockHeaders,
                        detail => detail.HeaderId,
                        header => header.HeaderId,
                        (detail, header) => new
                        {
                            detail.Qty,
                            detail.ReceiveQty,
                            header.DocType,
                            header.Status,
                        })
                    .Where(item =>
                        item.DocType == ReceiveDocType
                        && item.Status != StockHeaderStatuses.Cancelled)
                    .Sum(item => (decimal?)(item.ReceiveQty ?? item.Qty)) ?? 0,
                FallbackTotalReceiveQty = dbContext.StockCostLots
                    .Where(lot => lot.ProductId == row.Product.ProductId && lot.Status == 1)
                    .Sum(lot => (decimal?)lot.OriginalQty) / (row.Product.ConversionQty <= 0 ? 1 : row.Product.ConversionQty) ?? 0,
                Status = row.Product.Status,
                ReceiveHint = string.Empty,
                CostLot = string.Empty,
                RequestQty = 1,
            })
            .ToListAsync();

        var productIds = productRows.Select(row => row.ProductId).ToList();
        var costLotsByProductId = await GetActiveCostLotsByProductIds(productIds);
        var fallbackLotsByProductId = await GetFallbackCostLotsByProductIds(
            productIds,
            productRows.ToDictionary(row => row.ProductId, row => row.StockQty));

        var rows = productRows.Select(row =>
        {
            var activeLots = costLotsByProductId.GetValueOrDefault(row.ProductId) ?? [];
            var fallbackLots = fallbackLotsByProductId.GetValueOrDefault(row.ProductId) ?? [];
            var lots = activeLots.Any(lot => lot.RemainingQty > 0 && lot.UnitCost > 0)
                ? activeLots
                : fallbackLots;

            return new
            {
                row.Id,
                row.Code,
                row.ProductId,
                row.Barcode,
                row.Name,
                row.ProductName,
                row.Category,
                row.CategoryName,
                row.Unit,
                row.IssueUnit,
                row.ReceiveUnit,
                row.ConversionQty,
                row.StockQty,
                row.MinQty,
                row.LocationId,
                row.ImageName,
                row.ProductRemark,
                row.LastReceiveQty,
                TotalReceiveQty = row.TotalReceiveQty > 0 ? row.TotalReceiveQty : row.FallbackTotalReceiveQty,
                CurrentUnitCost = lots
                    .Where(lot => lot.RemainingQty > 0)
                    .OrderBy(lot => lot.ReceiveDate)
                    .ThenBy(lot => lot.CostLotId)
                    .Select(lot => lot.UnitCost)
                    .FirstOrDefault(),
                LatestUnitCost = lots
                    .OrderByDescending(lot => lot.ReceiveDate)
                    .ThenByDescending(lot => lot.CostLotId)
                    .Select(lot => lot.UnitCost)
                    .FirstOrDefault(),
                RemainingCostValue = lots.Sum(lot => lot.RemainingCostValue),
                LastRemark = CleanDocumentRemark(row.LastRemark),
                row.LastRemarkSource,
                row.Status,
                row.ReceiveHint,
                row.CostLot,
                row.RequestQty,
            };
        }).ToList();

        return Ok(rows);
    }

    private static string CleanDocumentRemark(string remark)
    {
        if (string.IsNullOrWhiteSpace(remark)
            || string.Equals(remark.Trim(), "Import Excel", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        var cancelIndex = remark.LastIndexOf("Cancel:", StringComparison.OrdinalIgnoreCase);

        if (cancelIndex >= 0)
        {
            return remark[(cancelIndex + "Cancel:".Length)..].Trim();
        }

        return remark.Trim();
    }

    [HttpGet("{productId}/cost-lots")]
    public async Task<IActionResult> GetProductCostLots(string productId)
    {
        var product = await dbContext.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.ProductId == productId);

        if (product is null)
        {
            return NotFound("Product not found.");
        }

        var lots = await dbContext.StockCostLots
            .AsNoTracking()
            .Where(lot => lot.ProductId == productId && lot.RemainingQty > 0 && lot.Status == 1)
            .OrderBy(lot => lot.CreatedDate)
            .ThenBy(lot => lot.CostLotId)
            .Select(lot => new ProductCostLotView
            {
                CostLotId = lot.CostLotId,
                ProductId = lot.ProductId,
                ReceiveDate = lot.CreatedDate,
                ReceiveHeaderId = lot.ReceiveHeaderId,
                ReceiveDetailId = lot.ReceiveDetailId,
                OriginalQty = lot.OriginalQty,
                RemainingQty = lot.RemainingQty,
                SupplierId = lot.SupplierId,
                SupplierName = lot.SupplierName,
                UnitCost = lot.UnitCost,
            })
            .ToListAsync();

        if (lots.Count == 0 || lots.All(lot => lot.UnitCost <= 0))
        {
            var balanceQty = await dbContext.StockBalances
                .AsNoTracking()
                .Where(balance => balance.ProductId == productId && balance.LocationId == MainLocationId)
                .Select(balance => balance.Qty)
                .FirstOrDefaultAsync();
            var fallbackLots = await GetFallbackCostLotsByProductIds([productId], new Dictionary<string, int>
            {
                [productId] = balanceQty,
            });

            lots = fallbackLots.GetValueOrDefault(productId) ?? [];
        }

        await PopulateSupplierDetails(lots);

        var totalRemainingQty = lots.Sum(lot => lot.RemainingQty);
        var totalRemainingCostValue = lots.Sum(lot => lot.RemainingCostValue);
        var averageUnitCost = totalRemainingQty <= 0
            ? 0
            : Math.Round(totalRemainingCostValue / totalRemainingQty, 2);
        var supplierSummaries = lots
            .GroupBy(lot => new
            {
                lot.SupplierId,
                SupplierName = string.IsNullOrWhiteSpace(lot.SupplierName)
                    ? "ไม่ระบุผู้ขาย"
                    : lot.SupplierName,
            })
            .Select(group =>
            {
                var supplierRemainingQty = group.Sum(lot => lot.RemainingQty);
                var supplierRemainingCostValue = group.Sum(lot => lot.RemainingCostValue);
                var latestLot = group
                    .OrderByDescending(lot => lot.ReceiveDate)
                    .ThenByDescending(lot => lot.CostLotId)
                    .First();

                return new
                {
                    group.Key.SupplierId,
                    group.Key.SupplierName,
                    TotalLots = group.Count(),
                    TotalRemainingQty = supplierRemainingQty,
                    AverageUnitCost = supplierRemainingQty <= 0
                        ? 0
                        : Math.Round(supplierRemainingCostValue / supplierRemainingQty, 2),
                    LatestUnitCost = latestLot.UnitCost,
                    LatestReceiveDate = latestLot.ReceiveDate,
                    TotalRemainingCostValue = supplierRemainingCostValue,
                };
            })
            .OrderByDescending(summary => summary.TotalRemainingCostValue)
            .ThenBy(summary => summary.SupplierName)
            .ToList();

        return Ok(new
        {
            ProductId = product.ProductId,
            ProductName = product.ProductName,
            IssueUnit = product.IssueUnit,
            TotalLots = lots.Count,
            TotalRemainingQty = totalRemainingQty,
            AverageUnitCost = averageUnitCost,
            TotalRemainingCostValue = totalRemainingCostValue,
            SupplierSummaries = supplierSummaries,
            Lots = lots,
        });
    }

    [HttpGet("{productId}/movements")]
    public async Task<IActionResult> GetProductMovements(string productId)
    {
        var product = await dbContext.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.ProductId == productId);

        if (product is null)
        {
            return NotFound("Product not found.");
        }

        var receiveRows = await dbContext.StockDetails
            .AsNoTracking()
            .Where(detail => detail.ProductId == productId)
            .Join(
                dbContext.StockHeaders.AsNoTracking().Where(header =>
                    header.DocType == ReceiveDocType
                    && header.Status != StockHeaderStatuses.Cancelled),
                detail => detail.HeaderId,
                header => header.HeaderId,
                (detail, header) => new
                {
                    Date = header.TransactionDate,
                    DateText = header.TransactionDate.ToString("dd/MM/yyyy HH:mm"),
                    detail.DetailId,
                    detail.HeaderId,
                    Qty = detail.Qty,
                    Unit = detail.Unit,
                    ReceiveQty = detail.ReceiveQty,
                    ReceiveUnit = detail.ReceiveUnit,
                    detail.CostLot,
                    header.EmployeeId,
                    header.Remark,
                    Status = "รับเข้า",
                })
            .OrderByDescending(row => row.Date)
            .ThenByDescending(row => row.DetailId)
            .ToListAsync();

        var issueRows = await dbContext.StockDetails
            .AsNoTracking()
            .Where(detail => detail.ProductId == productId)
            .Join(
                dbContext.StockHeaders.AsNoTracking().Where(header =>
                    header.DocType == IssueDocType
                    && header.Status != StockHeaderStatuses.Cancelled),
                detail => detail.HeaderId,
                header => header.HeaderId,
                (detail, header) => new
                {
                    Date = header.TransactionDate,
                    DateText = header.TransactionDate.ToString("dd/MM/yyyy HH:mm"),
                    detail.DetailId,
                    detail.HeaderId,
                    Qty = detail.Qty,
                    Unit = detail.Unit,
                    Department = header.Remark,
                    header.EmployeeId,
                    header.Remark,
                    Status = "เบิกสินค้า",
                })
            .OrderByDescending(row => row.Date)
            .ThenByDescending(row => row.DetailId)
            .ToListAsync();

        return Ok(new
        {
            ProductId = product.ProductId,
            ProductName = product.ProductName,
            TotalInCount = receiveRows.Count,
            TotalOutCount = issueRows.Count,
            TotalInQty = receiveRows.Sum(row => row.Qty),
            TotalOutQty = issueRows.Sum(row => row.Qty),
            Receives = receiveRows,
            Issues = issueRows,
        });
    }

    private async Task<Dictionary<string, List<ProductCostLotView>>> GetActiveCostLotsByProductIds(IReadOnlyCollection<string> productIds)
    {
        if (productIds.Count == 0)
        {
            return [];
        }

        var lots = await dbContext.StockCostLots
            .AsNoTracking()
            .Where(lot => productIds.Contains(lot.ProductId) && lot.RemainingQty > 0 && lot.Status == 1)
            .OrderBy(lot => lot.CreatedDate)
            .ThenBy(lot => lot.CostLotId)
            .Select(lot => new ProductCostLotView
            {
                CostLotId = lot.CostLotId,
                OriginalQty = lot.OriginalQty,
                ProductId = lot.ProductId,
                ReceiveDate = lot.CreatedDate,
                ReceiveDetailId = lot.ReceiveDetailId,
                ReceiveHeaderId = lot.ReceiveHeaderId,
                RemainingQty = lot.RemainingQty,
                SupplierId = lot.SupplierId,
                SupplierName = lot.SupplierName,
                UnitCost = lot.UnitCost,
            })
            .ToListAsync();

        return lots
            .GroupBy(lot => lot.ProductId)
            .ToDictionary(group => group.Key, group => group.ToList());
    }

    private async Task<Dictionary<string, List<ProductCostLotView>>> GetFallbackCostLotsByProductIds(
        IReadOnlyCollection<string> productIds,
        IReadOnlyDictionary<string, int> balanceQtyByProductId)
    {
        if (productIds.Count == 0)
        {
            return [];
        }

        var receiveDetails = await dbContext.StockDetails
            .AsNoTracking()
            .Where(detail => productIds.Contains(detail.ProductId) && detail.CostLot != "")
            .Join(
                dbContext.StockHeaders.AsNoTracking().Where(header => header.DocType == ReceiveDocType),
                detail => detail.HeaderId,
                header => header.HeaderId,
                (detail, header) => new
                {
                    Detail = detail,
                    header.TransactionDate,
                })
            .OrderByDescending(row => row.TransactionDate)
            .ThenByDescending(row => row.Detail.DetailId)
            .ToListAsync();

        var lotsByProductId = new Dictionary<string, List<ProductCostLotView>>();

        foreach (var group in receiveDetails.GroupBy(row => row.Detail.ProductId))
        {
            var remainingBalanceQty = balanceQtyByProductId.GetValueOrDefault(group.Key);
            var productLots = new List<ProductCostLotView>();

            foreach (var row in group)
            {
                if (remainingBalanceQty <= 0)
                {
                    break;
                }

                var originalQty = Math.Max(row.Detail.Qty, 0);
                var remainingQty = Math.Min(originalQty, remainingBalanceQty);
                var totalPurchaseCost = ParseCost(row.Detail.CostLot);
                var unitCost = originalQty <= 0 ? 0 : Math.Round(totalPurchaseCost / originalQty, 2);

                if (remainingQty <= 0 || unitCost <= 0)
                {
                    continue;
                }

                productLots.Add(new ProductCostLotView
                {
                    CostLotId = -row.Detail.DetailId,
                    OriginalQty = originalQty,
                    ProductId = row.Detail.ProductId,
                    ReceiveDate = row.TransactionDate,
                    ReceiveDetailId = row.Detail.DetailId,
                    ReceiveHeaderId = row.Detail.HeaderId,
                    RemainingQty = remainingQty,
                    UnitCost = unitCost,
                });

                remainingBalanceQty -= remainingQty;
            }

            lotsByProductId[group.Key] = productLots
                .OrderBy(lot => lot.ReceiveDate)
                .ThenBy(lot => lot.CostLotId)
                .ToList();
        }

        return lotsByProductId;
    }

    private static decimal ParseCost(string value)
    {
        var text = value.Trim().Replace(",", string.Empty);

        return decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var invariantCost)
            ? invariantCost
            : decimal.TryParse(text, NumberStyles.Number, CultureInfo.CurrentCulture, out var currentCost)
                ? currentCost
                : 0;
    }

    private async Task PopulateSupplierDetails(IReadOnlyCollection<ProductCostLotView> lots)
    {
        var legacyLots = lots
            .Where(lot => (!lot.SupplierId.HasValue || lot.SupplierId <= 0)
                && string.IsNullOrWhiteSpace(lot.SupplierName))
            .ToList();

        if (legacyLots.Count == 0)
        {
            return;
        }

        var headerIds = legacyLots
            .Select(lot => lot.ReceiveHeaderId)
            .Where(headerId => headerId > 0)
            .Distinct()
            .ToList();

        if (headerIds.Count == 0)
        {
            return;
        }

        var supplierIdByHeaderId = await dbContext.StockHeaders
            .AsNoTracking()
            .Where(header => headerIds.Contains(header.HeaderId))
            .ToDictionaryAsync(header => header.HeaderId, header => header.SupplierId);
        var supplierIds = supplierIdByHeaderId.Values
            .Where(supplierId => supplierId.HasValue)
            .Select(supplierId => supplierId!.Value)
            .Distinct()
            .ToList();
        var supplierNameById = await dbContext.Suppliers
            .AsNoTracking()
            .Where(supplier => supplierIds.Contains(supplier.SupplierId))
            .ToDictionaryAsync(supplier => supplier.SupplierId, supplier => supplier.SupplierName);

        foreach (var lot in legacyLots)
        {
            if (!supplierIdByHeaderId.TryGetValue(lot.ReceiveHeaderId, out var supplierId)
                || !supplierId.HasValue)
            {
                continue;
            }

            lot.SupplierId = supplierId;
            lot.SupplierName = supplierNameById.GetValueOrDefault(supplierId.Value, string.Empty);
        }
    }

    private sealed class ProductCostLotView
    {
        public int CostLotId { get; set; }
        public int OriginalQty { get; set; }
        public string ProductId { get; set; } = string.Empty;
        public DateTime ReceiveDate { get; set; }
        public int ReceiveDetailId { get; set; }
        public int ReceiveHeaderId { get; set; }
        public int RemainingQty { get; set; }
        public int? SupplierId { get; set; }
        public string SupplierName { get; set; } = string.Empty;
        public decimal UnitCost { get; set; }
        public decimal RemainingCostValue => RemainingQty * UnitCost;
    }

    [HttpPost]
    public async Task<IActionResult> CreateProduct(CreateProductDto request)
    {
        if (string.IsNullOrWhiteSpace(request.ProductId)
            || string.IsNullOrWhiteSpace(request.ProductName)
            || string.IsNullOrWhiteSpace(request.IssueUnit)
            || string.IsNullOrWhiteSpace(request.ReceiveUnit)
            || request.StockQty < 0)
        {
            return BadRequest("Product ID, product name, receive unit, issue unit, and stock quantity are required.");
        }

        var productId = request.ProductId.Trim();
        var barcode = request.Barcode.Trim();
        var productName = request.ProductName.Trim();
        var categoryName = string.IsNullOrWhiteSpace(request.CategoryName) ? "General" : request.CategoryName.Trim();
        var receiveUnit = request.ReceiveUnit.Trim();
        var issueUnit = request.IssueUnit.Trim();

        var validationError = ValidateProductFields(productId, barcode, productName, categoryName, receiveUnit, issueUnit);

        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        if (await dbContext.Products.AnyAsync(product => product.ProductId == productId))
        {
            return Conflict("Product already exists.");
        }

        var product = new Product
        {
            Barcode = barcode,
            CategoryName = categoryName,
            CreatedDate = DateTime.Now,
            CreatedName = string.Empty,
            Img = request.ImageName.Trim(),
            ProductId = productId,
            ProductName = productName,
            ProductRemark = request.ProductRemark.Trim(),
            Status = "Active",
            ConversionQty = request.ConversionQty <= 0 ? 1 : request.ConversionQty,
            MinQty = DefaultMinQty,
            IssueUnit = issueUnit,
            ReceiveUnit = receiveUnit,
        };

        dbContext.Products.Add(product);

        dbContext.StockBalances.Add(new StockBalance
        {
            LastUpdate = DateTime.Now,
            LocationId = MainLocationId,
            ProductId = productId,
            Qty = request.StockQty,
        });

        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            Id = product.ProductId,
            Code = product.ProductId,
            ProductId = product.ProductId,
            Barcode = product.Barcode,
            Name = product.ProductName,
            ProductName = product.ProductName,
            Category = product.CategoryName,
            CategoryName = product.CategoryName,
            Unit = product.IssueUnit,
            IssueUnit = product.IssueUnit,
            ReceiveUnit = product.ReceiveUnit,
            ConversionQty = product.ConversionQty <= 0 ? 1 : product.ConversionQty,
            StockQty = request.StockQty,
            MinQty = product.MinQty,
            LocationId = MainLocationId,
            ImageName = product.Img,
            ProductRemark = product.ProductRemark,
            CurrentUnitCost = 0,
            LatestUnitCost = 0,
            RemainingCostValue = 0,
            LastRemark = string.Empty,
            LastRemarkSource = string.Empty,
            Status = product.Status,
            ReceiveHint = string.Empty,
            CostLot = string.Empty,
            RequestQty = 1,
        });
    }

    [HttpPost("import")]
    public async Task<IActionResult> ImportProducts(ImportProductsDto request)
    {
        if (request.Items.Count == 0)
        {
            return BadRequest("At least one product row is required.");
        }

        var validationErrors = ValidateImportRows(request.Items);

        if (validationErrors.Count > 0)
        {
            return BadRequest(new
            {
                Message = "Import data is invalid.",
                Errors = validationErrors,
            });
        }

        if (request.Items.Any(item => string.IsNullOrWhiteSpace(item.SupplierName)))
        {
            return BadRequest("Each imported product must have a supplier.");
        }

        var productIds = request.Items
            .Select(item => item.ProductId.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var barcodes = request.Items
            .Select(item => item.Barcode.Trim())
            .Where(barcode => !string.IsNullOrWhiteSpace(barcode))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingProducts = await dbContext.Products
            .Where(product => productIds.Contains(product.ProductId))
            .Select(product => new
            {
                product.ProductId,
                product.ProductName,
            })
            .ToListAsync();

        if (existingProducts.Count > 0)
        {
            return Conflict(new
            {
                Message = "Some product IDs already exist.",
                ExistingProducts = existingProducts,
            });
        }

        if (barcodes.Count > 0 && await dbContext.Products.AnyAsync(product => barcodes.Contains(product.Barcode)))
        {
            return Conflict("Some barcodes already exist.");
        }

        var existingBalanceProductIds = await dbContext.StockBalances
            .AsNoTracking()
            .Where(balance => productIds.Contains(balance.ProductId) && balance.LocationId == MainLocationId)
            .Select(balance => balance.ProductId)
            .Distinct()
            .ToListAsync();

        if (existingBalanceProductIds.Count > 0)
        {
            return Conflict(new
            {
                Message = "Some product balances already exist. Please delete old balance data or use stock adjustment instead.",
                ProductIds = existingBalanceProductIds,
            });
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var now = DateTime.Now;
        var categoryNames = request.Items
            .Select(item => string.IsNullOrWhiteSpace(item.CategoryName) ? "General" : item.CategoryName.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var existingCategories = await dbContext.Categories
            .Where(category => categoryNames.Contains(category.CategoryName))
            .Select(category => category.CategoryName)
            .ToListAsync();
        var existingCategorySet = existingCategories.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var categoryName in categoryNames.Where(categoryName => !existingCategorySet.Contains(categoryName)))
        {
            dbContext.Categories.Add(new Category
            {
                CategoryName = categoryName,
                CategoryStatus = 1,
            });
        }

        var supplierNames = request.Items
            .Select(item => item.SupplierName.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var existingSuppliers = await dbContext.Suppliers
            .Where(supplier => supplierNames.Contains(supplier.SupplierName))
            .ToListAsync();
        var existingSupplierNames = existingSuppliers
            .Select(supplier => supplier.SupplierName)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var supplierName in supplierNames.Where(supplierName => !existingSupplierNames.Contains(supplierName)))
        {
            dbContext.Suppliers.Add(new Supplier
            {
                SupplierName = supplierName,
                SupplierStatus = 1,
                CreatedDate = now,
            });
        }

        await dbContext.SaveChangesAsync();

        var suppliersByName = await dbContext.Suppliers
            .Where(supplier => supplierNames.Contains(supplier.SupplierName))
            .ToDictionaryAsync(supplier => supplier.SupplierName, StringComparer.OrdinalIgnoreCase);
        var supplierIds = suppliersByName.Values
            .Select(supplier => supplier.SupplierId)
            .Distinct()
            .ToList();

        var stockHeader = new StockHeader
        {
            CreateBy = request.EmployeeId.ToString(),
            CreateDate = now,
            DocType = ReceiveDocType,
            EmployeeId = request.EmployeeId.ToString(),
            Remark = string.Empty,
            SupplierId = supplierIds.Count == 1 ? supplierIds[0] : null,
            Status = StockHeaderStatuses.Completed,
            TransactionDate = now,
        };

        foreach (var item in request.Items)
        {
            var productId = item.ProductId.Trim();
            var barcode = item.Barcode.Trim();
            var categoryName = string.IsNullOrWhiteSpace(item.CategoryName) ? "General" : item.CategoryName.Trim();
            var conversionQty = item.ConversionQty <= 0 ? 1 : item.ConversionQty;
            var stockQty = item.StockQty > 0
                ? item.StockQty
                : item.ReceiveQty > 0
                    ? Convert.ToInt32(Math.Round(item.ReceiveQty * conversionQty, MidpointRounding.AwayFromZero))
                    : 0;
            var receiveQty = item.ReceiveQty > 0 ? item.ReceiveQty : Math.Round(stockQty / conversionQty, 2);
            // Excel uses the same rule as the receive form: this is the total
            // amount paid for the whole received row, not a per-issue-unit cost.
            var totalCost = Math.Round(item.UnitCost, 2);

            dbContext.Products.Add(new Product
            {
                Barcode = barcode,
                CategoryName = categoryName,
                ConversionQty = conversionQty,
                CreatedDate = now,
                CreatedName = request.EmployeeId.ToString(),
                Img = string.Empty,
                IssueUnit = item.IssueUnit.Trim(),
                MinQty = item.MinQty < 0 ? DefaultMinQty : item.MinQty,
                ProductId = productId,
                ProductName = item.ProductName.Trim(),
                ProductRemark = item.ProductRemark.Trim(),
                ReceiveUnit = item.ReceiveUnit.Trim(),
                Status = "Active",
            });

            dbContext.StockBalances.Add(new StockBalance
            {
                LastUpdate = now,
                LocationId = MainLocationId,
                ProductId = productId,
                Qty = stockQty,
            });

            stockHeader.Details.Add(new StockDetail
            {
                Barcode = barcode,
                Category = categoryName,
                CostLot = totalCost.ToString(CultureInfo.InvariantCulture),
                ProductId = productId,
                ProductName = item.ProductName.Trim(),
                Qty = stockQty,
                ReceiveQty = receiveQty,
                ReceiveUnit = item.ReceiveUnit.Trim(),
                Unit = item.IssueUnit.Trim(),
            });
        }

        dbContext.StockHeaders.Add(stockHeader);
        await dbContext.SaveChangesAsync();

        foreach (var detail in stockHeader.Details)
        {
            var row = request.Items.First(item => item.ProductId.Trim() == detail.ProductId);
            var supplier = suppliersByName[row.SupplierName.Trim()];

            dbContext.StockCostLots.Add(new StockCostLot
            {
                CreatedDate = now,
                OriginalQty = detail.Qty,
                ProductId = detail.ProductId,
                ReceiveDetailId = detail.DetailId,
                ReceiveHeaderId = stockHeader.HeaderId,
                RemainingQty = detail.Qty,
                SupplierId = supplier.SupplierId,
                SupplierName = supplier.SupplierName,
                Status = 1,
                UnitCost = detail.Qty <= 0
                    ? 0
                    : Math.Round(decimal.Parse(detail.CostLot, CultureInfo.InvariantCulture) / detail.Qty, 4),
            });
        }

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new
        {
            ImportedCount = request.Items.Count,
            HeaderId = stockHeader.HeaderId,
        });
    }

    [HttpPut("{productId}")]
    public async Task<IActionResult> UpdateProduct(string productId, UpdateProductDto request)
    {
        if (string.IsNullOrWhiteSpace(request.ProductName))
        {
            return BadRequest("Product name is required.");
        }

        var updateBarcode = request.Barcode.Trim();
        var updateProductName = request.ProductName.Trim();
        var updateCategoryName = string.IsNullOrWhiteSpace(request.CategoryName) ? "General" : request.CategoryName.Trim();

        var updateValidationError = ValidateProductFields(productId, updateBarcode, updateProductName, updateCategoryName, null, null);

        if (updateValidationError is not null)
        {
            return BadRequest(updateValidationError);
        }

        var product = await dbContext.Products.FirstOrDefaultAsync(item => item.ProductId == productId);

        if (product is null)
        {
            return NotFound("Product not found.");
        }

        product.Barcode = updateBarcode;
        product.CategoryName = updateCategoryName;
        product.Img = request.ImageName?.Trim() ?? string.Empty;
        product.ProductName = updateProductName;
        product.ProductRemark = request.ProductRemark.Trim();
        product.Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim();

        var balance = await dbContext.StockBalances
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.ProductId == productId && item.LocationId == MainLocationId);

        await dbContext.SaveChangesAsync();

        var lastReceiveQty = await dbContext.StockDetails
            .Where(detail => detail.ProductId == product.ProductId)
            .Join(
                dbContext.StockHeaders,
                detail => detail.HeaderId,
                header => header.HeaderId,
                (detail, header) => new
                {
                    detail.Qty,
                    detail.ReceiveQty,
                    header.DocType,
                    header.Status,
                    header.TransactionDate,
                })
            .Where(item =>
                item.DocType == ReceiveDocType
                && item.Status != StockHeaderStatuses.Cancelled)
            .OrderByDescending(item => item.TransactionDate)
            .Select(item => (decimal?)(item.ReceiveQty ?? item.Qty))
            .FirstOrDefaultAsync() ?? 0;

        var totalReceiveQty = await dbContext.StockDetails
            .Where(detail => detail.ProductId == product.ProductId)
            .Join(
                dbContext.StockHeaders,
                detail => detail.HeaderId,
                header => header.HeaderId,
                (detail, header) => new
                {
                    detail.Qty,
                    detail.ReceiveQty,
                    header.DocType,
                    header.Status,
                })
            .Where(item =>
                item.DocType == ReceiveDocType
                && item.Status != StockHeaderStatuses.Cancelled)
            .SumAsync(item => (decimal?)(item.ReceiveQty ?? item.Qty)) ?? 0;

        if (totalReceiveQty <= 0)
        {
            var totalConvertedReceiveQty = await dbContext.StockCostLots
                .Where(lot => lot.ProductId == product.ProductId && lot.Status == 1)
                .SumAsync(lot => (decimal?)lot.OriginalQty) ?? 0;

            totalReceiveQty = totalConvertedReceiveQty / (product.ConversionQty <= 0 ? 1 : product.ConversionQty);
        }

        return Ok(new
        {
            Id = product.ProductId,
            Code = product.ProductId,
            ProductId = product.ProductId,
            Barcode = product.Barcode,
            Name = product.ProductName,
            ProductName = product.ProductName,
            Category = product.CategoryName,
            CategoryName = product.CategoryName,
            Unit = product.IssueUnit,
            IssueUnit = product.IssueUnit,
            ReceiveUnit = product.ReceiveUnit,
            ConversionQty = product.ConversionQty <= 0 ? 1 : product.ConversionQty,
            StockQty = balance?.Qty ?? 0,
            MinQty = product.MinQty,
            LocationId = MainLocationId,
            ImageName = product.Img,
            ProductRemark = product.ProductRemark,
            LastReceiveQty = lastReceiveQty,
            TotalReceiveQty = totalReceiveQty,
            CurrentUnitCost = await dbContext.StockCostLots
                .Where(lot => lot.ProductId == product.ProductId && lot.RemainingQty > 0 && lot.Status == 1)
                .OrderBy(lot => lot.CreatedDate)
                .ThenBy(lot => lot.CostLotId)
                .Select(lot => lot.UnitCost)
                .FirstOrDefaultAsync(),
            LatestUnitCost = await dbContext.StockCostLots
                .Where(lot => lot.ProductId == product.ProductId && lot.Status == 1)
                .OrderByDescending(lot => lot.CreatedDate)
                .ThenByDescending(lot => lot.CostLotId)
                .Select(lot => lot.UnitCost)
                .FirstOrDefaultAsync(),
            RemainingCostValue = await dbContext.StockCostLots
                .Where(lot => lot.ProductId == product.ProductId && lot.RemainingQty > 0 && lot.Status == 1)
                .SumAsync(lot => (decimal?)lot.RemainingQty * lot.UnitCost) ?? 0,
            LastRemark = string.Empty,
            LastRemarkSource = string.Empty,
            Status = product.Status,
            ReceiveHint = string.Empty,
            CostLot = string.Empty,
            RequestQty = 1,
        });
    }

    private static string? ValidateProductFields(
        string productId,
        string barcode,
        string productName,
        string categoryName,
        string? receiveUnit,
        string? issueUnit)
    {
        if (!CodePattern.IsMatch(productId))
        {
            return "Product ID supports English letters, numbers, and . _ / - only.";
        }

        if (!string.IsNullOrWhiteSpace(barcode) && !CodePattern.IsMatch(barcode))
        {
            return "Barcode supports English letters, numbers, and . _ / - only.";
        }

        if (!PlainNamePattern.IsMatch(productName))
        {
            return "Product name contains invalid characters.";
        }

        if (!PlainNamePattern.IsMatch(categoryName))
        {
            return "Category name contains invalid characters.";
        }

        if (!string.IsNullOrWhiteSpace(receiveUnit) && !PlainNamePattern.IsMatch(receiveUnit))
        {
            return "Receive unit contains invalid characters.";
        }

        if (!string.IsNullOrWhiteSpace(issueUnit) && !PlainNamePattern.IsMatch(issueUnit))
        {
            return "Issue unit contains invalid characters.";
        }

        return null;
    }

    private static List<string> ValidateImportRows(IReadOnlyList<ImportProductRowDto> items)
    {
        var errors = new List<string>();
        var productIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var barcodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (item, index) in items.Select((item, index) => (item, index)))
        {
            var rowNo = index + 2;
            var productId = item.ProductId.Trim();
            var barcode = item.Barcode.Trim();
            var productName = item.ProductName.Trim();
            var categoryName = string.IsNullOrWhiteSpace(item.CategoryName) ? "General" : item.CategoryName.Trim();
            var receiveUnit = item.ReceiveUnit.Trim();
            var issueUnit = item.IssueUnit.Trim();
            var validationError = ValidateProductFields(productId, barcode, productName, categoryName, receiveUnit, issueUnit);

            if (string.IsNullOrWhiteSpace(productId)
                || string.IsNullOrWhiteSpace(productName)
                || string.IsNullOrWhiteSpace(receiveUnit)
                || string.IsNullOrWhiteSpace(issueUnit))
            {
                errors.Add($"Row {rowNo}: ProductId, ProductName, ReceiveUnit, and IssueUnit are required.");
            }

            if (validationError is not null)
            {
                errors.Add($"Row {rowNo}: {validationError}");
            }

            if (item.ConversionQty <= 0)
            {
                errors.Add($"Row {rowNo}: ConversionQty must be greater than zero.");
            }

            if (item.StockQty < 0)
            {
                errors.Add($"Row {rowNo}: StockQty must be zero or greater.");
            }

            if (item.UnitCost < 0)
            {
                errors.Add($"Row {rowNo}: UnitCost must be zero or greater.");
            }

            if (item.MinQty < 0)
            {
                errors.Add($"Row {rowNo}: MinQty must be zero or greater.");
            }

            if (!string.IsNullOrWhiteSpace(productId) && !productIds.Add(productId))
            {
                errors.Add($"Row {rowNo}: ProductId is duplicated in this Excel file.");
            }

            if (!string.IsNullOrWhiteSpace(barcode) && !barcodes.Add(barcode))
            {
                errors.Add($"Row {rowNo}: Barcode is duplicated in this Excel file.");
            }
        }

        return errors;
    }
}
