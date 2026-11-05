# สำรอง SP เดิมก่อนติดตั้ง และตรวจด้วยข้อมูลจำลองในตารางชั่วคราว ไม่แก้ข้อมูลธุรกิจ
$ErrorActionPreference='Stop'
$config=Get-Content (Join-Path $PSScriptRoot '../src/StockIssueSystem.Api/appsettings.json') -Raw | ConvertFrom-Json
$c=New-Object System.Data.SqlClient.SqlConnection($config.ConnectionStrings.DefaultConnection)
$c.Open()
if($c.Database -ne 'StockIssueSystem'){throw 'Unexpected database'}
$tx=$c.BeginTransaction()
try {
 $q=$c.CreateCommand();$q.Transaction=$tx
 $directory=Join-Path $PSScriptRoot '../../../.tmp/procedure-backups'
 [void](New-Item -ItemType Directory -Path $directory -Force)
 foreach($name in @('usp_ReportPurchaseProductLots','usp_ReportPurchaseSupplierLots')){
  $q.CommandText="SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.$name'))"
  $old=$q.ExecuteScalar()
  if($old -isnot [string]){$old="DROP PROCEDURE IF EXISTS dbo.$name;"}
  [IO.File]::WriteAllText((Join-Path $directory ($name+'-'+(Get-Date -Format yyyyMMdd-HHmmss)+'.sql')),$old)
  $q.CommandText=Get-Content (Join-Path $PSScriptRoot ($name+'.sql')) -Raw -Encoding UTF8
  [void]$q.ExecuteNonQuery()
 }
 $q.CommandText=@'
CREATE TABLE #StockHeader(HeaderId int, DocType nvarchar(20), Status int, TransactionDate datetime2);
CREATE TABLE #StockCostLot(SupplierId int NULL, SupplierName nvarchar(100), ReceiveHeaderId int, OriginalQty int, UnitCost decimal(18,4), VatAmount decimal(18,4), Status int);
INSERT #StockHeader VALUES (1,'RECEIVE',1,'2026-10-15'),(2,'RECEIVE',1,'2026-09-15'),(3,'RECEIVE',4,'2026-10-15'),(4,'ISSUE',1,'2026-10-15'),(5,'RECEIVE',1,'2025-10-15');
INSERT #StockCostLot VALUES (1,'A',1,10,2,1.4,1),(1,'A',1,5,3,1.05,1),(2,'B',2,4,5,1.4,1),(NULL,'',1,999,9,9,1),(1,'A',3,999,9,9,1),(1,'A',4,999,9,9,1),(1,'A',1,999,9,9,2),(2,'B',5,2,0,0,1);
'@
 [void]$q.ExecuteNonQuery()
 $sql=Get-Content (Join-Path $PSScriptRoot 'usp_ReportPurchaseSupplierLots.sql') -Raw -Encoding UTF8
 $q.CommandText=$sql.Replace('dbo.usp_ReportPurchaseSupplierLots','#SupplierTest').Replace('dbo.StockCostLot','#StockCostLot').Replace('dbo.StockHeader','#StockHeader')
 [void]$q.ExecuteNonQuery()
 foreach($case in @(
  @{Args='NULL,NULL,NULL,NULL';Count=4;Qty=21;Amount=55},
  @{Args='2026,10,NULL,NULL';Count=2;Qty=15;Amount=35},
  @{Args='NULL,10,NULL,NULL';Count=3;Qty=17;Amount=35},
  @{Args="NULL,NULL,'2026-10-15','2026-10-16'";Count=2;Qty=15;Amount=35},
  @{Args="2026,9,'2026-10-15',NULL";Count=0;Qty=0;Amount=0},
  @{Args="NULL,NULL,NULL,'2026-10-15'";Count=2;Qty=6;Amount=20}
 )){
  $q.CommandText='EXEC #SupplierTest '+$case.Args
  $a=New-Object System.Data.SqlClient.SqlDataAdapter($q);$d=New-Object System.Data.DataTable
  [void]$a.Fill($d)
  $qty=0;$amount=[decimal]0
  foreach($row in $d.Rows){$qty+=$row.OriginalQty;$amount+=$row.OriginalQty*$row.UnitCost}
  if($d.Rows.Count -ne $case.Count -or $qty -ne $case.Qty -or $amount -ne $case.Amount){throw "Fixture failed: $($case.Args)"}
  Write-Output "PASS $($case.Args): rows=$($d.Rows.Count), quantity=$qty, amount=$amount"
 }
 # เทียบชุดข้อมูลจริงแบบไม่กรองวันที่กับคำสั่งเดิมใน API
 $sets=@()
 foreach($query in @("SELECT lot.SupplierId,lot.SupplierName,lot.ReceiveHeaderId,lot.OriginalQty,lot.UnitCost,lot.VatAmount FROM dbo.StockCostLot lot JOIN dbo.StockHeader header ON lot.ReceiveHeaderId=header.HeaderId WHERE header.DocType=N'RECEIVE' AND header.Status<>4 AND lot.Status<>2 AND lot.SupplierId IS NOT NULL",'EXEC dbo.usp_ReportPurchaseSupplierLots')){
  $q.CommandText=$query
  $a=New-Object System.Data.SqlClient.SqlDataAdapter($q);$d=New-Object System.Data.DataTable
  [void]$a.Fill($d)
  $sets+=,@($d.Rows | ForEach-Object {ConvertTo-Json -InputObject @($_.ItemArray) -Compress} | Sort-Object)
 }
 if(($sets[0] -join "`n") -cne ($sets[1] -join "`n")){throw 'Live data comparison failed'}
 Write-Output "Live comparison identical: $($sets[0].Count) rows"
 $tx.Commit()
 Write-Output "Installed both procedures with Thai comments. Backups: $directory"
}catch{$tx.Rollback();throw}finally{$c.Close()}
