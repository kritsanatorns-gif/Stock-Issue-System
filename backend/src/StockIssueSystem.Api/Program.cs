using Microsoft.EntityFrameworkCore;
using StockIssueSystem.Api.Data;
using StockIssueSystem.Api.Models;
using StockIssueSystem.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<FifoCostService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();
app.UseCors("Frontend");

app.MapGet("/", () => Results.Ok(new
{
    status = "Running",
    service = "Stock Issue System API",
    health = "/api/health",
}));

app.MapControllers();

await EnsureEmployeeDepartmentColumn(app);
await EnsureStockHeaderSeparatedRemarkColumns(app);
await EnsureStockHeaderUrgentColumns(app);
await EnsureStockHeaderStatuses(app);
await EnsureProductRemarkColumn(app);
await EnsureStockAdjustMenu(app);
await EnsureRequisitionWorkflow(app);
await EnsureSupplierWorkflow(app);

app.Run();

static async Task EnsureEmployeeDepartmentColumn(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'Employee'
                AND columns.name = N'Department'
        )
        BEGIN
            ALTER TABLE dbo.Employee
            ADD Department nvarchar(50) NOT NULL
                CONSTRAINT DF_Employee_Department DEFAULT N'HR'
        END
    """);

    await dbContext.Database.ExecuteSqlRawAsync("""
        UPDATE dbo.Employee
        SET Department = N'HR'
        WHERE Department IS NULL OR LTRIM(RTRIM(Department)) = N''
    """);
}

static async Task EnsureStockHeaderSeparatedRemarkColumns(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockHeader'
                AND columns.name = N'Department'
        )
        BEGIN
            ALTER TABLE dbo.StockHeader
            ADD Department nvarchar(50) NOT NULL
                CONSTRAINT DF_StockHeader_Department DEFAULT N''
        END

        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockHeader'
                AND columns.name = N'RequesterName'
        )
        BEGIN
            ALTER TABLE dbo.StockHeader
            ADD RequesterName nvarchar(100) NOT NULL
                CONSTRAINT DF_StockHeader_RequesterName DEFAULT N''
        END

        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockHeader'
                AND columns.name = N'HrRemark'
        )
        BEGIN
            ALTER TABLE dbo.StockHeader
            ADD HrRemark nvarchar(500) NOT NULL
                CONSTRAINT DF_StockHeader_HrRemark DEFAULT N''
        END
    """);
}

static async Task EnsureStockHeaderUrgentColumns(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockHeader'
                AND columns.name = N'IsUrgent'
        )
        BEGIN
            ALTER TABLE dbo.StockHeader
            ADD IsUrgent bit NOT NULL
                CONSTRAINT DF_StockHeader_IsUrgent DEFAULT 0
        END

        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockHeader'
                AND columns.name = N'UrgentRemark'
        )
        BEGIN
            ALTER TABLE dbo.StockHeader
            ADD UrgentRemark nvarchar(500) NOT NULL
                CONSTRAINT DF_StockHeader_UrgentRemark DEFAULT N''
        END
    """);
}

static async Task EnsureStockAdjustMenu(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (SELECT 1 FROM dbo.Menu WHERE MenuId = 9)
        BEGIN
            SET IDENTITY_INSERT dbo.Menu ON;

            INSERT INTO dbo.Menu (MenuId, MenuCode, MenuName, MenuPath, SortOrder, IsActive)
            VALUES (9, 'STOCK_ADJUST', N'ปรับสต๊อก', '/stock-adjust', 4, 1);

            SET IDENTITY_INSERT dbo.Menu OFF;
        END
        ELSE
        BEGIN
            UPDATE dbo.Menu
            SET MenuCode = 'STOCK_ADJUST',
                MenuName = N'ปรับสต๊อก',
                MenuPath = '/stock-adjust',
                SortOrder = 4,
                IsActive = 1
            WHERE MenuId = 9;
        END

        UPDATE dbo.Menu SET SortOrder = 1 WHERE MenuCode = 'DASHBOARD';
        UPDATE dbo.Menu SET SortOrder = 2 WHERE MenuCode = 'STOCK_OUT';
        UPDATE dbo.Menu SET SortOrder = 3 WHERE MenuCode = 'STOCK_IN';
        UPDATE dbo.Menu SET SortOrder = 4 WHERE MenuCode = 'STOCK_ADJUST';
        UPDATE dbo.Menu SET SortOrder = 5 WHERE MenuCode = 'PRODUCTS';
        UPDATE dbo.Menu SET SortOrder = 6 WHERE MenuCode = 'HISTORY';
        UPDATE dbo.Menu SET SortOrder = 7 WHERE MenuCode = 'REPORTS';
        UPDATE dbo.Menu SET SortOrder = 8 WHERE MenuCode = 'USERS';
        UPDATE dbo.Menu SET SortOrder = 9 WHERE MenuCode = 'DEPARTMENTS';

        INSERT INTO dbo.EmployeeMenuPermission (EmployeeId, MenuId, CreatedDate)
        SELECT employee.EmployeeId, 9, GETDATE()
        FROM dbo.Employee employee
        WHERE employee.Permission = '1'
            AND NOT EXISTS (
                SELECT 1
                FROM dbo.EmployeeMenuPermission existingPermission
                WHERE existingPermission.EmployeeId = employee.EmployeeId
                    AND existingPermission.MenuId = 9
            );
    """);
}

static async Task EnsureRequisitionWorkflow(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockDetail'
                AND columns.name = N'FulfilledQty'
        )
        BEGIN
            ALTER TABLE dbo.StockDetail ADD FulfilledQty int NULL;
        END

        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockHeader'
                AND columns.name = N'SourceRequisitionId'
        )
        BEGIN
            ALTER TABLE dbo.StockHeader ADD SourceRequisitionId int NULL;
        END

        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'StockDetail'
                AND columns.name = N'SourceRequisitionDetailId'
        )
        BEGIN
            ALTER TABLE dbo.StockDetail ADD SourceRequisitionDetailId int NULL;
        END

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StockHeader_SourceRequisitionId' AND object_id = OBJECT_ID(N'dbo.StockHeader'))
        BEGIN
            CREATE INDEX IX_StockHeader_SourceRequisitionId ON dbo.StockHeader (SourceRequisitionId);
        END

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StockDetail_SourceRequisitionDetailId' AND object_id = OBJECT_ID(N'dbo.StockDetail'))
        BEGIN
            CREATE INDEX IX_StockDetail_SourceRequisitionDetailId ON dbo.StockDetail (SourceRequisitionDetailId);
        END

        IF NOT EXISTS (SELECT 1 FROM dbo.Menu WHERE MenuId = 10)
        BEGIN
            SET IDENTITY_INSERT dbo.Menu ON;

            INSERT INTO dbo.Menu (MenuId, MenuCode, MenuName, MenuPath, SortOrder, IsActive)
            VALUES (10, 'APPROVALS', N'งานจัดของ', '/approvals', 3, 1);

            SET IDENTITY_INSERT dbo.Menu OFF;
        END
        ELSE
        BEGIN
            UPDATE dbo.Menu
            SET MenuCode = 'APPROVALS',
                MenuName = N'งานจัดของ',
                MenuPath = '/approvals',
                SortOrder = 3,
                IsActive = 1
            WHERE MenuId = 10;
        END

        UPDATE dbo.Menu SET SortOrder = 1 WHERE MenuCode = 'DASHBOARD';
        UPDATE dbo.Menu SET SortOrder = 2 WHERE MenuCode = 'STOCK_OUT';
        UPDATE dbo.Menu SET SortOrder = 3 WHERE MenuCode = 'APPROVALS';
        UPDATE dbo.Menu SET SortOrder = 4 WHERE MenuCode = 'STOCK_IN';
        UPDATE dbo.Menu SET SortOrder = 5 WHERE MenuCode = 'STOCK_ADJUST';
        UPDATE dbo.Menu SET SortOrder = 6 WHERE MenuCode = 'PRODUCTS';
        UPDATE dbo.Menu SET SortOrder = 7 WHERE MenuCode = 'HISTORY';
        UPDATE dbo.Menu SET SortOrder = 8 WHERE MenuCode = 'REPORTS';
        UPDATE dbo.Menu SET SortOrder = 9 WHERE MenuCode = 'USERS';
        UPDATE dbo.Menu SET SortOrder = 10 WHERE MenuCode = 'DEPARTMENTS';

        INSERT INTO dbo.EmployeeMenuPermission (EmployeeId, MenuId, CreatedDate)
        SELECT employee.EmployeeId, 10, GETDATE()
        FROM dbo.Employee employee
        WHERE employee.Permission = '1'
            AND NOT EXISTS (
                SELECT 1
                FROM dbo.EmployeeMenuPermission existingPermission
                WHERE existingPermission.EmployeeId = employee.EmployeeId
                    AND existingPermission.MenuId = 10
            );
    """);

    await UpsertStatus(dbContext, RequisitionStatuses.Pending, "รอจัดของ", "Requisition", 6);
    await UpsertStatus(dbContext, RequisitionStatuses.Approved, "ได้ของครบ", "Requisition", 7);
    await UpsertStatus(dbContext, RequisitionStatuses.Backlog, "ค้าง", "Requisition", 8);
    await UpsertStatus(dbContext, RequisitionStatuses.Rejected, "ไม่ให้เบิก", "Requisition", 9);
    await dbContext.SaveChangesAsync();
}

static async Task EnsureProductRemarkColumn(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'Product'
                AND columns.name = N'ProductRemark'
        )
        BEGIN
            ALTER TABLE dbo.Product
            ADD ProductRemark nvarchar(500) NOT NULL
                CONSTRAINT DF_Product_ProductRemark DEFAULT N''
        END
    """);
}

static async Task EnsureStockHeaderStatuses(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF EXISTS (
            SELECT 1
            FROM sys.columns columns
            INNER JOIN sys.tables tables
                ON columns.object_id = tables.object_id
            INNER JOIN sys.schemas schemas
                ON tables.schema_id = schemas.schema_id
            WHERE schemas.name = N'dbo'
                AND tables.name = N'Status'
                AND columns.name = N'StatusTable'
                AND columns.max_length < 100
        )
        BEGIN
            ALTER TABLE dbo.Status ALTER COLUMN StatusTable nvarchar(50) NULL
        END
    """);

    await UpsertStockHeaderStatus(dbContext, StockHeaderStatuses.Completed, "สำเร็จ", 3);
    await UpsertStockHeaderStatus(dbContext, StockHeaderStatuses.Cancelled, "ถอยยอด", 4);
    await UpsertStockHeaderStatus(dbContext, StockHeaderStatuses.PartiallyCancelled, "ถอยยอดบางส่วน", 5);

    await dbContext.SaveChangesAsync();

    await dbContext.Database.ExecuteSqlRawAsync("""
        UPDATE dbo.StockHeader
        SET Status = CASE Status
            WHEN 1 THEN 3
            WHEN 2 THEN 4
            WHEN 101 THEN 3
            WHEN 102 THEN 4
            ELSE Status
        END
        WHERE Status IN (1, 2, 101, 102)
    """);

    await dbContext.Database.ExecuteSqlRawAsync("""
        DELETE FROM dbo.Status
        WHERE StatusId IN (101, 102)
            AND StatusTable = N'StockHeader'
    """);
}

static async Task UpsertStockHeaderStatus(
    AppDbContext dbContext,
    int statusId,
    string statusName,
    int sortOrder)
{
    var status = await dbContext.Statuses.FindAsync(statusId);

    if (status is null)
    {
        dbContext.Statuses.Add(new Status
        {
            StatusId = statusId,
            StatusName = statusName,
            StatusTable = StockHeaderStatuses.TableName,
            StatusSortOrder = sortOrder,
            StatusIsActive = 1,
        });

        return;
    }

    status.StatusName = statusName;
    status.StatusTable = StockHeaderStatuses.TableName;
    status.StatusSortOrder = sortOrder;
    status.StatusIsActive = 1;
}

static async Task EnsureSupplierWorkflow(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'dbo.Supplier', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.Supplier (
                SupplierId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Supplier PRIMARY KEY,
                SupplierName nvarchar(150) NOT NULL,
                SupplierStatus int NOT NULL CONSTRAINT DF_Supplier_SupplierStatus DEFAULT 1,
                CreatedDate datetime2 NOT NULL CONSTRAINT DF_Supplier_CreatedDate DEFAULT GETDATE()
            );
        END

        IF COL_LENGTH(N'dbo.StockHeader', N'SupplierId') IS NULL
        BEGIN
            ALTER TABLE dbo.StockHeader ADD SupplierId int NULL;
        END

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StockHeader_SupplierId' AND object_id = OBJECT_ID(N'dbo.StockHeader'))
        BEGIN
            CREATE INDEX IX_StockHeader_SupplierId ON dbo.StockHeader(SupplierId);
        END

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Supplier_SupplierName' AND object_id = OBJECT_ID(N'dbo.Supplier'))
        BEGIN
            CREATE UNIQUE INDEX UX_Supplier_SupplierName ON dbo.Supplier(SupplierName);
        END
    """);
}

static async Task UpsertStatus(
    AppDbContext dbContext,
    int statusId,
    string statusName,
    string statusTable,
    int sortOrder)
{
    var status = await dbContext.Statuses.FindAsync(statusId);

    if (status is null)
    {
        dbContext.Statuses.Add(new Status
        {
            StatusId = statusId,
            StatusName = statusName,
            StatusTable = statusTable,
            StatusSortOrder = sortOrder,
            StatusIsActive = 1,
        });

        return;
    }

    status.StatusName = statusName;
    status.StatusTable = statusTable;
    status.StatusSortOrder = sortOrder;
    status.StatusIsActive = 1;
}
