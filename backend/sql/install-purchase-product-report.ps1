$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot '../src/StockIssueSystem.Api/appsettings.json'
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$connection = New-Object System.Data.SqlClient.SqlConnection($config.ConnectionStrings.DefaultConnection)
$connection.Open()
if ($connection.Database -ne 'StockIssueSystem') { throw 'Unexpected database; installation stopped.' }
$backupDirectory = Join-Path $PSScriptRoot '../../../.tmp/procedure-backups'
[void](New-Item -ItemType Directory -Path $backupDirectory -Force)
$transaction = $connection.BeginTransaction([System.Data.IsolationLevel]::Serializable)
try {
    $command = $connection.CreateCommand()
    $command.Transaction = $transaction
    $command.CommandText = "SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_ReportPurchaseProductLots'))"
    $previous = $command.ExecuteScalar()
    $rollback = if ($previous -is [string]) { $previous } else { 'DROP PROCEDURE IF EXISTS dbo.usp_ReportPurchaseProductLots;' }
    $backupPath = Join-Path $backupDirectory ('purchase-product-rollback-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
    [System.IO.File]::WriteAllText($backupPath, $rollback)
    $command.CommandText = Get-Content (Join-Path $PSScriptRoot 'usp_ReportPurchaseProductLots.sql') -Raw
    [void]$command.ExecuteNonQuery()
    $baseline = @'
SELECT detail.ProductId, detail.ProductName, detail.Category, detail.Unit,
       lot.OriginalQty, lot.UnitCost, lot.VatAmount
FROM dbo.StockCostLot lot
JOIN dbo.StockDetail detail ON lot.ReceiveDetailId=detail.DetailId
JOIN dbo.StockHeader header ON lot.ReceiveHeaderId=header.HeaderId
WHERE header.DocType=N'RECEIVE' AND header.Status<>4 AND lot.Status<>2
  AND (@StartDate IS NULL OR header.TransactionDate>=@StartDate)
  AND (@EndExclusive IS NULL OR header.TransactionDate<@EndExclusive)
'@
    $today = [DateTime]::Today
    $cases = @(
        @{Name='All dates'; Start=$null; End=$null},
        @{Name='Today'; Start=$today; End=$today.AddDays(1)},
        @{Name='From month start'; Start=$today.AddDays(1-$today.Day); End=$null},
        @{Name='Before today'; Start=$null; End=$today},
        @{Name='Empty range'; Start=$today; End=$today}
    )
    foreach ($case in $cases) {
        $command.Parameters.Clear()
        $start = $command.Parameters.Add('@StartDate',[System.Data.SqlDbType]::DateTime2)
        $end = $command.Parameters.Add('@EndExclusive',[System.Data.SqlDbType]::DateTime2)
        $start.Value = if ($null -eq $case.Start) { [DBNull]::Value } else { $case.Start }
        $end.Value = if ($null -eq $case.End) { [DBNull]::Value } else { $case.End }
        $sets = @()
        foreach ($query in @($baseline,'EXEC dbo.usp_ReportPurchaseProductLots @StartDate, @EndExclusive')) {
            $command.CommandText = $query
            $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
            $data = New-Object System.Data.DataTable
            [void]$adapter.Fill($data)
            $serialized = @($data.Rows | ForEach-Object {
                ConvertTo-Json -InputObject @($_.ItemArray) -Compress
            } | Sort-Object)
            $sets += ,$serialized
        }
        if (($sets[0] -join "`n") -cne ($sets[1] -join "`n")) { throw "Results differ: $($case.Name)" }
        Write-Output "$($case.Name): identical ($($sets[0].Count) rows)"
    }
    $transaction.Commit()
    Write-Output "Installed in $($connection.DataSource)/$($connection.Database). Rollback: $backupPath"
} catch { $transaction.Rollback(); throw } finally { $connection.Close() }
