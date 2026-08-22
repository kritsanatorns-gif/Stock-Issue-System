import { Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { Pencil, Plus, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createSupplier, getPurchasesBySupplier, getSupplierPurchaseItems, getSuppliers, updateSupplier, updateSupplierStatus } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { formatDisplayDate, getDateSortValue } from '../../utils/dateUtils'

const money = (value) => Number(value ?? 0).toLocaleString('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function SuppliersPage() {
  const [year, setYear] = useState(dayjs().year())
  const [purchaseRows, setPurchaseRows] = useState([])
  const [expandedSupplierId, setExpandedSupplierId] = useState(null)
  const [purchaseItemsBySupplier, setPurchaseItemsBySupplier] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [supplierRows, setSupplierRows] = useState([])
  const [supplierForm, setSupplierForm] = useState('')
  const [supplierStatus, setSupplierStatus] = useState(1)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [isSavingSupplier, setIsSavingSupplier] = useState(false)

  const loadSupplierRows = async () => {
    try {
      const rows = await getSuppliers()
      setSupplierRows(Array.isArray(rows) ? rows : [])
    } catch {
      setSupplierRows([])
    }
  }

  const handleSaveSupplier = async () => {
    const name = supplierForm.trim()
    if (!name) return

    setIsSavingSupplier(true)
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.supplierId, name)
        if (Number(editingSupplier.supplierStatus ?? 1) !== Number(supplierStatus)) {
          await updateSupplierStatus(editingSupplier.supplierId, Number(supplierStatus))
        }
      } else {
        const createdSupplier = await createSupplier({ supplierName: name })
        if (Number(supplierStatus) !== 1) {
          await updateSupplierStatus(createdSupplier.supplierId, Number(supplierStatus))
        }
      }
      setSupplierForm('')
      setSupplierStatus(1)
      setEditingSupplier(null)
      await loadSupplierRows()
    } finally {
      setIsSavingSupplier(false)
    }
  }

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setExpandedSupplierId(null)
    setPurchaseItemsBySupplier({})

    getPurchasesBySupplier({ year })
      .then((rows) => active && setPurchaseRows(Array.isArray(rows) ? rows : []))
      .catch(() => active && setPurchaseRows([]))
      .finally(() => active && setIsLoading(false))

    getSuppliers()
      .then((rows) => active && setSupplierRows(Array.isArray(rows) ? rows : []))
      .catch(() => active && setSupplierRows([]))

    return () => { active = false }
  }, [year])

  const toggleSupplier = async (supplier) => {
    if (expandedSupplierId === supplier.supplierId) {
      setExpandedSupplierId(null)
      return
    }

    setExpandedSupplierId(supplier.supplierId)
    if (purchaseItemsBySupplier[supplier.supplierId]) {
      return
    }

    setIsLoadingItems(true)
    try {
      const rows = await getSupplierPurchaseItems(supplier.supplierId, { year })
      setPurchaseItemsBySupplier((current) => ({
        ...current,
        [supplier.supplierId]: Array.isArray(rows) ? rows : [],
      }))
    } catch {
      setPurchaseItemsBySupplier((current) => ({ ...current, [supplier.supplierId]: [] }))
    } finally {
      setIsLoadingItems(false)
    }
  }

  const supplierColumns = [
    {
      key: 'actions',
      label: 'แก้ไข',
      width: 130,
      align: 'center',
      sortable: false,
      searchable: false,
      render: (row) => (
        <Button startIcon={<Pencil size={16} />} size="small" variant="outlined" onClick={() => {
          const supplier = supplierRows.find((item) => item.supplierId === row.supplierId) ?? row
          setEditingSupplier(supplier)
          setSupplierForm(supplier.supplierName ?? '')
          setSupplierStatus(Number(supplier.supplierStatus ?? 1))
          setIsManageOpen(true)
        }}>แก้ไข</Button>
      ),
    },
    { key: 'supplierName', label: 'ผู้ขาย', minWidth: 240 },
    { key: 'documentCount', label: 'ใบรับเข้า', width: 110, align: 'center' },
    { key: 'itemCount', label: 'รายการ', width: 100, align: 'center' },
    { key: 'totalQty', label: 'จำนวนที่ซื้อ', width: 130, align: 'center' },
    { key: 'totalPurchase', label: 'ยอดซื้อรวม', width: 170, align: 'right', render: (row) => `${money(row.totalPurchase)} บาท` },
    {
      key: 'supplierStatus',
      label: 'สถานะ',
      width: 120,
      align: 'center',
      searchable: false,
      render: (row) => {
        const status = Number(supplierRows.find((item) => item.supplierId === row.supplierId)?.supplierStatus ?? 1)
        return <Chip color={status === 1 ? 'success' : 'error'} label={status === 1 ? 'ใช้งาน' : 'ยกเลิกใช้งาน'} size="small" />
      },
    },
  ]
  const itemColumns = [
    { key: 'receivedAt', label: 'วันที่รับเข้า', width: 130, value: (row) => formatDisplayDate(row.receivedAt), sortValue: (row) => getDateSortValue(row.receivedAt) },
    { key: 'poInvoiceNo', label: 'PO / Invoice', width: 160, value: (row) => row.poInvoiceNo || '-' },
    { key: 'productCode', label: 'รหัสสินค้า', width: 130 },
    { key: 'productName', label: 'สินค้า', minWidth: 230 },
    { key: 'quantity', label: 'จำนวน', width: 100, align: 'center', render: (row) => `${Number(row.quantity ?? 0).toLocaleString('th-TH')} ${row.unit ?? ''}` },
    { key: 'unitCost', label: 'ต้นทุน/หน่วย', width: 130, align: 'right', render: (row) => money(row.unitCost) },
    { key: 'totalPurchase', label: 'ยอดซื้อ', width: 140, align: 'right', render: (row) => `${money(row.totalPurchase)} บาท` },
  ]

  return (
    <Stack spacing={2.5}>
      <Grid container alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, sm: 'grow' }}>
          <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 900 }}>จัดการผู้ขาย</Typography>
          <Typography color="text.secondary">ดูยอดซื้อและรายการสินค้าที่ซื้อจากผู้ขายแต่ละราย</Typography>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <Stack direction="row" spacing={1}>
          <TextField select label="ปี" size="small" value={year} onChange={(event) => setYear(Number(event.target.value))} sx={{ width: 120 }}>
            {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </TextField>
          <Button startIcon={<Plus size={18} />} variant="contained" onClick={() => { setEditingSupplier(null); setSupplierForm(''); setSupplierStatus(1); setIsManageOpen(true) }}>
            เพิ่มผู้ขาย
          </Button>
        </Stack>
      </Box>

      <Card>
        <CardContent sx={{ p: 2 }}>
          <AppTable
            columns={supplierColumns}
            rows={purchaseRows}
            rowKey="supplierId"
            isLoading={isLoading}
            noDataText="ยังไม่มีข้อมูลการซื้อจากผู้ขาย"
            showGlobalSearch
            expandable
            isRowExpanded={(row) => expandedSupplierId === row.supplierId}
            onToggleRow={toggleSupplier}
            renderExpandedRow={(supplier) => (
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 900, mb: 1.25 }}>
                  รายการสินค้าที่ซื้อจาก {supplier.supplierName}
                </Typography>
                <AppTable
                  columns={itemColumns}
                  rows={purchaseItemsBySupplier[supplier.supplierId] ?? []}
                  rowKey={(row) => `${row.receiveHeaderId}-${row.productCode}-${row.receivedAt}`}
                  isLoading={isLoadingItems && expandedSupplierId === supplier.supplierId}
                  maxHeight={360}
                  noDataText="ไม่พบรายการซื้อของผู้ขายนี้"
                  showColumnFilters={false}
                />
              </Box>
            )}
          />
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="sm" open={isManageOpen} onClose={() => !isSavingSupplier && setIsManageOpen(false)}>
        <DialogTitle>{editingSupplier ? 'แก้ไขผู้ขาย' : 'เพิ่มผู้ขาย'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={8}>
                <TextField autoFocus fullWidth required label="ชื่อผู้ขาย" value={supplierForm} onChange={(event) => setSupplierForm(event.target.value)} />
              </Grid>
              <Grid size={4}>
                <TextField fullWidth select label="สถานะ" value={supplierStatus} onChange={(event) => setSupplierStatus(Number(event.target.value))}>
                  <MenuItem value={1}>ใช้งาน</MenuItem>
                  <MenuItem value={0}>ยกเลิกใช้งาน</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setIsManageOpen(false)}>ยกเลิก</Button>
          <Button disabled={isSavingSupplier || !supplierForm.trim()} startIcon={<Save size={18} />} variant="contained" onClick={handleSaveSupplier}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default SuppliersPage
