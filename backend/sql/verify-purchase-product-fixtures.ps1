$ErrorActionPreference = 'Stop'
$config = Get-Content (Join-Path $PSScriptRoot '../src/StockIssueSystem.Api/appsettings.json') -Raw | ConvertFrom-Json
$connection = New-Object System.Data.SqlClient.SqlConnection($config.ConnectionStrings.DefaultConnection)
$connection.Open()
try {
    $q = $connection.CreateCommand()
    $q.CommandText = @'
CREATE TABLE #StockHeader(HeaderId int, DocType nvarchar(20), Status int, TransactionDate datetime2);
CREATE TABLE #StockDetail(DetailId int, ProductId nvarchar(50), ProductName nvarchar(200), Category nvarchar(100), Unit nvarchar(20));
CREATE TABLE #StockCostLot(ReceiveDetailId int, ReceiveHeaderId int, Status int, OriginalQty int, UnitCost decimal(18,4), VatAmount decimal(18,4));
INSERT #StockHeader VALUES (1,N'RECEIVE',1,'2026-10-14T23:59:59'),(2,N'RECEIVE',1,'2026-10-15'),(3,N'RECEIVE',4,'2026-10-15'),(4,N'ISSUE',1,'2026-10-15'),(5,N'RECEIVE',1,'2026-10-16');
INSERT #StockDetail VALUES (1,N'A',N'สินค้า A',N'เครื่องเขียน',N'ชิ้น'),(2,N'B',N'สินค้า B',N'เครื่องเขียน',N'ชิ้น');
INSERT #StockCostLot VALUES (1,1,1,10,2,1.4),(1,2,1,5,3,1.05),(1,2,1,2,4,0.56),(2,2,1,3,0,0),(1,3,1,999,9,9),(1,4,1,999,9,9),(1,2,2,999,9,9),(1,5,1,4,5,1.4);
'@
    [void]$q.ExecuteNonQuery()
    $sql = Get-Content (Join-Path $PSScriptRoot 'usp_ReportPurchaseProductLots.sql') -Raw
    $q.CommandText = $sql.Replace('dbo.usp_ReportPurchaseProductLots','#ReportTest').Replace('dbo.StockCostLot','#StockCostLot').Replace('dbo.StockDetail','#StockDetail').Replace('dbo.StockHeader','#StockHeader')
    [void]$q.ExecuteNonQuery()
    foreach($test in @(
        @{Sql="EXEC #ReportTest NULL,NULL"; Count=5; Qty=24; Amount=63},
        @{Sql="EXEC #ReportTest '2026-10-15','2026-10-16'"; Count=3; Qty=10; Amount=23},
        @{Sql="EXEC #ReportTest NULL,'2026-10-15'"; Count=1; Qty=10; Amount=20},
        @{Sql="EXEC #ReportTest '2026-10-16',NULL"; Count=1; Qty=4; Amount=20},
        @{Sql="EXEC #ReportTest '2026-10-15','2026-10-15'"; Count=0; Qty=0; Amount=0}
    )) {
        $q.CommandText=$test.Sql
        $data=New-Object System.Data.DataTable
        $adapter=New-Object System.Data.SqlClient.SqlDataAdapter($q)
        [void]$adapter.Fill($data)
        $qty=0; $amount=[decimal]0
        foreach($row in $data.Rows){$qty+=$row.OriginalQty; $amount+=$row.OriginalQty*$row.UnitCost}
        if($data.Rows.Count -ne $test.Count -or $qty -ne $test.Qty -or $amount -ne $test.Amount){throw "Fixture failed: $($test.Sql)"}
        Write-Output "PASS: $($test.Sql) rows=$($data.Rows.Count) qty=$qty amount=$amount"
    }
} finally { $connection.Close() }
