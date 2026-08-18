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
                SupplierStatus = supplier.SupplierStatus,
            }).ToListAsync();

        return Ok(suppliers);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierDto>> CreateSupplier(CreateSupplierDto request)
    {
        var name = request.SupplierName.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Supplier name is required.");
        if (name.Length > 150) return BadRequest("Supplier name must not exceed 150 characters.");
        if (await dbContext.Suppliers.AnyAsync(supplier => supplier.SupplierName == name)) return Conflict("Supplier name already exists.");

        var supplier = new Supplier { SupplierName = name };
        dbContext.Suppliers.Add(supplier);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSuppliers), new SupplierDto
        {
            SupplierId = supplier.SupplierId,
            SupplierName = supplier.SupplierName,
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
            SupplierStatus = supplier.SupplierStatus,
        });
    }
}
