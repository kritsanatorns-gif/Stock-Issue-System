import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { FileSpreadsheet, PackageCheck, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { formatDisplayDateTime, getIdSortValue } from '../../utils/dateUtils'
import { exportRowsToExcel } from '../../utils/excelUtils'
import { normalizeBarcodeInput } from '../../utils/inputGuards'
import AppTable from './AppTable'

const columns = [
  { key: 'workOrder', label: 'Work Order', width: 120, align: 'center' },
  { key: 'productId', label: 'Product Id', width: 260, align: 'center' },
  { key: 'productName', label: 'Product Name', width: 260, align: 'center' },
  { key: 'area', label: 'Area', width: 170, align: 'center' },
  { key: 'qtyFull', label: 'Qty Full', width: 130, align: 'center' },
  { key: 'qty', label: 'Qty', width: 130, align: 'center' },
  { key: 'user', label: 'User', width: 120, align: 'center' },
  {
    key: 'createdDate',
    label: 'Created Date',
    width: 170,
    align: 'center',
    value: (row) => formatDisplayDateTime(row.createdDate),
    sortValue: (row) => getIdSortValue(row.id, row.detailId, row.headerId, row.workOrder)
      || Date.parse(row.createdDate ?? '')
      || 0,
  },
]

const exportColumns = columns.map((column) => ({
  header: column.label,
  value: (row) => row[column.key],
}))

function StockMovementTableEnglish({ rows, scanPlaceholder, title }) {
  const [scanText, setScanText] = useState('')
  const canScan = Boolean(scanText.trim())

  const handleRefresh = () => {
    setScanText('')
  }

  const handleExport = () => {
    exportRowsToExcel(rows, exportColumns, `${title.replaceAll(' ', '-')}.xlsx`)
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ color: '#111827', fontSize: 18, fontWeight: 700 }}>
          {title}
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<FileSpreadsheet size={18} />}
            sx={{ fontWeight: 700 }}
            variant="outlined"
            onClick={handleExport}
          >
            ส่งออก Excel
          </Button>
          <Button
            startIcon={<RefreshCw size={18} />}
            sx={{ fontWeight: 700 }}
            variant="outlined"
            onClick={handleRefresh}
          >
            รีเฟรช
          </Button>
        </Stack>
      </Box>

      <Card elevation={0} sx={{ border: '1px solid #d9e0ea', borderRadius: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <TextField
              autoFocus
              fullWidth
              helperText="Use only English letters, numbers, and . _ / -"
              placeholder={scanPlaceholder}
              size="small"
              value={scanText}
              onChange={(event) => setScanText(normalizeBarcodeInput(event.target.value))}
            />
            <Button
              disabled={!canScan}
              startIcon={<PackageCheck size={18} />}
              sx={{ fontWeight: 700, minWidth: 108 }}
              variant="contained"
            >
              Scan
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <AppTable
        columns={columns}
        defaultSortField="createdDate"
        defaultSortDirection="desc"
        maxHeight="calc(100vh - 310px)"
        noDataText="No records found"
        rowKey={(row) => `${row.workOrder}-${row.productId}-${row.createdDate}`}
        rows={rows}
        showGlobalSearch
      />
    </Stack>
  )
}

export default StockMovementTableEnglish
