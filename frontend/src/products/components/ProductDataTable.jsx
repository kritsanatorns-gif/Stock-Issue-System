import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { Coins, FileText, Pencil } from 'lucide-react'
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
  return (
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
            rows.map((row, index) => (
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
    </Box>
  )
}

function ProductMovementDetails({ error, isLoading, movement }) {
  const receives = movement?.receives ?? movement?.Receives ?? []
  const issues = movement?.issues ?? movement?.Issues ?? []

  const receiveColumns = [
    {
      key: 'dateText',
      label: 'วันที่รับเข้า',
      render: (row) => formatDisplayDateTime(readValue(row, 'date', 'Date') ?? readValue(row, 'dateText', 'DateText')),
    },
    {
      key: 'receiveQty',
      label: 'รับเข้าจริง',
      render: (row) =>
        `${formatQty(readValue(row, 'receiveQty', 'ReceiveQty') ?? readValue(row, 'qty', 'Qty'))} ${readValue(row, 'receiveUnit', 'ReceiveUnit') || readValue(row, 'unit', 'Unit') || ''}`,
    },
    {
      key: 'qty',
      label: 'เพิ่มสต๊อก',
      render: (row) => `${formatQty(readValue(row, 'qty', 'Qty'))} ${readValue(row, 'unit', 'Unit') || ''}`,
    },
    {
      key: 'costLot',
      label: 'ราคาซื้อ',
      render: (row) => formatMoney(readValue(row, 'costLot', 'CostLot')),
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
            ประวัตินำเข้า
          </Typography>
          <Chip label={`${receives.length} รอบ`} size="small" />
        </Stack>
        <MovementMiniTable columns={receiveColumns} noDataText="ยังไม่มีประวัตินำเข้า" rows={receives} />
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
    { key: 'barcode', label: 'Barcode', width: 155 },
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
      key: 'currentUnitCost',
      label: 'ต้นทุน FIFO',
      width: 115,
      render: (row) => formatMoney(row.currentUnitCost),
    },
    {
      key: 'remainingCostValue',
      label: 'มูลค่าของที่ยังไม่ถูกเบิก',
      width: 130,
      render: (row) => formatMoney(row.remainingCostValue),
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
      label: 'รายละเอียด',
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
      defaultSortField="productId"
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
    />
  )
}

export default ProductDataTable
