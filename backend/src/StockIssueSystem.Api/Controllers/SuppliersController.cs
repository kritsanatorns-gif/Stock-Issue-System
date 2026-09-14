using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Models.DTOs;

namespace StockIssueSystem.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
public sealed class SuppliersController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierDto>>> GetSuppliers()
    {
        var suppliers = await dbContext.Suppliers.AsNoTracking()
            .OrderBy(supplier => supplier.SupplierName)
            .Select(supplier => new SupplierDto
            {
                SupplierId = supplier.SupplierId,
                SupplierName = supplier.SupplierName,
                AccountId = supplier.AccountId,
                ShortName = supplier.ShortName,
                AccountName = supplier.AccountName,
                Address = supplier.Address,
                CreditDays = supplier.CreditDays,
                Phone = supplier.Phone,
                TaxId = supplier.TaxId,
                Branch = supplier.Branch,
                PostalCode = supplier.PostalCode,
                SupplierStatus = supplier.SupplierStatus,
            }).ToListAsync();

        return Ok(suppliers);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierDto>> CreateSupplier(CreateSupplierDto request)
    {
        var name = request.SupplierName.Trim();
        var shortName = request.ShortName.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Supplier name is required.");
        if (name.Length > 150) return BadRequest("Supplier name must not exceed 150 characters.");
        if (await dbContext.Suppliers.AnyAsync(supplier => supplier.SupplierName == name)) return Conflict("à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸‚à¸²à¸¢à¸™à¸µà¹‰à¸¡à¸µà¹ƒà¸™à¸£à¸°à¸šà¸šà¹à¸¥à¹‰à¸§");
        if (!string.IsNullOrWhiteSpace(shortName) && await dbContext.Suppliers.AnyAsync(supplier => supplier.ShortName == shortName))
        {
            return Conflict("à¸Šà¸·à¹ˆà¸­à¸¢à¹ˆà¸­à¸™à¸µà¹‰à¸¡à¸µà¹ƒà¸™à¸£à¸°à¸šà¸šà¹à¸¥à¹‰à¸§");
        }

        var supplier = new Supplier
        {
            SupplierName = name,
            AccountId = request.AccountId.Trim(),
            ShortName = shortName,
            AccountName = request.AccountName.Trim(),
            Address = request.Address.Trim(),
            CreditDays = request.CreditDays,
            Phone = request.Phone.Trim(),
            TaxId = request.TaxId.Trim(),
            Branch = request.Branch.Trim(),
            PostalCode = request.PostalCode.Trim(),
        };
        dbContext.Suppliers.Add(supplier);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSuppliers), new SupplierDto
        {
            SupplierId = supplier.SupplierId,
            SupplierName = supplier.SupplierName,
            AccountId = supplier.AccountId,
            ShortName = supplier.ShortName,
            AccountName = supplier.AccountName,
            Address = supplier.Address,
                CreditDays = supplier.CreditDays,
                Phone = supplier.Phone,
                TaxId = supplier.TaxId,
                Branch = supplier.Branch,
                PostalCode = supplier.PostalCode,
            SupplierStatus = supplier.SupplierStatus,
        });
    }

    [HttpPut("{supplierId:int}/status")]
    public async Task<ActionResult<SupplierDto>> UpdateSupplierStatus(int supplierId, UpdateSupplierStatusDto request)
    {
        if (request.SupplierStatus is not 0 and not 1)
        {
            return BadRequest("Supplier status must be 0 or 1.");
        }

        var supplier = await dbContext.Suppliers.FindAsync(supplierId);
        if (supplier is null) return NotFound("Supplier not found.");

        supplier.SupplierStatus = request.SupplierStatus;
        await dbContext.SaveChangesAsync();

        return Ok(new SupplierDto
        {
            SupplierId = supplier.SupplierId,
            SupplierName = supplier.SupplierName,
            AccountId = supplier.AccountId,
            ShortName = supplier.ShortName,
            AccountName = supplier.AccountName,
            Address = supplier.Address,
                CreditDays = supplier.CreditDays,
                Phone = supplier.Phone,
                TaxId = supplier.TaxId,
                Branch = supplier.Branch,
                PostalCode = supplier.PostalCode,
            SupplierStatus = supplier.SupplierStatus,
        });
    }

    [HttpPut("{supplierId:int}")]
    public async Task<ActionResult<SupplierDto>> UpdateSupplier(int supplierId, UpdateSupplierDto request)
    {
        var name = request.SupplierName.Trim();
        var shortName = request.ShortName.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Supplier name is required.");
        if (name.Length > 150) return BadRequest("Supplier name must not exceed 150 characters.");
        if (await dbContext.Suppliers.AnyAsync(supplier => supplier.SupplierId != supplierId && supplier.SupplierName == name))
        {
            return Conflict("à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸‚à¸²à¸¢à¸™à¸µà¹‰à¸¡à¸µà¹ƒà¸™à¸£à¸°à¸šà¸šà¹à¸¥à¹‰à¸§");
        }
        if (!string.IsNullOrWhiteSpace(shortName) && await dbContext.Suppliers.AnyAsync(supplier => supplier.SupplierId != supplierId && supplier.ShortName == shortName))
        {
            return Conflict("à¸Šà¸·à¹ˆà¸­à¸¢à¹ˆà¸­à¸™à¸µà¹‰à¸¡à¸µà¹ƒà¸™à¸£à¸°à¸šà¸šà¹à¸¥à¹‰à¸§");
        }

        var supplier = await dbContext.Suppliers.FindAsync(supplierId);
        if (supplier is null) return NotFound("Supplier not found.");

        supplier.SupplierName = name;
        supplier.AccountId = request.AccountId.Trim();
        supplier.ShortName = shortName;
        supplier.AccountName = request.AccountName.Trim();
        supplier.Address = request.Address.Trim();
        supplier.CreditDays = request.CreditDays;
        supplier.Phone = request.Phone.Trim();
        supplier.TaxId = request.TaxId.Trim();
        supplier.Branch = request.Branch.Trim();
        supplier.PostalCode = request.PostalCode.Trim();
        await dbContext.SaveChangesAsync();

        return Ok(new SupplierDto
        {
            SupplierId = supplier.SupplierId,
            SupplierName = supplier.SupplierName,
            AccountId = supplier.AccountId,
            ShortName = supplier.ShortName,
            AccountName = supplier.AccountName,
            Address = supplier.Address,
                CreditDays = supplier.CreditDays,
                Phone = supplier.Phone,
                TaxId = supplier.TaxId,
                Branch = supplier.Branch,
                PostalCode = supplier.PostalCode,
            SupplierStatus = supplier.SupplierStatus,
        });
    }
}



