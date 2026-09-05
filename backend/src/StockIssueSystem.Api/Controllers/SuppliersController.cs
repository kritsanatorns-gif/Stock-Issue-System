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
        if (await dbContext.Suppliers.AnyAsync(supplier => supplier.SupplierName == name)) return Conflict("ชื่อผู้ขายนี้มีในระบบแล้ว");
        if (!string.IsNullOrWhiteSpace(shortName) && await dbContext.Suppliers.AnyAsync(supplier => supplier.ShortName == shortName))
        {
            return Conflict("ชื่อย่อนี้มีในระบบแล้ว");
        }

        var supplier = new Supplier
        {
            SupplierName = name,
            AccountId = request.AccountId.Trim(),
            ShortName = shortName,
            AccountName = request.AccountName.Trim(),
            Address = request.Address.Trim(),
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
            return Conflict("ชื่อผู้ขายนี้มีในระบบแล้ว");
        }
        if (!string.IsNullOrWhiteSpace(shortName) && await dbContext.Suppliers.AnyAsync(supplier => supplier.SupplierId != supplierId && supplier.ShortName == shortName))
        {
            return Conflict("ชื่อย่อนี้มีในระบบแล้ว");
        }

        var supplier = await dbContext.Suppliers.FindAsync(supplierId);
        if (supplier is null) return NotFound("Supplier not found.");

        supplier.SupplierName = name;
        supplier.AccountId = request.AccountId.Trim();
        supplier.ShortName = shortName;
        supplier.AccountName = request.AccountName.Trim();
        supplier.Address = request.Address.Trim();
        await dbContext.SaveChangesAsync();

        return Ok(new SupplierDto
        {
            SupplierId = supplier.SupplierId,
            SupplierName = supplier.SupplierName,
            AccountId = supplier.AccountId,
            ShortName = supplier.ShortName,
            AccountName = supplier.AccountName,
            Address = supplier.Address,
            SupplierStatus = supplier.SupplierStatus,
        });
    }
}
