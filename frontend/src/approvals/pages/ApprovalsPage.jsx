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
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Ban, Barcode, CheckCircle2, ClipboardCheck, FileDown, Printer, RefreshCw, Zap, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import {
  approveRequisition,
  acceptRequisition,
  denyRequisition,
  denyRequisitionItem,
  getRequisitions,
  keepRequisitionBacklog,
} from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { getRequisitionItemQuantities, getRequisitionStatusLabel, isPartiallyAllowedRequisition } from '../../utils/requisitionStatus'
import { downloadHistorySlipPdf, printHistorySlip } from '../../request/pages/RequestHistoryPage'
import { useAuthStore } from '../../store/authStore'
import { formatDisplayDateTime, getElapsedDuration } from '../../utils/dateUtils'

function normalizeItem(item, statusId) {
  const { quantity, fulfilledQty, deniedQty, backlogQty } = getRequisitionItemQuantities(item, statusId)

  return {
    availableQty: Number(item.availableQty ?? item.AvailableQty ?? 0),
    backlogQty,
    barcode: item.barcode ?? item.Barcode ?? '',
    category: item.category ?? item.Category ?? '',
    code: item.code ?? item.Code ?? '',
      detailId: Number(item.detailId ?? item.DetailId ?? 0),
      deniedQty,
      denyRemark: item.denyRemark ?? item.DenyRemark ?? '',
    fulfilledQty,
    lineNo: item.lineNo ?? item.LineNo ?? '',
    productName: item.productName ?? item.ProductName ?? '',
    remark: item.remark ?? item.Remark ?? '',
    quantity,
    unit: item.unit ?? item.Unit ?? '',
  }
}

function normalizeRequisition(row) {
  const items = (row.items ?? row.Items ?? []).map((item) => normalizeItem(item, row.statusId ?? row.StatusId))
  const urgentRemark = row.urgentRemark ?? row.UrgentRemark ?? ''
  const isUrgent = Boolean(row.isUrgent ?? row.IsUrgent ?? urgentRemark)
  const productSummary = items
    .map((item) => item.productName || item.code)
    .filter(Boolean)
    .join(', ')

  return {
    approvedAt: row.approvedAt ?? row.ApprovedAt ?? null,
    createdAt: row.createdAt ?? row.CreatedAt ?? '',
    // StockHeader.Department เก็บฝ่าย, StockHeader.Division เก็บแผนก
    department: row.division ?? row.Division ?? '',
    division: row.department ?? row.Department ?? '',
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

function buildPrintableRowWithBacklog(row) {
  return row
}

function getStatusColor(statusId) {
  if (statusId === 10) {
    return 'secondary'
  }

  if (statusId === 6) {
    return 'primary'
  }

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
  const [itemRemarks, setItemRemarks] = useState({})
  const [deniedSelection, setDeniedSelection] = useState([])
  const [savingDenials, setSavingDenials] = useState(false)
  const [fulfillmentDraft, setFulfillmentDraft] = useState({})
  const [scanRequestNo, setScanRequestNo] = useState('')
  const [scanError, setScanError] = useState('')
  const employeeId = getEmployeeId(employee)

  const loadRows = useCallback(async () => {
    setLoadError('')

    try {
      const data = await getRequisitions()

      setRows(
        (data ?? [])
          .map(normalizeRequisition)
          .filter((row) => [10, 6, 8].includes(row.statusId))
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
    const issueNow = deniedSelection.includes(item.detailId) ? 0 : Number(fulfillmentDraft[item.detailId] ?? 0)

    return {
      backlog: progress.backlog + item.backlogQty,
      issueNow: progress.issueNow + issueNow,
      requested: progress.requested + item.quantity,
      fulfilled: progress.fulfilled + item.fulfilledQty,
      denied: progress.denied + item.deniedQty,
    }
  }, {
    backlog: 0,
    fulfilled: 0,
    denied: 0,
    issueNow: 0,
    requested: 0,
  })

  const openDetail = (row) => {
    const draft = {}

    row.items.forEach((item) => {
      draft[item.detailId] = row.statusId === 10 ? 0 : Math.min(item.backlogQty, Math.max(0, item.availableQty))
    })

    setFulfillmentDraft(draft)
    setItemRemarks(Object.fromEntries(row.items
      .filter((item) => item.remark)
      .map((item) => [item.detailId, item.remark])))
    setSelectedRow(row)
    setDeniedSelection([])
  }

  const openScannedRequest = () => {
    const requestNo = scanRequestNo.trim()

    if (!requestNo) return

    const matchedRow = rows.find((row) => row.requestNo.toUpperCase() === requestNo.toUpperCase())

    if (!matchedRow) {
      setScanError(`ไม่พบใบเบิกเลขที่ ${requestNo} ในรายการรออนุมัติ/รอจัด/ค้าง`)
      return
    }

    setScanError('')
    setScanRequestNo('')
    openDetail(matchedRow)
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
    if (value === '') {
      setFulfillmentDraft((current) => ({
        ...current,
        [detailId]: '',
      }))
      return
    }

    const numericValue = Math.max(0, Number(value || 0))

    setFulfillmentDraft((current) => ({
      ...current,
      [detailId]: numericValue,
    }))
  }

  const handleItemRemarkChange = (detailId, value) => {
    setItemRemarks((current) => ({ ...current, [detailId]: value }))
  }

  const handleAccept = async (row) => {
    if (row?.statusId !== 10) return
      const result = await Swal.fire({
        title: 'ยืนยันอนุมัติคำขอเบิก',
        text: 'เปลี่ยนเป็นรอจัดของ และเริ่มนับระยะเวลารอจากเวลาอนุมัติ',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'อนุมัติ',
        cancelButtonText: 'ยกเลิก',
        customClass: { container: 'stock-swal-container' },
      })
      if (!result.isConfirmed) return
      try {
        await acceptRequisition(row.headerId, { employeeId })
        setSelectedRow(null)
        await loadRows()
        window.dispatchEvent(new CustomEvent('stock-issue:requisition-updated'))
        await Swal.fire('สำเร็จ', 'อนุมัติแล้ว สถานะรอจัดของ', 'success')
      } catch (error) {
        await Swal.fire('ไม่สำเร็จ', error?.response?.data ?? 'อนุมัติไม่สำเร็จ', 'error')
      }
  }

  const handleApprove = async () => {
    if (selectedRow && !savingDenials && selectedProgress.backlog === 0) {
      setSelectedRow(null)
      setFulfillmentDraft({})
      setItemRemarks({})
      setDeniedSelection([])
      await loadRows()
      return
    }
    if (!selectedRow || savingDenials) return
    if (selectedRow.statusId === 10) {
      await handleAccept(selectedRow)
      return
    }

    const overRequestedItem = selectedRow.items.find(
      (item) => !deniedSelection.includes(item.detailId) && Number(fulfillmentDraft[item.detailId] ?? 0) > Number(item.backlogQty ?? 0),
    )

    if (overRequestedItem) {
      await Swal.fire({
        confirmButtonText: 'ตกลง',
        customClass: { container: 'stock-swal-container' },
        icon: 'warning',
        text: `สินค้า ${overRequestedItem.productName} จ่ายได้ไม่เกิน ${Number(overRequestedItem.backlogQty).toLocaleString('th-TH')} ${overRequestedItem.unit}`,
        title: 'จำนวนจ่ายเกินจำนวนที่ขอเบิก',
      })
      return
    }

    const items = selectedRow.items
      .map((item) => ({
        detailId: item.detailId,
        quantity: deniedSelection.includes(item.detailId) ? 0 : Number(fulfillmentDraft[item.detailId] ?? 0),
        denied: deniedSelection.includes(item.detailId),
        remark: itemRemarks[item.detailId]?.trim() ?? '',
      }))
      .filter((item) => item.quantity > 0 || item.denied)

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
      return !deniedSelection.includes(item.detailId) && issuedNow < item.backlogQty
    })

    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonText: willBacklog ? 'บันทึกจ่ายบางส่วน' : 'บันทึกจ่ายครบ',
      customClass: {
        container: 'stock-swal-container',
      },
      icon: 'question',
      showCancelButton: true,
      text: deniedSelection.length ? `จ่ายสินค้า ${items.filter((item) => !item.denied).length} รายการ และไม่ให้เบิก ${deniedSelection.length} รายการ โดยใช้หมายเหตุรายการเป็นเหตุผล ส่วนที่เหลือเก็บเป็นยอดค้าง` : willBacklog
        ? 'ระบบจะตัดสต๊อกตามจำนวนที่จ่ายจริง และเก็บยอดที่เหลือไว้ในรายการค้างเพื่อกลับมาจ่ายต่อภายหลัง'
        : 'ระบบจะตัดสต๊อกและเปลี่ยนสถานะคำขอเป็นได้ของครบ',
      title: deniedSelection.length ? 'ยืนยันบันทึกการจ่ายและไม่ให้เบิก' : willBacklog ? 'ยืนยันจ่ายบางส่วน' : 'ยืนยันจ่ายครบ',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      setSavingDenials(true)
      await approveRequisition(selectedRow.headerId, {
        employeeId,
        items,
      })

      setSelectedRow(null)
      setFulfillmentDraft({})
      setItemRemarks({})
      await loadRows()
      window.dispatchEvent(new CustomEvent('stock-issue:requisition-updated'))
      setDeniedSelection([])
      await Swal.fire('สำเร็จ', 'บันทึกรายการจ่ายและรายการไม่ให้เบิกแล้ว', 'success')
      window.location.reload()
    } catch (error) {
      Swal.fire('ไม่สำเร็จ', error?.response?.data ?? 'บันทึกการจ่ายสินค้าไม่สำเร็จ', 'error')
    } finally {
      setSavingDenials(false)
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
      })

      setSelectedRow(null)
      setFulfillmentDraft({})
      setItemRemarks({})
      await loadRows()
      window.dispatchEvent(new CustomEvent('stock-issue:requisition-updated'))
      await Swal.fire('สำเร็จ', 'บันทึกเป็นรายการค้างแล้ว', 'success')
      window.location.reload()
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
      })

      setSelectedRow(null)
      setFulfillmentDraft({})
      setItemRemarks({})
      await loadRows()
      window.dispatchEvent(new CustomEvent('stock-issue:requisition-updated'))
      await Swal.fire({
        customClass: {
          container: 'stock-swal-container',
        },
        icon: 'success',
        text: 'บันทึกสถานะไม่ให้เบิกแล้ว',
        title: 'สำเร็จ',
      })
      window.location.reload()
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
      key: 'approval',
      label: 'อนุมัติ',
      width: 85,
      align: 'center',
      searchable: false,
      sortable: false,
      render: (row) => row.statusId === 10 ? (
        <Button size="small" variant="contained" onClick={() => handleAccept(row)}>
          อนุมัติ
        </Button>
      ) : null,
    },
    {
      key: 'createdAt',
      label: 'วันที่ส่งคำขอ',
      width: 150,
      value: (row) => formatDisplayDateTime(row.createdAt),
      sortValue: (row) => Number(row.headerId ?? 0),
    },
    { key: 'requestNo', label: 'เลขที่คำขอ', width: 170, minWidth: 170, render: (row) => <Box sx={{ whiteSpace: 'nowrap' }}>{row.requestNo}</Box> },
    {
      key: 'isUrgent',
      headerNoWrap: true,
      label: 'เบิกด่วน',
      width: 105,
      align: 'center',
      value: (row) => (row.isUrgent ? 'ด่วน' : ''),
      render: (row) => (
        row.isUrgent ? (
          <Chip
            color="error"
            icon={<Zap size={14} />}
            label="ด่วน"
            size="small"
            sx={{ fontWeight: 900 }}
          />
        ) : (
          <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>-</Typography>
        )
      ),
    },
    { key: 'division', label: 'ฝ่าย', width: 100 },
    { key: 'department', label: 'แผนก', width: 100 },
    { key: 'employeeId', label: 'รหัสพนักงาน', width: 130, align: 'center' },
    { key: 'employeeName', label: 'ผู้ขอเบิก', width: 170 },
    { key: 'totalItems', label: 'รายการ', width: 110, align: 'center' },
    { key: 'totalQty', label: 'ยอดที่ต้องจ่าย', width: 130, align: 'center' },
    {
      key: 'waitingDuration',
      label: 'ระยะเวลารอ',
      width: 125,
      align: 'center',
      value: (row) => (([6, 8].includes(row.statusId) && row.approvedAt) ? getElapsedDuration(row.approvedAt).label : '-'),
      sortValue: (row) => (([6, 8].includes(row.statusId) && row.approvedAt) ? getElapsedDuration(row.approvedAt).days * 24 + getElapsedDuration(row.approvedAt).hours : -1),
      render: (row) => (([6, 8].includes(row.statusId) && row.approvedAt) ? getElapsedDuration(row.approvedAt).label : '-'),
    },
    {
      key: 'status',
      label: 'สถานะ',
      width: 240,
      minWidth: 240,
      value: (row) => getRequisitionStatusLabel(row),
      render: (row) => <Chip color={isPartiallyAllowedRequisition(row) ? 'info' : getStatusColor(row.statusId)} label={getRequisitionStatusLabel(row)} size="small" sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'nowrap', py: 0.5 } }} />,
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

  const handleDenyItem = async (item) => {
    if (!selectedRow || savingDenials || item.backlogQty <= 0) return
    const headerId = selectedRow.headerId
    const result = await Swal.fire({
      title: 'ยืนยันไม่ให้เบิกสินค้า',
      text: `สินค้า “${item.productName}” จำนวน ${item.backlogQty} ${item.unit}`,
      input: 'textarea',
      inputLabel: 'หมายเหตุไม่ให้เบิก (ถ้ามี)',
      inputPlaceholder: 'ระบุเหตุผลที่ไม่ให้เบิกสินค้า',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'บันทึกไม่ให้เบิก',
      cancelButtonText: 'ยกเลิก',
      customClass: { container: 'stock-swal-container' },
    })
    if (!result.isConfirmed) return
    setSavingDenials(true)
    try {
      const saved = await denyRequisitionItem(headerId, item.detailId, {
        employeeId,
        itemRemark: itemRemarks[item.detailId]?.trim() ?? '',
        remark: result.value?.trim() ?? '',
      })
      setSelectedRow((previous) => previous?.headerId !== headerId ? previous : {
        ...previous,
        statusId: saved?.statusId ?? previous.statusId,
        items: previous.items.map((row) => row.detailId !== item.detailId ? row : {
          ...row,
          deniedQty: row.deniedQty + row.backlogQty,
          backlogQty: 0,
          denyRemark: result.value?.trim() ?? '',
        }),
      })
      setFulfillmentDraft((previous) => ({ ...previous, [item.detailId]: 0 }))
      await loadRows()
      window.dispatchEvent(new CustomEvent('stock-issue:requisition-updated'))
      await Swal.fire({ title: 'บันทึกสำเร็จ', text: 'ทำรายการสินค้าอื่นต่อได้เลย', icon: 'success', customClass: { container: 'stock-swal-container' } })
    } catch (error) {
      await Swal.fire({ title: 'บันทึกไม่สำเร็จ', text: String(error?.response?.data ?? 'กรุณาลองอีกครั้ง'), icon: 'error', customClass: { container: 'stock-swal-container' } })
    } finally {
      setSavingDenials(false)
    }
  }

  const detailColumns = [
    {
      key: 'denyItem',
      label: 'สถานะ / จัดการ',
      width: 130,
      align: 'center',
      searchable: false,
      sortable: false,
      render: (row) => row.deniedQty > 0 ? (
        <Chip title={row.denyRemark || undefined} label="ไม่อนุญาตให้เบิก" size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontSize: 12 }} />
      ) : row.fulfilledQty > 0 && row.backlogQty <= 0 ? (
        <Chip label="เบิกแล้ว" size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontSize: 12 }} />
      ) : (
        <Button
          color="error"
          disabled={savingDenials || Number(row.backlogQty ?? 0) <= 0}
          size="small"
          variant="outlined"
          onClick={() => handleDenyItem(row)}
        >ไม่ให้เบิก</Button>
      ),
    },
    { key: 'code', label: 'รหัสสินค้า', width: 175, headerNoWrap: true },
    {
      key: 'productName',
      label: 'ชื่อสินค้า',
      width: 210,
      wrap: true,
      render: (row) => (
        <Box sx={{ lineHeight: 1.45, overflowWrap: 'anywhere', py: 0.5, textAlign: 'left', wordBreak: 'break-word' }}>
          {row.productName || '-'}
        </Box>
      ),
    },
    { key: 'category', label: 'หมวดหมู่', width: 120 },
    { key: 'quantity', label: 'ขอเบิก', width: 85, align: 'center', headerNoWrap: true },
    { key: 'fulfilledQty', label: 'จ่ายแล้ว', width: 85, align: 'center' },
    { key: 'backlogQty', label: 'ยังค้าง', width: 85, align: 'center', headerNoWrap: true },
    {
      key: 'availableQty',
      label: 'คงเหลือ',
      width: 95,
      align: 'center',
      render: (row) => {
        const availableQty = Number(row.availableQty ?? 0)
        return <Box sx={{ color: availableQty <= 0 ? '#dc2626' : '#15803d', fontWeight: 800 }}>{availableQty.toLocaleString('th-TH')}</Box>
      },
    },
    {
      key: 'projectedStockQty',
      label: 'คงเหลือหลังจ่าย',
      width: 120,
      align: 'center',
      searchable: false,
      value: (row) => row.availableQty - row.backlogQty,
      render: (row) => {
        const projectedQty = row.availableQty - row.backlogQty
        return <Box sx={{ color: projectedQty < 0 ? '#dc2626' : '#15803d', fontWeight: 800 }}>{projectedQty.toLocaleString('th-TH')}</Box>
      },
    },
    {
      key: 'issueNow',
      label: 'จ่ายครั้งนี้',
      width: 100,
      searchable: false,
      sortable: false,
      render: (row) => {
        const issueQty = Number(fulfillmentDraft[row.detailId] ?? 0)
        const isOverRequested = issueQty > Number(row.backlogQty ?? 0)

        return (
          <TextField
          fullWidth
          sx={{ '& input': { textAlign: 'center', px: 1 } }}
          disabled={savingDenials || deniedSelection.includes(row.detailId) || selectedRow?.statusId === 10 || row.backlogQty <= 0 || row.availableQty <= 0}
          error={isOverRequested}
          helperText={isOverRequested ? `ห้ามใส่เกินจำนวนที่ขอเบิก (${Number(row.backlogQty).toLocaleString('th-TH')})` : ''}
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
        )
      },
    },
    { key: 'unit', label: 'หน่วย', width: 85, headerNoWrap: true },
    {
      key: 'itemRemark',
      label: 'หมายเหตุรายการ',
      width: 210,
      searchable: false,
      sortable: false,
      render: (row) => (
        <TextField
          fullWidth
          placeholder="เช่น ของหมด รอสั่งซื้อ"
          size="small"
          value={itemRemarks[row.detailId] ?? ''}
          onChange={(event) => handleItemRemarkChange(row.detailId, event.target.value)}
        />
      ),
    },
  ]

  return (
    <Box className="approvals-page">
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
      {scanError ? <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setScanError('')}>{scanError}</Alert> : null}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '14px !important' }}>
          <Stack alignItems={{ xs: 'stretch', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              autoComplete="off"
              fullWidth
              label="สแกนบาร์โค้ดใบเบิก"
              placeholder="คลิกช่องนี้ แล้วสแกนเลขที่ใบเบิก"
              size="small"
              value={scanRequestNo}
              onChange={(event) => {
                setScanRequestNo(event.target.value)
                setScanError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  openScannedRequest()
                }
              }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><Barcode size={18} /></InputAdornment>,
                },
              }}
            />
            <Button disabled={!scanRequestNo.trim()} variant="contained" onClick={openScannedRequest} sx={{ minWidth: 120 }}>
              แสดงเอกสาร
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ alignItems: 'stretch', mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card className="approvals-page__summary-card" sx={{ border: '1px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', height: '100%' }}>
            <CardContent>
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>รายการรออนุมัติ/รอจัด/ค้าง</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{summary.documents}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card className="approvals-page__summary-card" sx={{ border: '1px solid #bbf7d0', background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', height: '100%' }}>
            <CardContent>
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>รอจัดของ</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{summary.pending}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card className="approvals-page__summary-card" sx={{ border: '1px solid #fed7aa', background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)', height: '100%' }}>
            <CardContent>
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>งานค้าง</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{summary.backlog}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card className="approvals-page__summary-card" sx={{ border: '1px solid #fecaca', background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)', height: '100%' }}>
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
            prioritySortValue={(row) => Number(row.isUrgent)}
            fitToWidth
            maxHeight="calc(100vh - 380px)"
            noDataText="ไม่มีรายการรออนุมัติ รอจัดของ หรือรายการค้าง"
            rows={rows}
            showGlobalSearch
          />
        </CardContent>
      </Card>

      <Dialog
        disableEnforceFocus
        fullWidth
        maxWidth={false}
        open={Boolean(selectedRow)}
        PaperProps={{ sx: { maxWidth: 'calc(100vw - 48px)', width: 'calc(100vw - 48px)' } }}
        onClose={() => setSelectedRow(null)}
      >
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
              {selectedRow?.statusId === 8 ? 'พิมพ์ใบค้าง' : 'พิมพ์ใบคำขอ'}
            </Button>
            <Button
              startIcon={<FileDown size={18} />}
              variant="outlined"
              onClick={handleDownloadSelectedRowPdf}
            >
              {selectedRow?.statusId === 8 ? 'ดาวน์โหลด PDF ใบค้าง' : 'ดาวน์โหลด PDF'}
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
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>ฝ่าย</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{selectedRow.division || '-'}</Typography>
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
                  { label: 'ไม่ให้เบิก', value: selectedProgress.denied, color: '#fef2f2', border: '#fecaca' },
                  { label: 'จ่ายรอบนี้', value: selectedProgress.issueNow, color: '#f5f3ff', border: '#ddd6fe' },
                ].map((progress) => (
                  <Grid key={progress.label} size={{ xs: 6, md: 2.4 }}>
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
                {selectedRow.statusId === 10
                  ? 'รอ HR อนุมัติคำขอเบิก เมื่ออนุมัติจะเปลี่ยนเป็นรอจัดของและเริ่มนับระยะเวลารอ โดยยังไม่ตัดสต๊อก'
                  : 'ถ้าของไม่พอ ให้กรอกจำนวนที่จ่ายได้จริงในช่อง “จ่ายครั้งนี้” ระบบจะตัดสต๊อกเฉพาะจำนวนนั้น และเก็บส่วนที่เหลือเป็นรายการค้างเพื่อรอจ่ายต่อ'}
              </Alert>
              <AppTable
                columns={detailColumns}
                fitToWidth
                initialRowsPerPage={25}
                maxHeight={380}
                minTableWidth={1600}
                noDataText="ไม่มีรายการสินค้า"
                rows={selectedRow.items}
                rowKey="detailId"
                showGlobalSearch={false}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button disabled={savingDenials || selectedProgress.backlog === 0 || selectedRow?.statusId === 10} color="warning" startIcon={<XCircle size={18} />} variant="outlined" onClick={handleReject}>
            ยังไม่จ่าย
          </Button>
          <Button disabled={savingDenials || selectedProgress.backlog === 0 || deniedSelection.length > 0} color="error" startIcon={<Ban size={18} />} variant="outlined" onClick={handleDeny}>
            ไม่ให้เบิก
          </Button>
          <Button disabled={savingDenials} startIcon={<CheckCircle2 size={18} />} variant="contained" onClick={handleApprove}>
            {selectedProgress.backlog === 0 ? 'เสร็จสิ้น / ปิดรายการ' : selectedRow?.statusId === 10 ? 'อนุมัติคำขอเบิก' : 'บันทึกการจ่ายสินค้า'}
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
