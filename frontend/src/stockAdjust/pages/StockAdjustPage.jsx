import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { PackageCheck, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { createStockAdjustment, getProducts } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { useAuthStore } from '../../store/authStore'
import { normalizeWholeNumberInput } from '../../utils/inputGuards'

function mapProduct(row) {
  const fallbackUnit = row.unit ?? row.Unit ?? 'ชิ้น'

  return {
    barcode: row.barcode ?? row.Barcode ?? '',
    categoryName: row.categoryName ?? row.CategoryName ?? row.category ?? row.Category ?? 'General',
    issueUnit: row.issueUnit ?? row.IssueUnit ?? fallbackUnit,
    productId: row.productId ?? row.ProductId ?? row.code ?? row.Code ?? '',
    productName: row.productName ?? row.ProductName ?? row.name ?? row.Name ?? '',
    receiveUnit: row.receiveUnit ?? row.ReceiveUnit ?? fallbackUnit,
    status: row.status ?? row.Status ?? 'Active',
    stockQty: Number(row.stockQty ?? row.StockQty ?? 0),
  }
}

function getEmployeeId(employee) {
  return Number(employee?.employeeId ?? employee?.EmployeeId ?? employee?.id ?? employee?.Id ?? 0)
}

function getEmployeeName(employee) {
  return (
    employee?.employeeName
    ?? employee?.EmployeeName
    ?? employee?.name
    ?? employee?.Name
    ?? employee?.username
    ?? employee?.Username
    ?? ''
  )
}

function getDiffLabel(diff, unit) {
  if (diff > 0) {
    return `เพิ่ม ${diff.toLocaleString('th-TH')} ${unit}`
  }

  if (diff < 0) {
    return `ลด ${Math.abs(diff).toLocaleString('th-TH')} ${unit}`
  }

  return 'เท่าเดิม'
}

function getDiffColor(diff) {
  if (diff > 0) {
    return 'success'
  }

  if (diff < 0) {
    return 'error'
  }

  return 'default'
}

function StockAdjustPage() {
  const employee = useAuthStore((state) => state.employee)
  const [loadError, setLoadError] = useState('')
  const [products, setProducts] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [remark, setRemark] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const selectedMap = useMemo(
    () => new Map(selectedItems.map((item) => [item.productId, item])),
    [selectedItems],
  )

  const loadProducts = async () => {
    setIsLoading(true)
    setLoadError('')

    try {
      const data = await getProducts()
      setProducts((data ?? []).map(mapProduct))
    } catch {
      setLoadError('โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleSelectProduct = (product) => {
    if (selectedMap.has(product.productId)) {
      return
    }

    setSelectedItems((current) => [
      ...current,
      {
        ...product,
        currentQty: product.stockQty,
        newQty: product.stockQty,
      },
    ])
  }

  const handleChangeNewQty = (productId, value) => {
    const normalizedText = normalizeWholeNumberInput(value)
    const normalizedValue = normalizedText === '' ? '' : Number(normalizedText)

    setSelectedItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              newQty: normalizedValue,
            }
          : item,
      ),
    )
  }

  const handleRemoveItem = (productId) => {
    setSelectedItems((current) => current.filter((item) => item.productId !== productId))
  }

  const validationMessage = useMemo(() => {
    if (!selectedItems.length) {
      return 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'
    }

    if (!remark.trim()) {
      return 'กรุณาระบุหมายเหตุ'
    }

    const invalidItem = selectedItems.find(
      (item) => item.newQty === '' || Number(item.newQty) < 0 || !Number.isInteger(Number(item.newQty)),
    )

    if (invalidItem) {
      return `กรุณาระบุยอดคงเหลือจริงของ ${invalidItem.productName} เป็นจำนวนเต็มและไม่ติดลบ`
    }

    return ''
  }, [remark, selectedItems])

  const canSave = !validationMessage && !isSaving

  const handleSave = async () => {
    if (!canSave) {
      await Swal.fire({
        title: 'ข้อมูลยังไม่ครบ',
        text: validationMessage,
        icon: 'warning',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })

      return
    }

    const html = selectedItems
      .map((item) => {
        const diff = Number(item.newQty) - Number(item.currentQty)

        return `
          <div style="display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #e2e8f0;padding:6px 0">
            <span><b>${item.productId}</b> ${item.productName}</span>
            <span>${Number(item.currentQty).toLocaleString('th-TH')} -> ${Number(item.newQty).toLocaleString('th-TH')} ${item.issueUnit}
              (${getDiffLabel(diff, item.issueUnit)})
            </span>
          </div>
        `
      })
      .join('')

    const result = await Swal.fire({
      title: 'ยืนยันการปรับสต๊อก',
      html: `
        <div style="text-align:left;line-height:1.7">
          <div style="margin-bottom:8px"><b>หมายเหตุ:</b> ${remark.trim()}</div>
          ${html}
        </div>
      `,
      icon: 'question',
      customClass: {
        container: 'stock-swal-container',
      },
      showCancelButton: true,
      confirmButtonText: 'บันทึกปรับสต๊อก',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      width: 720,
    })

    if (!result.isConfirmed) {
      return
    }

    setIsSaving(true)

    try {
      await createStockAdjustment({
        createdAt: new Date().toISOString(),
        employeeId: getEmployeeId(employee),
        employeeName: getEmployeeName(employee),
        items: selectedItems.map((item) => ({
          barcode: item.barcode,
          code: item.productId,
          newQty: Number(item.newQty),
          productName: item.productName,
          unit: item.issueUnit,
        })),
        remark: remark.trim(),
      })

      setRemark('')
      setSelectedItems([])
      await loadProducts()
      await Swal.fire({
        title: 'สำเร็จ',
        text: 'บันทึกปรับสต๊อกสำเร็จ',
        icon: 'success',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } catch (error) {
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: error?.response?.data ?? 'บันทึกปรับสต๊อกไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง',
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const productColumns = [
    {
      key: 'actions',
      label: 'เลือก',
      width: 90,
      searchable: false,
      sortable: false,
      render: (row) => (
        <Button
          disabled={selectedMap.has(row.productId)}
          size="small"
          variant={selectedMap.has(row.productId) ? 'outlined' : 'contained'}
          onClick={() => handleSelectProduct(row)}
        >
          {selectedMap.has(row.productId) ? 'เลือกแล้ว' : 'เลือก'}
        </Button>
      ),
    },
    { key: 'productId', label: 'รหัสสินค้า', width: 180 },
    { key: 'barcode', label: 'Barcode', width: 145 },
    { key: 'productName', label: 'ชื่อสินค้า', width: 215, wrap: true },
    { key: 'categoryName', label: 'หมวดหมู่', width: 110 },
    {
      key: 'stockQty',
      label: 'คงเหลือปัจจุบัน',
      width: 125,
      render: (row) => `${Number(row.stockQty).toLocaleString('th-TH')} ${row.issueUnit}`,
    },
  ]

  const selectedColumns = [
    {
      key: 'remove',
      label: 'ลบ',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      searchable: false,
      sortable: false,
      render: (row) => (
        <Button
          color="error"
          size="small"
          startIcon={<Trash2 size={15} />}
          sx={{
            display: 'flex',
            mx: 'auto',
            minWidth: 70,
            px: 1,
          }}
          variant="outlined"
          onClick={() => handleRemoveItem(row.productId)}
        >
          ลบ
        </Button>
      ),
    },
    {
      key: 'newQty',
      label: 'ยอดคงเหลือ',
      width: 130,
      searchable: false,
      sortable: false,
      render: (row) => (
        <TextField
          fullWidth
          size="small"
          slotProps={{
            htmlInput: {
              min: 0,
              step: 1,
            },
          }}
          type="number"
          value={row.newQty}
          onChange={(event) => handleChangeNewQty(row.productId, event.target.value)}
        />
      ),
    },
    { key: 'productId', label: 'รหัสสินค้า', width: 180 },
    { key: 'productName', label: 'ชื่อสินค้า', width: 190, wrap: true },
    {
      key: 'currentQty',
      label: 'ยอดเดิม',
      width: 110,
      render: (row) => `${Number(row.currentQty).toLocaleString('th-TH')} ${row.issueUnit}`,
    },
    {
      key: 'diff',
      label: 'ผลต่าง',
      width: 140,
      searchable: false,
      value: (row) => Number(row.newQty) - Number(row.currentQty),
      render: (row) => {
        const diff = Number(row.newQty) - Number(row.currentQty)

        return (
          <Chip
            color={getDiffColor(diff)}
            label={getDiffLabel(diff, row.issueUnit)}
            size="small"
          />
        )
      },
    },
  ]

  return (
    <Stack spacing={2.5}>
      <Box sx={{ alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>
            ปรับสต๊อก
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
            ใช้ตอนนับสต๊อกจริงแล้วพบว่ายอดในระบบไม่ตรงกับของที่มีอยู่จริง
          </Typography>
        </Box>
        <Button
          disabled={isLoading}
          sx={{ fontWeight: 700, height: 40, minWidth: 120 }}
          variant="outlined"
          onClick={loadProducts}
        >
          รีเฟรช
        </Button>
      </Box>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={7}>
          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #d9e0ea', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <PackageCheck size={20} />
                  <Typography sx={{ color: '#111827', fontSize: 17, fontWeight: 800 }}>
                    เลือกสินค้าที่ต้องการปรับ
                  </Typography>
                </Stack>
                <AppTable
                  columns={productColumns}
                  defaultSortField="productId"
                  fitToWidth
                  isLoading={isLoading}
                  maxHeight="calc(100vh - 430px)"
                  noDataText="ไม่พบข้อมูลสินค้า"
                  rowKey="productId"
                  rows={products}
                  showGlobalSearch
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={5}>
          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #d9e0ea', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography sx={{ color: '#111827', fontSize: 17, fontWeight: 800 }}>
                    รายการปรับสต๊อก
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                    ใส่ยอดคงเหลือจริงหลังนับสินค้า และระบุหมายเหตุทุกครั้ง
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  multiline
                  required
                  minRows={2}
                  label="หมายเหตุ"
                  placeholder="เช่น นับสต๊อกสิ้นเดือน / พบของชำรุด / ยอดจริงไม่ตรงกับระบบ"
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                />

                <AppTable
                  columns={selectedColumns}
                  defaultSortField="productId"
                  fitToWidth
                  maxHeight="calc(100vh - 520px)"
                  noDataText="ยังไม่ได้เลือกสินค้า"
                  rowKey="productId"
                  rows={selectedItems}
                  showGlobalSearch={false}
                />

                {validationMessage ? (
                  <Alert severity="warning">{validationMessage}</Alert>
                ) : (
                  <Alert severity="info">ตรวจสอบยอดจริงให้ถูกต้องก่อนบันทึก เพราะระบบจะปรับยอดคงเหลือทันที</Alert>
                )}

                <Button
                  disabled={!canSave}
                  startIcon={<Save size={18} />}
                  sx={{ fontWeight: 800, height: 44 }}
                  variant="contained"
                  onClick={handleSave}
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกปรับสต๊อก'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}

export default StockAdjustPage
