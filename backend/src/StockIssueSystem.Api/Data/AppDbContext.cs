using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Models;

namespace StockIssueSystem.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeMenuPermission> EmployeeMenuPermissions => Set<EmployeeMenuPermission>();
    public DbSet<Menu> Menus => Set<Menu>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductFavorite> ProductFavorites => Set<ProductFavorite>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Status> Statuses => Set<Status>();
    public DbSet<StockBalance> StockBalances => Set<StockBalance>();
    public DbSet<StockCostLot> StockCostLots => Set<StockCostLot>();
    public DbSet<StockHeader> StockHeaders => Set<StockHeader>();
    public DbSet<StockDetail> StockDetails => Set<StockDetail>();
    public DbSet<StockIssueCost> StockIssueCosts => Set<StockIssueCost>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("Category", "dbo");
            entity.HasKey(category => category.CategoryId);
            entity.Property(category => category.CategoryName).HasMaxLength(100).IsRequired();
            entity.Property(category => category.CategoryStatus).HasDefaultValue(1);
            entity.HasIndex(category => category.CategoryName).IsUnique();
        });

        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.ToTable("Supplier", "dbo");
            entity.HasKey(supplier => supplier.SupplierId);
            entity.Property(supplier => supplier.SupplierName).HasMaxLength(150).IsRequired();
            entity.Property(supplier => supplier.SupplierStatus).HasDefaultValue(1);
            entity.Property(supplier => supplier.CreatedDate).HasDefaultValueSql("GETDATE()");
            entity.HasIndex(supplier => supplier.SupplierName).IsUnique();
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("Department", "dbo");
            entity.HasKey(department => department.DepartmentId);
            entity.Property(department => department.DepartmentCode).HasMaxLength(200).IsRequired();
            entity.Property(department => department.DepartmentName).HasMaxLength(50).IsRequired();
            entity.Property(department => department.DepartmentStatus).HasDefaultValue(1);
            entity.HasIndex(department => department.DepartmentCode).IsUnique();
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.ToTable("Employee", "dbo");
            entity.HasKey(employee => employee.EmployeeId);
            entity.Property(employee => employee.EmployeeId).ValueGeneratedNever();
            entity.Property(employee => employee.EmployeeName).HasMaxLength(50);
            entity.Property(employee => employee.Permission).HasMaxLength(50);
            entity.Property(employee => employee.Department).HasMaxLength(50).HasDefaultValue("HR");
            entity.Property(employee => employee.Username).HasColumnName("Usersname").HasMaxLength(50);
            entity.Property(employee => employee.Password).HasMaxLength(50);
            entity.Property(employee => employee.Status).HasColumnName("EmployeeStatus");
        });

        modelBuilder.Entity<EmployeeMenuPermission>(entity =>
        {
            entity.ToTable("EmployeeMenuPermission", "dbo");
            entity.HasKey(permission => permission.EmployeeMenuPermissionId);
            entity.Property(permission => permission.CreatedDate).HasDefaultValueSql("GETDATE()");
            entity.HasIndex(permission => new
            {
                permission.EmployeeId,
                permission.MenuId,
            }).IsUnique();

            entity.HasOne<Menu>()
                .WithMany()
                .HasForeignKey(permission => permission.MenuId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Menu>(entity =>
        {
            entity.ToTable("Menu", "dbo");
            entity.HasKey(menu => menu.MenuId);
            entity.Property(menu => menu.MenuCode).HasMaxLength(50).IsRequired();
            entity.Property(menu => menu.MenuName).HasMaxLength(100).IsRequired();
            entity.Property(menu => menu.MenuPath).HasMaxLength(100);
            entity.Property(menu => menu.IsActive).HasDefaultValue(1);
            entity.HasIndex(menu => menu.MenuCode).IsUnique();
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.ToTable("Permission", "dbo");
            entity.HasKey(permission => permission.PermissionId);
            entity.Property(permission => permission.PermissionId).ValueGeneratedNever();
            entity.Property(permission => permission.PermissionName).HasMaxLength(50);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("Product", "dbo");
            entity.HasKey(product => product.Id);
            entity.Property(product => product.ProductId).HasMaxLength(50).IsRequired();
            entity.Property(product => product.ProductName).HasMaxLength(200).IsRequired();
            entity.Property(product => product.CategoryName).HasMaxLength(100).HasDefaultValue("General");
            entity.Property(product => product.ReceiveUnit).HasMaxLength(20);
            entity.Property(product => product.IssueUnit).HasMaxLength(20);
            entity.Property(product => product.ConversionQty).HasColumnType("decimal(18, 2)").HasDefaultValue(1);
            entity.Property(product => product.Barcode).HasMaxLength(100);
            entity.Property(product => product.Img).HasMaxLength(200);
            entity.Property(product => product.ProductRemark).HasMaxLength(500).HasDefaultValue("");
            entity.Property(product => product.Status).HasMaxLength(20).HasDefaultValue("Active");
            entity.Property(product => product.CreatedDate).HasDefaultValueSql("GETDATE()");
            entity.Property(product => product.CreatedName).HasMaxLength(20);
            entity.HasIndex(product => product.ProductId).IsUnique();
            entity.HasIndex(product => product.Barcode);
        });

        modelBuilder.Entity<ProductFavorite>(entity =>
        {
            entity.ToTable("ProductFavorite", "dbo");
            entity.HasKey(favorite => favorite.ProductFavoriteId);
            entity.Property(favorite => favorite.ProductCode).HasMaxLength(100).IsRequired();
            entity.Property(favorite => favorite.Mode).HasMaxLength(20).IsRequired();
            entity.Property(favorite => favorite.CreatedDate).HasDefaultValueSql("GETDATE()");
            entity.HasIndex(favorite => new
            {
                favorite.EmployeeId,
                favorite.ProductCode,
                favorite.Mode,
            }).IsUnique();
        });

        modelBuilder.Entity<Status>(entity =>
        {
            entity.ToTable("Status", "dbo");
            entity.HasKey(status => status.StatusId);
            entity.Property(status => status.StatusId).ValueGeneratedNever();
            entity.Property(status => status.StatusName).HasMaxLength(50);
            entity.Property(status => status.StatusTable).HasMaxLength(50);
        });

        modelBuilder.Entity<StockBalance>(entity =>
        {
            entity.ToTable("StockBalance", "dbo");
            entity.HasKey(balance => balance.BalanceId);
            entity.Property(balance => balance.ProductId).HasMaxLength(50).IsRequired();
            entity.Property(balance => balance.LocationId).HasMaxLength(20).IsRequired();
            entity.Property(balance => balance.LastUpdate).HasDefaultValueSql("GETDATE()");
            entity.HasIndex(balance => new
            {
                balance.ProductId,
                balance.LocationId,
            }).IsUnique();
        });

        modelBuilder.Entity<StockCostLot>(entity =>
        {
            entity.ToTable("StockCostLot", "dbo");
            entity.HasKey(lot => lot.CostLotId);
            entity.Property(lot => lot.ProductId).HasMaxLength(50).IsRequired();
            entity.Property(lot => lot.UnitCost).HasColumnType("decimal(18, 2)");
            entity.Property(lot => lot.CreatedDate).HasDefaultValueSql("GETDATE()");
            entity.HasIndex(lot => new
            {
                lot.ProductId,
                lot.RemainingQty,
                lot.CreatedDate,
            });
        });

        modelBuilder.Entity<StockHeader>(entity =>
        {
            entity.ToTable("StockHeader", "dbo");
            entity.HasKey(header => header.HeaderId);
            entity.Property(header => header.DocType).HasMaxLength(20).IsRequired();
            entity.Property(header => header.EmployeeId).HasMaxLength(20).IsRequired();
            entity.Property(header => header.TransactionDate).HasDefaultValueSql("GETDATE()");
            entity.Property(header => header.Department).HasMaxLength(50).HasDefaultValue("");
            entity.Property(header => header.RequesterName).HasMaxLength(100).HasDefaultValue("");
            entity.Property(header => header.HrRemark).HasMaxLength(500).HasDefaultValue("");
            entity.Property(header => header.IsUrgent).HasDefaultValue(false);
            entity.Property(header => header.UrgentRemark).HasMaxLength(500).HasDefaultValue("");
            entity.Property(header => header.Remark).HasMaxLength(255);
            entity.Property(header => header.SourceRequisitionId);
            entity.Property(header => header.SupplierId);
            entity.Property(header => header.CreateBy).HasMaxLength(20);
            entity.Property(header => header.CreateDate).HasDefaultValueSql("GETDATE()");
            entity.HasIndex(header => header.SourceRequisitionId);
            entity.HasIndex(header => header.SupplierId);
        });

        modelBuilder.Entity<StockDetail>(entity =>
        {
            entity.ToTable("StockDetail", "dbo");
            entity.HasKey(detail => detail.DetailId);
            entity.Property(detail => detail.Barcode).HasMaxLength(100);
            entity.Property(detail => detail.Category).HasMaxLength(100);
            entity.Property(detail => detail.CostLot).HasMaxLength(50);
            entity.Property(detail => detail.ProductId).HasMaxLength(50).IsRequired();
            entity.Property(detail => detail.ProductName).HasMaxLength(200);
            entity.Property(detail => detail.FulfilledQty);
            entity.Property(detail => detail.SourceRequisitionDetailId);
            entity.Property(detail => detail.ReceiveQty).HasColumnType("decimal(18, 2)");
            entity.Property(detail => detail.ReceiveUnit).HasMaxLength(20);
            entity.Property(detail => detail.Unit).HasMaxLength(20);

            entity.HasOne(detail => detail.Header)
                .WithMany(header => header.Details)
                .HasForeignKey(detail => detail.HeaderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(detail => detail.SourceRequisitionDetailId);
        });

        modelBuilder.Entity<StockIssueCost>(entity =>
        {
            entity.ToTable("StockIssueCost", "dbo");
            entity.HasKey(cost => cost.IssueCostId);
            entity.Property(cost => cost.UnitCost).HasColumnType("decimal(18, 2)");
            entity.Property(cost => cost.TotalCost).HasColumnType("decimal(18, 2)");
            entity.HasIndex(cost => cost.IssueDetailId);
            entity.HasIndex(cost => cost.CostLotId);
        });
    }
}
