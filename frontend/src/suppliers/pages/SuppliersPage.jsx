import { Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { Pencil, Plus, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { createSupplier, getPurchasesBySupplier, getSupplierPurchaseItems, getSuppliers, updateSupplier, updateSupplierStatus } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import DateInputField from '../../components/common/DateInputField'
import { formatDisplayDate, getDateSortValue } from '../../utils/dateUtils'

const money = (value) => Number(value ?? 0).toLocaleString('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function SuppliersPage() {
  const [startDate, setStartDate] = useState(() => dayjs().startOf('month').format('YYYY-MM-DD'))
  const [endDate, setEndDate] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [showAllDates, setShowAllDates] = useState(false)
  const [purchaseRows, setPurchaseRows] = useState([])
  const [expandedSupplierId, setExpandedSupplierId] = useState(null)
  const [purchaseItemsBySupplier, setPurchaseItemsBySupplier] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [supplierRows, setSupplierRows] = useState([])
  const [supplierForm, setSupplierForm] = useState('')
  const [supplierAccountId, setSupplierAccountId] = useState('')
  const [supplierShortName, setSupplierShortName] = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [supplierStatus, setSupplierStatus] = useState(1)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [isSavingSupplier, setIsSavingSupplier] = useState(false)
  const purchaseRangeKey = showAllDates ? 'all' : `${startDate || 'all'}:${endDate || 'all'}`

  const supplierDisplayRows = useMemo(() => {
    const purchaseBySupplierId = new Map(
      purchaseRows.map((row) => [Number(row.supplierId), row]),
    )

    if (!showAllDates) {
      return purchaseRows.map((purchase) => {
        const supplier = supplierRows.find(
          (item) => Number(item.supplierId) === Number(purchase.supplierId),
        )

        return { ...purchase, ...supplier }
      })
    }

    const supplierIds = new Set()
    const rows = supplierRows.map((supplier) => {
      const supplierId = Number(supplier.supplierId)
      supplierIds.add(supplierId)
      const purchase = purchaseBySupplierId.get(supplierId)

      return {
        ...purchase,
        ...supplier,
        documentCount: Number(purchase?.documentCount ?? 0),
        itemCount: Number(purchase?.itemCount ?? 0),
        totalQty: Number(purchase?.totalQty ?? 0),
        totalPurchase: Number(purchase?.totalPurchase ?? 0),
      }
    })

    return [
      ...rows,
      ...purchaseRows.filter((row) => !supplierIds.has(Number(row.supplierId))),
    ]
  }, [purchaseRows, showAllDates, supplierRows])

  const loadSupplierRows = async () => {
    try {
      const rows = await getSuppliers()
      setSupplierRows(Array.isArray(rows) ? rows : [])
    } catch {
      setSupplierRows([])
    }
  }

  const handleStartDateChange = (nextStartDate) => {
    const today = dayjs().format('YYYY-MM-DD')
    if (nextStartDate && nextStartDate > today) {
      toast.error('วันเริ่มต้นต้องไม่เกินวันปัจจุบัน')
      return
    }
    setStartDate(nextStartDate)
    if (nextStartDate && endDate && nextStartDate > endDate) {
      setEndDate(nextStartDate)
    }
  }

  const handleEndDateChange = (nextEndDate) => {
    if (nextEndDate && startDate && nextEndDate < startDate) {
      toast.error('วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น')
      return
    }
    setEndDate(nextEndDate)
  }

  const handleSaveSupplier = async () => {
    const name = supplierForm.trim()
    const shortName = supplierShortName.trim()
    if (!name) return

    const isSameSupplier = (supplier) => Number(supplier.supplierId) === Number(editingSupplier?.supplierId)
    const normalizedName = name.toLocaleLowerCase()
    const normalizedShortName = shortName.toLocaleLowerCase()
    if (supplierRows.some((supplier) => !isSameSupplier(supplier) && String(supplier.accountName || supplier.supplierName || '').trim().toLocaleLowerCase() === normalizedName)) {
      toast.error('ชื่อผู้ขายนี้มีในระบบแล้ว')
      return
    }
    if (shortName && supplierRows.some((supplier) => !isSameSupplier(supplier) && String(supplier.shortName || '').trim().toLocaleLowerCase() === normalizedShortName)) {
      toast.error('ชื่อย่อนี้มีในระบบแล้ว')
      return
    }

    const confirmation = await Swal.fire({
      title: editingSupplier ? 'ยืนยันการแก้ไข' : 'ยืนยันการบันทึก',
      text: `${editingSupplier ? 'ต้องการแก้ไขข้อมูล' : 'ต้องการบันทึก'}ผู้ขาย ${name} ใช่หรือไม่`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: editingSupplier ? 'แก้ไข' : 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      customClass: { container: 'stock-swal-container' },
    })

    if (!confirmation.isConfirmed) return

    setIsSavingSupplier(true)
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.supplierId, {
          supplierName: name,
          accountId: supplierAccountId.trim(),
          shortName: supplierShortName.trim(),
          accountName: name,
          address: supplierAddress.trim(),
        })
        if (Number(editingSupplier.supplierStatus ?? 1) !== Number(supplierStatus)) {
          await updateSupplierStatus(editingSupplier.supplierId, Number(supplierStatus))
        }
      } else {
        const createdSupplier = await createSupplier({
          supplierName: name,
          accountId: supplierAccountId.trim(),
          shortName: supplierShortName.trim(),
          accountName: name,
          address: supplierAddress.trim(),
        })
        if (Number(supplierStatus) !== 1) {
          await updateSupplierStatus(createdSupplier.supplierId, Number(supplierStatus))
        }
      }
      setSupplierForm('')
      setSupplierAccountId('')
      setSupplierShortName('')
      setSupplierAddress('')
      setSupplierStatus(1)
      setEditingSupplier(null)
      await loadSupplierRows()
      await Swal.fire({
        title: 'สำเร็จ',
        text: editingSupplier ? 'แก้ไขผู้ขายสำเร็จ' : 'บันทึกผู้ขายสำเร็จ',
        icon: 'success',
        confirmButtonText: 'ตกลง',
        customClass: { container: 'stock-swal-container' },
      })
      setIsManageOpen(false)
    } catch (error) {
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: error?.response?.data ?? 'บันทึกข้อมูลผู้ขายไม่สำเร็จ',
        icon: 'error',
        confirmButtonText: 'ตกลง',
        customClass: { container: 'stock-swal-container' },
      })
    } finally {
      setIsSavingSupplier(false)
    }
  }

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setExpandedSupplierId(null)
    setPurchaseItemsBySupplier({})

    getPurchasesBySupplier(showAllDates ? {} : { startDate, endDate })
      .then((rows) => active && setPurchaseRows(Array.isArray(rows) ? rows : []))
      .catch(() => active && setPurchaseRows([]))
      .finally(() => active && setIsLoading(false))

    getSuppliers()
      .then((rows) => active && setSupplierRows(Array.isArray(rows) ? rows : []))
      .catch(() => active && setSupplierRows([]))

    return () => { active = false }
  }, [endDate, showAllDates, startDate])

  const toggleSupplier = async (supplier) => {
    if (expandedSupplierId === supplier.supplierId) {
      setExpandedSupplierId(null)
      return
    }

    setExpandedSupplierId(supplier.supplierId)
    const cacheKey = `${purchaseRangeKey}:${supplier.supplierId}`
    if (purchaseItemsBySupplier[cacheKey]) {
      return
    }

    setIsLoadingItems(true)
    try {
      const rows = await getSupplierPurchaseItems(
        supplier.supplierId,
        showAllDates ? {} : { startDate, endDate },
      )
      setPurchaseItemsBySupplier((current) => ({
        ...current,
        [cacheKey]: Array.isArray(rows) ? rows : [],
      }))
    } catch {
      setPurchaseItemsBySupplier((current) => ({ ...current, [cacheKey]: [] }))
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
          setSupplierForm(supplier.accountName || supplier.supplierName || '')
          setSupplierAccountId(supplier.accountId ?? '')
          setSupplierShortName(supplier.shortName ?? '')
          setSupplierAddress(supplier.address ?? '')
          setSupplierStatus(Number(supplier.supplierStatus ?? 1))
          setIsManageOpen(true)
        }}>แก้ไข</Button>
      ),
    },
    {
      key: 'accountName',
      label: 'ชื่อผู้ขาย',
      minWidth: 240,
      value: (row) => row.accountName || row.supplierName || '-',
    },
    {
      key: 'shortName',
      label: 'ชื่อย่อ',
      minWidth: 130,
      value: (row) => row.shortName || '-',
    },
    {
      key: 'address',
      label: 'ที่อยู่',
      minWidth: 280,
      value: (row) => row.address || '-',
    },
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
    { key: 'poInvoiceNo', label: 'Invoice', width: 160, value: (row) => row.poInvoiceNo || '-' },
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
          <FormControlLabel
            control={<Checkbox checked={showAllDates} onChange={(event) => setShowAllDates(event.target.checked)} />}
            label="ทั้งหมด"
            sx={{ ml: 0, mr: 0.5, whiteSpace: 'nowrap' }}
          />
          <DateInputField
            disabled={showAllDates}
            label="วันที่เริ่มต้น"
            size="small"
            sx={{ width: 180 }}
            max={dayjs().format('YYYY-MM-DD')}
            value={startDate}
            onChange={handleStartDateChange}
          />
          <DateInputField
            disabled={showAllDates}
            label="วันที่สิ้นสุด"
            size="small"
            sx={{ width: 180 }}
            min={startDate}
            value={endDate}
            onChange={handleEndDateChange}
          />
          <Button startIcon={<Plus size={18} />} variant="contained" onClick={() => { setEditingSupplier(null); setSupplierForm(''); setSupplierAccountId(''); setSupplierShortName(''); setSupplierAddress(''); setSupplierStatus(1); setIsManageOpen(true) }}>
            เพิ่มผู้ขาย
          </Button>
        </Stack>
      </Box>

      <Card>
        <CardContent sx={{ p: 2 }}>
          <AppTable
            columns={supplierColumns}
            rows={supplierDisplayRows}
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
                  rows={purchaseItemsBySupplier[`${purchaseRangeKey}:${supplier.supplierId}`] ?? []}
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
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField autoFocus fullWidth label="รหัสผู้ขาย" value={supplierAccountId} onChange={(event) => setSupplierAccountId(event.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="ชื่อย่อ" value={supplierShortName} onChange={(event) => setSupplierShortName(event.target.value)} />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth required label="ชื่อผู้ขาย" value={supplierForm} onChange={(event) => setSupplierForm(event.target.value)} />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth label="ที่อยู่" multiline minRows={3} value={supplierAddress} onChange={(event) => setSupplierAddress(event.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
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
