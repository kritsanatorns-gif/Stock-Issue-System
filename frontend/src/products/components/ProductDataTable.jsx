import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Coins, FileText, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppTable from '../../components/common/AppTable'
import { formatDisplayDateTime } from '../../utils/dateUtils'

function formatMoney(value) {
  return Number(value ?? 0).toLocaleString('th-TH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function formatQty(value) {
  return Number(value ?? 0).toLocaleString('th-TH', {
    maximumFractionDigits: 2,
  })
}

function readValue(row, camelKey, pascalKey = camelKey) {
  return row?.[camelKey] ?? row?.[pascalKey]
}

function MovementMiniTable({ columns, noDataText, rows }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const lastPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1)
  const safePage = Math.min(page, lastPage)
  const visibleRows = rows.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage)

  useEffect(() => {
    setPage(0)
  }, [rows.length])

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value))
    setPage(0)
  }

  return (
    <Box>
      <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
        <Typography sx={{ color: '#475569', fontSize: 12 }}>แสดงต่อหน้า:</Typography>
        <TextField
          select
          size="small"
          sx={{ width: 76, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
        >
          {[5, 10, 20, 50].map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
        </TextField>
      </Stack>
      <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 1.5, overflow: 'hidden' }}>
        <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align ?? 'center'}
                sx={{
                  bgcolor: '#ffffff',
                  borderBottom: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length ? (
            visibleRows.map((row, index) => (
              <TableRow key={`${readValue(row, 'headerId', 'HeaderId') ?? ''}-${readValue(row, 'detailId', 'DetailId') ?? index}`}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align ?? 'center'}
                    sx={{ fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    {column.render ? column.render(row) : readValue(row, column.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell align="center" colSpan={columns.length} sx={{ py: 3 }}>
                {noDataText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        </Table>
        {rows.length > 0 ? (
          <TablePagination
            component="div"
            count={rows.length}
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
            labelRowsPerPage=""
            page={safePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            sx={{ borderTop: '1px solid #e2e8f0', minHeight: 42, '& .MuiTablePagination-toolbar': { minHeight: 42 } }}
          />
        ) : null}
      </Box>
    </Box>
  )
}

function ProductMovementDetails({ error, isLoading, movement }) {
  const receives = movement?.receives ?? movement?.Receives ?? []
  const adjustments = movement?.adjustments ?? movement?.Adjustments ?? []
  const inboundRows = [
    ...receives.map((row) => ({ ...row, movementType: 'รับเข้า' })),
    ...adjustments.map((row) => ({ ...row, movementType: 'ปรับสต๊อก' })),
  ].sort((firstRow, secondRow) => new Date(readValue(secondRow, 'date', 'Date')) - new Date(readValue(firstRow, 'date', 'Date')))
  const issues = movement?.issues ?? movement?.Issues ?? []

  const receiveColumns = [
    {
      key: 'movementType',
      label: 'ประเภท',
      render: (row) => {
        const isAdjustment = readValue(row, 'movementType') === 'ปรับสต๊อก'
        return <Chip color={isAdjustment ? 'warning' : 'success'} label={readValue(row, 'movementType')} size="small" />
      },
    },
    {
      key: 'dateText',
      label: 'วันที่ทำรายการ',
      render: (row) => formatDisplayDateTime(readValue(row, 'date', 'Date') ?? readValue(row, 'dateText', 'DateText')),
    },
    {
      key: 'receiveQty',
      label: 'จำนวนรับเข้า',
      render: (row) =>
        readValue(row, 'movementType') === 'ปรับสต๊อก'
          ? '-'
          : `${formatQty(readValue(row, 'receiveQty', 'ReceiveQty') ?? readValue(row, 'qty', 'Qty'))} ${readValue(row, 'receiveUnit', 'ReceiveUnit') || readValue(row, 'unit', 'Unit') || ''}`,
    },
    {
      key: 'qty',
      label: 'ผลต่อสต๊อก',
      render: (row) => `${formatQty(readValue(row, 'qty', 'Qty'))} ${readValue(row, 'unit', 'Unit') || ''}`,
    },
    {
      key: 'costLot',
      label: 'ราคาซื้อ',
      render: (row) => readValue(row, 'movementType') === 'ปรับสต๊อก' ? '-' : formatMoney(readValue(row, 'costLot', 'CostLot')),
    },
    { key: 'employeeId', label: 'ผู้ทำรายการ', align: 'center' },
  ]

  const issueColumns = [
    {
      key: 'dateText',
      label: 'วันที่เบิก',
      render: (row) => formatDisplayDateTime(readValue(row, 'date', 'Date') ?? readValue(row, 'dateText', 'DateText')),
    },
    {
      key: 'qty',
      label: 'จำนวนเบิก',
      render: (row) => `${formatQty(readValue(row, 'qty', 'Qty'))} ${readValue(row, 'unit', 'Unit') || ''}`,
    },
    {
      key: 'department',
      label: 'แผนก',
      render: (row) => readValue(row, 'department', 'Department') || '-',
    },
    { key: 'employeeId', label: 'ผู้ทำรายการ', align: 'center' },
  ]

  if (isLoading) {
    return (
      <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5, justifyContent: 'center', py: 5 }}>
        <CircularProgress size={22} />
        <Typography sx={{ color: '#475569', fontSize: 14 }}>กำลังโหลดประวัติสินค้า...</Typography>
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>
  }

  return (
    <Stack direction="row" spacing={1.5} sx={{ width: '100%' }}>
      <Box sx={{ flex: 1, minWidth: 0, width: '50%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ color: '#0f172a', fontSize: 15, fontWeight: 800 }}>
            ประวัติรับเข้า / ปรับสต๊อก
          </Typography>
          <Chip label={`${inboundRows.length} รอบ`} size="small" />
        </Stack>
        <MovementMiniTable columns={receiveColumns} noDataText="ยังไม่มีประวัติรับเข้า/ปรับสต๊อก" rows={inboundRows} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, width: '50%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ color: '#0f172a', fontSize: 15, fontWeight: 800 }}>
            ประวัติเบิก
          </Typography>
          <Chip label={`${issues.length} รอบ`} size="small" />
        </Stack>
        <MovementMiniTable columns={issueColumns} noDataText="ยังไม่มีประวัติเบิก" rows={issues} />
      </Box>
    </Stack>
  )
}

function ProductDataTable({
  data,
  expandedProductId,
  isLoading,
  movementData,
  movementErrors,
  movementLoading,
  onEdit,
  onToggleMovements,
  onViewCostLots,
  onViewRemark,
  statusFilter,
  onStatusFilterChange,
}) {
  const columns = [
    {
      key: 'edit',
      label: 'แก้ไข',
      width: 95,
      align: 'center',
      searchable: false,
      sortable: false,
      render: (row) => (
        <Button
          startIcon={<Pencil size={16} />}
          size="small"
          variant="outlined"
          onClick={() => onEdit(row)}
        >
          แก้ไข
        </Button>
      ),
    },
    { key: 'productId', label: 'รหัสสินค้า', width: 145 },
    { key: 'productName', label: 'ชื่อสินค้า', width: 230 },
    { key: 'categoryName', label: 'หมวดหมู่', width: 120, align: 'center' },
    {
      key: 'receiveUnit',
      label: 'รับเข้าเป็น',
      width: 105,
      align: 'center',
      render: (row) => row.receiveUnit || '-',
    },
    {
      key: 'issueUnit',
      label: 'เบิกออกเป็น',
      width: 105,
      align: 'center',
      render: (row) => row.issueUnit || '-',
    },
    { key: 'stockQty', label: 'ยอดคงเหลือ', width: 115 },
    {
      key: 'minQty',
      label: 'Min Stock',
      width: 105,
      align: 'center',
      value: (row) => Number(row.minQty ?? 10).toLocaleString('th-TH', { maximumFractionDigits: 2 }),
    },
    {
      key: 'stockStatus',
      label: 'สถานะสต๊อก',
      width: 125,
      align: 'center',
      searchable: false,
      sortValue: (row) => {
        const stockQty = Number(row.stockQty ?? 0)
        const minQty = Number(row.minQty ?? 10)

        if (stockQty > minQty) return 1
        if (stockQty > 0) return 2
        return 3
      },
      render: (row) => {
        const stockQty = Number(row.stockQty ?? 0)
        const minQty = Number(row.minQty ?? 10)
        const status = stockQty <= 0
          ? { color: 'error', label: 'หมด' }
          : stockQty <= minQty
            ? { color: 'warning', label: 'ใกล้หมด' }
            : { color: 'success', label: 'พร้อมเบิก' }

        return <Chip color={status.color} label={status.label} size="small" />
      },
    },
    {
      key: 'currentUnitCost',
      label: 'ต้นทุน FIFO',
      width: 115,
      render: (row) => formatMoney(row.currentUnitCost),
    },
    {
      key: 'costLots',
      label: 'รายละเอียดต้นทุน',
      width: 125,
      align: 'center',
      searchable: false,
      sortable: false,
      render: (row) => {
        const hasCostLots = Number(row.remainingCostValue ?? 0) > 0

        return (
          <Button
            disabled={!hasCostLots}
            size="small"
            startIcon={<Coins size={15} />}
            variant={hasCostLots ? 'outlined' : 'text'}
            onClick={() => onViewCostLots(row)}
          >
            {hasCostLots ? 'ดูต้นทุน' : 'ไม่มีต้นทุน'}
          </Button>
        )
      },
    },
    {
      key: 'productRemark',
      label: 'หมายเหตุสินค้า',
      width: 135,
      align: 'center',
      searchable: false,
      sortable: false,
      render: (row) => {
        const hasRemark = Boolean(String(row.productRemark ?? '').trim())

        return (
          <Button
            disabled={!hasRemark}
            size="small"
            startIcon={<FileText size={15} />}
            variant={hasRemark ? 'outlined' : 'text'}
            onClick={() => onViewRemark(row, 'product')}
          >
            {hasRemark ? 'ดูหมายเหตุ' : 'ไม่มีหมายเหตุ'}
          </Button>
        )
      },
    },
    {
      key: 'lastRemark',
      label: 'รายละเอียดรับเข้า',
      width: 125,
      align: 'center',
      searchable: false,
      sortable: false,
      render: (row) => {
        const hasRemark = Boolean(String(row.lastRemark ?? '').trim())

        return (
          <Button
            disabled={!hasRemark}
            size="small"
            startIcon={<FileText size={15} />}
            variant={hasRemark ? 'outlined' : 'text'}
            onClick={() => onViewRemark(row, 'latest')}
          >
            {hasRemark ? 'ดูรายละเอียด' : 'ไม่มีรายละเอียด'}
          </Button>
        )
      },
    },
    {
      key: 'status',
      label: 'สถานะ',
      width: 100,
      align: 'center',
      render: (row) => (
        <Chip
          color={row.status === 'Active' ? 'success' : 'error'}
          label={row.status === 'Active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
          size="small"
        />
      ),
    },
  ]

  return (
    <AppTable
      columns={columns}
      defaultSortDirection="asc"
      defaultSortField="stockStatus"
      expandable
      isLoading={isLoading}
      isRowExpanded={(row) => expandedProductId === row.productId}
      noDataText="ไม่พบข้อมูลสินค้า"
      onToggleRow={onToggleMovements}
      renderExpandedRow={(row) => (
        <ProductMovementDetails
          error={movementErrors[row.productId]}
          isLoading={movementLoading[row.productId]}
          movement={movementData[row.productId]}
        />
      )}
      rowKey="productId"
      rows={data}
      showGlobalSearch
      toolbarContent={
        <TextField
          select
          label="สถานะสต็อก"
          size="small"
          sx={{ minWidth: 160 }}
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          <MenuItem value="all">ทั้งหมด</MenuItem>
          <MenuItem value="ready">พร้อมเบิก</MenuItem>
          <MenuItem value="low">ใกล้หมด</MenuItem>
          <MenuItem value="out">หมด</MenuItem>
        </TextField>
      }
    />
  )
}

export default ProductDataTable
