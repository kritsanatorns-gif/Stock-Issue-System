import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Ban, CheckCircle2, ClipboardCheck, FileDown, Printer, RefreshCw, Zap, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import {
  approveRequisition,
  denyRequisition,
  getRequisitions,
  keepRequisitionBacklog,
} from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { downloadHistorySlipPdf, printHistorySlip } from '../../request/pages/RequestHistoryPage'
import { useAuthStore } from '../../store/authStore'
import { formatDisplayDateTime, getElapsedDuration } from '../../utils/dateUtils'

function normalizeItem(item) {
  const quantity = Number(item.quantity ?? item.Quantity ?? 0)
  const fulfilledQty = Number(item.fulfilledQty ?? item.FulfilledQty ?? 0)
  const backlogQty = Number(item.backlogQty ?? item.BacklogQty ?? Math.max(0, quantity - fulfilledQty))

  return {
    availableQty: Number(item.availableQty ?? item.AvailableQty ?? 0),
    backlogQty,
    barcode: item.barcode ?? item.Barcode ?? '',
    category: item.category ?? item.Category ?? '',
    code: item.code ?? item.Code ?? '',
    detailId: Number(item.detailId ?? item.DetailId ?? 0),
    fulfilledQty,
    lineNo: item.lineNo ?? item.LineNo ?? '',
    productName: item.productName ?? item.ProductName ?? '',
    quantity,
    unit: item.unit ?? item.Unit ?? '',
  }
}

function normalizeRequisition(row) {
  const items = (row.items ?? row.Items ?? []).map(normalizeItem)
  const urgentRemark = row.urgentRemark ?? row.UrgentRemark ?? ''
  const isUrgent = Boolean(row.isUrgent ?? row.IsUrgent ?? urgentRemark)
  const productSummary = items
    .map((item) => item.productName || item.code)
    .filter(Boolean)
    .join(', ')

  return {
    createdAt: row.createdAt ?? row.CreatedAt ?? '',
    department: row.department ?? row.Department ?? '',
    employeeId: row.employeeId ?? row.EmployeeId ?? '',
    employeeName: row.employeeName ?? row.EmployeeName ?? '',
    headerId: row.headerId ?? row.HeaderId ?? '',
    isUrgent,
    items,
    productSummary,
    remark: row.remark ?? row.Remark ?? '',
    requestNo: row.requestNo ?? row.RequestNo ?? '',
    status: row.status ?? row.Status ?? '',
    statusId: Number(row.statusId ?? row.StatusId ?? 0),
    totalItems: Number(row.totalItems ?? row.TotalItems ?? items.length),
    totalQty: Number(row.totalQty ?? row.TotalQty ?? items.reduce((sum, item) => sum + item.backlogQty, 0)),
    totalBacklogQty: Number(row.totalBacklogQty ?? row.TotalBacklogQty ?? items.reduce((sum, item) => sum + item.backlogQty, 0)),
    totalFulfilledQty: Number(row.totalFulfilledQty ?? row.TotalFulfilledQty ?? items.reduce((sum, item) => sum + item.fulfilledQty, 0)),
    totalRequestedQty: Number(row.totalRequestedQty ?? row.TotalRequestedQty ?? items.reduce((sum, item) => sum + item.quantity, 0)),
    urgentRemark,
  }
}

function getEmployeeId(employee) {
  return Number(employee?.id ?? employee?.employeeId ?? employee?.EmployeeId ?? 0)
}

function buildPrintableRowWithBacklog(row, requestRows) {
  if (!row) {
    return row
  }

  const currentRequestNo = String(row.requestNo ?? '')
  const currentDepartment = String(row.department ?? '').trim().toLowerCase()
  const currentItems = row.items ?? []
  const carryOverItems = (requestRows ?? [])
    .filter((request) => {
      const requestNo = String(request.requestNo ?? '')
      const department = String(request.department ?? '').trim().toLowerCase()

      return requestNo !== currentRequestNo && department === currentDepartment && request.statusId === 8
    })
    .flatMap((request) => (request.items ?? [])
      .filter((item) => Number(item.backlogQty ?? 0) > 0)
      .map((item, index) => ({
        ...item,
        detailId: `carry-${request.requestNo}-${item.detailId || index}`,
        fulfilledQty: Number(item.fulfilledQty ?? 0),
        isCarryOverBacklog: true,
        lineNo: `${request.requestNo}-${index + 1}`,
        quantity: Number(item.backlogQty ?? 0),
        remark: `ค้างจาก ${request.requestNo}`,
      })))

  if (carryOverItems.length === 0) {
    return row
  }

  return {
    ...row,
    hasCarryOverBacklog: true,
    items: [...currentItems, ...carryOverItems],
    totalItems: currentItems.length + carryOverItems.length,
    totalQty: [...currentItems, ...carryOverItems].reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
  }
}

function getStatusColor(statusId) {
  if (statusId === 8) {
    return 'warning'
  }

  return 'default'
}

function ApprovalsPage() {
  const employee = useAuthStore((state) => state.employee)
  const [rows, setRows] = useState([])
  const [loadError, setLoadError] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [remark, setRemark] = useState('')
  const [fulfillmentDraft, setFulfillmentDraft] = useState({})
  const employeeId = getEmployeeId(employee)

  const loadRows = useCallback(async () => {
    setLoadError('')

    try {
      const data = await getRequisitions()

      setRows(
        (data ?? [])
          .map(normalizeRequisition)
          .filter((row) => row.statusId === 6 || row.statusId === 8)
          .sort((left, right) => {
            const urgentDiff = Number(right.isUrgent) - Number(left.isUrgent)

            if (urgentDiff !== 0) {
              return urgentDiff
            }

            return Number(right.headerId ?? 0) - Number(left.headerId ?? 0)
          }),
      )
    } catch {
      setLoadError('โหลดคำขอเบิกไม่สำเร็จ กรุณาตรวจสอบ Backend API')
      setRows([])
    }
  }, [])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const summary = useMemo(() => ({
    backlog: rows.filter((row) => row.statusId === 8).length,
    documents: rows.length,
    items: rows.reduce((sum, row) => sum + row.totalItems, 0),
    pending: rows.filter((row) => row.statusId === 6).length,
    qty: rows.reduce((sum, row) => sum + row.totalQty, 0),
    urgent: rows.filter((row) => row.isUrgent).length,
  }), [rows])

  const selectedProgress = (selectedRow?.items ?? []).reduce((progress, item) => {
    const issueNow = Number(fulfillmentDraft[item.detailId] ?? 0)

    return {
      backlog: progress.backlog + item.backlogQty,
      issueNow: progress.issueNow + issueNow,
      requested: progress.requested + item.quantity,
      fulfilled: progress.fulfilled + item.fulfilledQty,
    }
  }, {
    backlog: 0,
    fulfilled: 0,
    issueNow: 0,
    requested: 0,
  })

  const openDetail = (row) => {
    const draft = {}

    row.items.forEach((item) => {
      draft[item.detailId] = Math.min(item.backlogQty, Math.max(0, item.availableQty))
    })

    setFulfillmentDraft(draft)
    setRemark('')
    setSelectedRow(row)
  }

  const handlePrintSelectedRow = () => {
    if (!selectedRow) {
      return
    }

    const printableRow = buildPrintableRowWithBacklog(selectedRow, rows)

    setSelectedRow(null)
    window.setTimeout(() => printHistorySlip(printableRow), 120)
  }

  const handleDownloadSelectedRowPdf = () => {
    if (!selectedRow) {
      return
    }

    const printableRow = buildPrintableRowWithBacklog(selectedRow, rows)

    setSelectedRow(null)
    window.setTimeout(() => {
      downloadHistorySlipPdf(printableRow)
    }, 120)
  }

  const handleFulfillmentChange = (detailId, value, backlogQty, availableQty) => {
    const maxQty = Math.max(0, Math.min(backlogQty, availableQty))
    const numericValue = Math.max(0, Math.min(maxQty, Number(value || 0)))

    setFulfillmentDraft((current) => ({
      ...current,
      [detailId]: numericValue,
    }))
  }

  const handleApprove = async () => {
    if (!selectedRow) {
      return
    }

    const items = selectedRow.items
      .map((item) => ({
        detailId: item.detailId,
        quantity: Number(fulfillmentDraft[item.detailId] ?? 0),
      }))
      .filter((item) => item.quantity > 0)

    if (items.length === 0) {
      await Swal.fire({
        confirmButtonText: 'ตกลง',
        customClass: {
          container: 'stock-swal-container',
        },
        icon: 'warning',
        text: 'ถ้าต้องการจ่ายบางส่วน ให้กรอกจำนวนในช่อง “จ่ายครั้งนี้” อย่างน้อย 1 รายการ หรือกดปุ่ม “ยังไม่จ่าย” ถ้ายังไม่มีของจ่ายเลย',
        title: 'ยังไม่ได้กรอกจำนวนจ่าย',
      })
      return
    }

    const willBacklog = selectedRow.items.some((item) => {
      const issuedNow = Number(fulfillmentDraft[item.detailId] ?? 0)
      return issuedNow < item.backlogQty
    })

    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonText: willBacklog ? 'บันทึกจ่ายบางส่วน' : 'บันทึกจ่ายครบ',
      customClass: {
        container: 'stock-swal-container',
      },
      icon: 'question',
      showCancelButton: true,
      text: willBacklog
        ? 'ระบบจะตัดสต๊อกตามจำนวนที่จ่ายจริง และเก็บยอดที่เหลือไว้ในรายการค้างเพื่อกลับมาจ่ายต่อภายหลัง'
        : 'ระบบจะตัดสต๊อกและเปลี่ยนสถานะคำขอเป็นได้ของครบ',
      title: willBacklog ? 'ยืนยันจ่ายบางส่วน' : 'ยืนยันจ่ายครบ',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      await approveRequisition(selectedRow.headerId, {
        employeeId,
        items,
        remark,
      })

      setSelectedRow(null)
      setRemark('')
      setFulfillmentDraft({})
      await loadRows()
      Swal.fire('สำเร็จ', willBacklog ? 'บันทึกจ่ายบางส่วนและเก็บยอดค้างแล้ว' : 'บันทึกจ่ายครบแล้ว', 'success')
    } catch (error) {
      Swal.fire('ไม่สำเร็จ', error?.response?.data ?? 'บันทึกการจ่ายสินค้าไม่สำเร็จ', 'error')
    }
  }

  const handleReject = async () => {
    if (!selectedRow) {
      return
    }

    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonText: 'เก็บเป็นรายการค้าง',
      customClass: {
        container: 'stock-swal-container',
      },
      icon: 'warning',
      showCancelButton: true,
      text: 'ใช้กรณียังไม่มีของจ่ายเลย ระบบจะไม่ตัดสต๊อก และจะเก็บใบนี้ไว้รอจ่ายเมื่อมีของเข้า',
      title: 'ยืนยันเก็บเป็นรายการค้าง',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      await keepRequisitionBacklog(selectedRow.headerId, {
        employeeId,
        remark,
      })

      setSelectedRow(null)
      setRemark('')
      setFulfillmentDraft({})
      await loadRows()
      Swal.fire('สำเร็จ', 'บันทึกเป็นรายการค้างแล้ว', 'success')
    } catch (error) {
      Swal.fire('ไม่สำเร็จ', error?.response?.data ?? 'ไม่สามารถเก็บเป็นรายการค้างได้', 'error')
    }
  }

  const handleDeny = async () => {
    if (!selectedRow) {
      return
    }

    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'ไม่ให้เบิก',
      customClass: {
        container: 'stock-swal-container',
      },
      icon: 'warning',
      showCancelButton: true,
      text: 'ใช้กรณีไม่อนุมัติให้เบิกใบนี้ ระบบจะไม่ตัดสต๊อก และจะไม่เก็บเป็นงานค้าง',
      title: 'ยืนยันไม่ให้เบิก',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      await denyRequisition(selectedRow.headerId, {
        employeeId,
        remark,
      })

      setSelectedRow(null)
      setRemark('')
      setFulfillmentDraft({})
      await loadRows()
      Swal.fire({
        customClass: {
          container: 'stock-swal-container',
        },
        icon: 'success',
        text: 'บันทึกสถานะไม่ให้เบิกแล้ว',
        title: 'สำเร็จ',
      })
    } catch (error) {
      Swal.fire({
        customClass: {
          container: 'stock-swal-container',
        },
        icon: 'error',
        text: error?.response?.data ?? 'ไม่สามารถบันทึกสถานะไม่ให้เบิกได้',
        title: 'ไม่สำเร็จ',
      })
    }
  }

  const columns = [
    {
      key: 'createdAt',
      label: 'วันที่ส่งคำขอ',
      width: 150,
      value: (row) => formatDisplayDateTime(row.createdAt),
      sortValue: (row) => Number(row.headerId ?? 0),
    },
    { key: 'requestNo', label: 'เลขที่คำขอ', width: 120 },
    {
      key: 'isUrgent',
      label: 'เบิกด่วน',
      width: 90,
      align: 'center',
      value: (row) => (row.isUrgent ? 'เบิกด่วน' : ''),
      render: (row) => (
        row.isUrgent ? (
          <Chip
            color="error"
            icon={<Zap size={14} />}
            label="เบิกด่วน"
            size="small"
            sx={{ fontWeight: 900 }}
          />
        ) : (
          <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>-</Typography>
        )
      ),
    },
    {
      key: 'productSummary',
      label: 'ชื่อสินค้า',
      width: 230,
      value: (row) => row.productSummary,
      render: (row) => (
        <Typography
          title={row.productSummary}
          sx={{
            fontSize: 13,
            fontWeight: 700,
            maxWidth: 230,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.productSummary || '-'}
        </Typography>
      ),
    },
    { key: 'department', label: 'แผนก', width: 100 },
    { key: 'employeeName', label: 'ผู้ขอเบิก', width: 170 },
    { key: 'totalItems', label: 'จำนวนรายการ', width: 110, align: 'center' },
    { key: 'totalQty', label: 'ยอดที่ยังต้องจ่าย', width: 130, align: 'center' },
    {
      key: 'waitingDuration',
      label: 'ระยะเวลารอ',
      width: 125,
      align: 'center',
      value: (row) => ([6, 8].includes(row.statusId) ? getElapsedDuration(row.createdAt).label : '-'),
      sortValue: (row) => ([6, 8].includes(row.statusId) ? getElapsedDuration(row.createdAt).days * 24 + getElapsedDuration(row.createdAt).hours : -1),
      render: (row) => ([6, 8].includes(row.statusId) ? getElapsedDuration(row.createdAt).label : '-'),
    },
    {
      key: 'status',
      label: 'สถานะคำขอ',
      width: 110,
      render: (row) => <Chip color={getStatusColor(row.statusId)} label={row.status} size="small" />,
    },
    {
      key: 'actions',
      label: 'รายการ',
      width: 110,
      searchable: false,
      sortable: false,
      render: (row) => (
        <Button size="small" variant="outlined" onClick={() => openDetail(row)}>
          ดูรายการ
        </Button>
      ),
    },
  ]

  const detailColumns = [
    { key: 'lineNo', label: 'ลำดับ', width: 60 },
    { key: 'code', label: 'รหัสสินค้า', width: 130 },
    { key: 'productName', label: 'ชื่อสินค้า', width: 220 },
    { key: 'category', label: 'หมวดหมู่', width: 100 },
    { key: 'quantity', label: 'ขอเบิก', width: 85, align: 'center' },
    { key: 'fulfilledQty', label: 'จ่ายแล้ว', width: 85, align: 'center' },
    { key: 'backlogQty', label: 'ยังค้าง', width: 85, align: 'center' },
    { key: 'availableQty', label: 'คงเหลือ', width: 90, align: 'center' },
    {
      key: 'issueNow',
      label: 'จ่ายครั้งนี้',
      width: 120,
      searchable: false,
      sortable: false,
      render: (row) => (
        <TextField
          disabled={row.backlogQty <= 0 || row.availableQty <= 0}
          inputProps={{ min: 0, max: Math.min(row.backlogQty, row.availableQty) }}
          size="small"
          type="number"
          value={fulfillmentDraft[row.detailId] ?? 0}
          onChange={(event) => handleFulfillmentChange(
            row.detailId,
            event.target.value,
            row.backlogQty,
            row.availableQty,
          )}
        />
      ),
    },
    { key: 'unit', label: 'หน่วย', width: 80 },
  ]

  return (
    <Box>
      <Stack
        alignItems="flex-start"
        direction="row"
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2, width: '100%' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 900 }}>รายการขอเบิก</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14 }}>
            ดูคำขอจากพนักงาน จ่ายครบหรือจ่ายบางส่วน แล้วระบบจะเก็บยอดค้างไว้ให้กลับมาจ่ายต่อเมื่อมีของเข้า
          </Typography>
        </Box>
        <Button
          startIcon={<RefreshCw size={18} />}
          sx={{ flexShrink: 0, ml: 'auto' }}
          variant="outlined"
          onClick={loadRows}
        >
          รีเฟรช
        </Button>
      </Stack>

      {loadError ? <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert> : null}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ border: '1px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)' }}>
            <CardContent>
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>รายการรอจัด/ค้าง</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{summary.documents}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ border: '1px solid #cbd5e1', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)' }}>
            <CardContent>
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>รอจัดของ</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{summary.pending}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ border: '1px solid #ddd6fe', background: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)' }}>
            <CardContent>
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>งานค้าง</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{summary.backlog}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ border: '1px solid #fecaca', background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)' }}>
            <CardContent>
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>เบิกด่วน</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{summary.urgent}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <AppTable
            columns={columns}
            defaultSortField="createdAt"
            defaultSortDirection="desc"
            fitToWidth
            maxHeight="calc(100vh - 380px)"
            noDataText="ไม่มีรายการรอจัดหรือรายการค้าง"
            rows={rows}
            showGlobalSearch
          />
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="lg" open={Boolean(selectedRow)} onClose={() => setSelectedRow(null)}>
        <DialogTitle
          sx={{
            alignItems: 'center',
            display: 'flex',
            gap: 1,
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
            <ClipboardCheck size={22} />
            รายละเอียดรายการขอเบิก
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<Printer size={18} />}
              variant="outlined"
              onClick={handlePrintSelectedRow}
            >
              พิมพ์ใบคำขอ
            </Button>
            <Button
              startIcon={<FileDown size={18} />}
              variant="outlined"
              onClick={handleDownloadSelectedRowPdf}
            >
              ดาวน์โหลด PDF
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedRow ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>เลขที่คำขอ</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{selectedRow.requestNo}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>ผู้ขอเบิก</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{selectedRow.employeeName}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>แผนก</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{selectedRow.department}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>วันที่ส่งคำขอ</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{formatDisplayDateTime(selectedRow.createdAt)}</Typography>
                </Grid>
              </Grid>
              <Grid container spacing={1.25}>
                {[
                  { label: 'ขอทั้งหมด', value: selectedProgress.requested, color: '#eff6ff', border: '#bfdbfe' },
                  { label: 'จ่ายแล้ว', value: selectedProgress.fulfilled, color: '#f0fdf4', border: '#bbf7d0' },
                  { label: 'ยังค้าง', value: selectedProgress.backlog, color: '#fff7ed', border: '#fed7aa' },
                  { label: 'จ่ายรอบนี้', value: selectedProgress.issueNow, color: '#f5f3ff', border: '#ddd6fe' },
                ].map((progress) => (
                  <Grid key={progress.label} size={{ xs: 6, md: 3 }}>
                    <Box sx={{ backgroundColor: progress.color, border: `1px solid ${progress.border}`, borderRadius: 1.5, px: 1.5, py: 1 }}>
                      <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>{progress.label}</Typography>
                      <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>{progress.value.toLocaleString()}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              {selectedRow.isUrgent ? (
                <Alert icon={<Zap size={18} />} severity="warning">
                  <Typography sx={{ fontWeight: 900 }}>เบิกด่วน</Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {selectedRow.urgentRemark || 'ไม่ระบุเหตุผล'}
                  </Typography>
                </Alert>
              ) : null}
              {selectedRow.remark ? <Alert severity="info">{selectedRow.remark}</Alert> : null}
              <Alert severity="info">
                ถ้าของไม่พอ ให้กรอกจำนวนที่จ่ายได้จริงในช่อง “จ่ายครั้งนี้” ระบบจะตัดสต๊อกเฉพาะจำนวนนั้น และเก็บส่วนที่เหลือเป็นรายการค้างเพื่อรอจ่ายต่อ
              </Alert>
              <AppTable
                columns={detailColumns}
                fitToWidth
                maxHeight={380}
                noDataText="ไม่มีรายการสินค้า"
                rows={selectedRow.items}
                rowKey="detailId"
                showGlobalSearch={false}
              />
              <TextField
                fullWidth
                label="หมายเหตุการจ่ายสินค้า / รายการค้าง"
                multiline
                minRows={3}
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="warning" startIcon={<XCircle size={18} />} variant="outlined" onClick={handleReject}>
            ยังไม่จ่าย
          </Button>
          <Button color="error" startIcon={<Ban size={18} />} variant="outlined" onClick={handleDeny}>
            ไม่ให้เบิก
          </Button>
          <Button startIcon={<CheckCircle2 size={18} />} variant="contained" onClick={handleApprove}>
            บันทึกการจ่ายสินค้า
          </Button>
          <Button color="inherit" sx={{ ml: 'auto' }} onClick={() => setSelectedRow(null)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ApprovalsPage
