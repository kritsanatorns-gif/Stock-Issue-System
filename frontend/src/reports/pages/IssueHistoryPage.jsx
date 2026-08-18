import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { FileDown, FileText, Printer, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  cancelStockIssue,
  cancelStockReceive,
  getRequisitions,
  getStockAdjustments,
  getStockIssues,
  getStockReceives,
} from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { useAuthStore } from '../../store/authStore'
import { formatDisplayDateTime, getDateSortValue, getIdSortValue } from '../../utils/dateUtils'
import { exportRowsToExcel } from '../../utils/excelUtils'
import {
  buildPrintableRowWithBacklog,
  downloadHistorySlipPdf as downloadRequestSlipPdf,
  printHistorySlip as printRequestSlip,
} from '../../request/pages/RequestHistoryPage'
import ReportFilters from '../components/ReportFilters'
import ReportDataTable from '../components/ReportDataTable'
import ReportSummaryCard from '../components/ReportSummaryCard'
import { getIssueReports } from '../services/issueReportStorage'

const exportColumns = [
  { header: 'วันที่', value: (row) => row.date },
  { header: 'ประเภท', value: (row) => row.documentTypeLabel },
  { header: 'แผนกทำรายการ', value: (row) => row.employeeDepartment },
  { header: 'จำนวนรายการสินค้า', value: (row) => row.totalItems },
  { header: 'จำนวนรวม', value: (row) => row.totalQty },
  { header: 'ต้นทุนรวม', value: (row) => row.totalCost },
  { header: 'ผู้ทำรายการ', value: (row) => row.employeeName },
  { header: 'สถานะ', value: (row) => row.status },
]

const issueSlipColumns = [
  { key: 'lineNo', label: 'ลำดับ', width: 80, sortable: false },
  { key: 'code', label: 'รหัสสินค้า', width: 160, sortable: false },
  { key: 'barcode', label: 'Barcode', width: 150, sortable: false },
  { key: 'productName', label: 'ชื่อสินค้า', width: 260, sortable: false },
  { key: 'category', label: 'หมวดหมู่', width: 120, sortable: false },
  { key: 'quantity', label: 'จำนวน', width: 100, align: 'center', sortable: false },
  { key: 'unit', label: 'หน่วย', width: 100, sortable: false },
  {
    key: 'unitCost',
    label: 'ต้นทุน/หน่วย',
    width: 120,
    align: 'center',
    sortable: false,
    render: (row) => formatMoney(row.unitCost),
  },
  {
    key: 'totalCost',
    label: 'ต้นทุนรวม',
    width: 120,
    align: 'center',
    sortable: false,
    render: (row) => formatMoney(row.totalCost),
  },
]

const backlogExportColumns = [
  { header: 'วันที่ขอเบิก', value: (row) => row.requestDateName },
  { header: 'เลขที่คำขอ', value: (row) => row.requestNo },
  { header: 'ค้างมาแล้ว (วัน)', value: (row) => row.backlogDays },
  { header: 'ระดับการตามงาน', value: (row) => row.followUpText },
  { header: 'แผนก', value: (row) => row.department },
  { header: 'ผู้ขอเบิก', value: (row) => row.requesterName },
  { header: 'รหัสสินค้า', value: (row) => row.productCode },
  { header: 'ชื่อสินค้า', value: (row) => row.productName },
  { header: 'จำนวนที่ขอ', value: (row) => row.requestQty },
  { header: 'จ่ายแล้ว', value: (row) => row.fulfilledQty },
  { header: 'ยังค้าง', value: (row) => row.backlogQty },
  { header: 'คงเหลือปัจจุบัน', value: (row) => row.availableQty },
  { header: 'หน่วย', value: (row) => row.unit },
  { header: 'หมายเหตุ HR', value: (row) => row.hrRemark || '-' },
]

const backlogColumns = [
  { key: 'requestDateName', label: 'วันที่ขอเบิก', width: 145, value: (row) => row.requestDateName, sortValue: (row) => getIdSortValue(row.requestNo, row.detailId) },
  { key: 'requestNo', label: 'เลขที่คำขอ', width: 130 },
  { key: 'backlogDays', label: 'ค้างมาแล้ว', width: 110, align: 'center', render: (row) => `${row.backlogDays} วัน` },
  {
    key: 'followUpText',
    label: 'ระดับการตามงาน',
    width: 125,
    align: 'center',
    render: (row) => (
      <Chip
        color={row.followUpColor}
        label={row.followUpText}
        size="small"
        sx={{ fontWeight: 800 }}
      />
    ),
  },
  { key: 'department', label: 'แผนก', width: 110, align: 'center' },
  { key: 'requesterName', label: 'ผู้ขอเบิก', width: 170 },
  { key: 'productCode', label: 'รหัสสินค้า', width: 160 },
  { key: 'productName', label: 'ชื่อสินค้า', width: 240 },
  { key: 'requestQty', label: 'จำนวนที่ขอ', width: 110, align: 'center' },
  { key: 'fulfilledQty', label: 'จ่ายแล้ว', width: 95, align: 'center' },
  { key: 'backlogQty', label: 'ยังค้าง', width: 95, align: 'center' },
  { key: 'availableQty', label: 'คงเหลือปัจจุบัน', width: 130, align: 'center' },
  { key: 'unit', label: 'หน่วย', width: 90, align: 'center' },
  { key: 'hrRemark', label: 'หมายเหตุ HR', width: 240, wrap: true, value: (row) => row.hrRemark || '-', render: (row) => row.hrRemark || '-' },
]

function normalizeReportItem(item, index) {
  return {
    ...item,
    category: String(item.category ?? '').trim() || 'General',
    detailId: item.detailId ?? item.DetailId ?? 0,
    lineNo: item.lineNo ?? index + 1,
    totalCost: Number(item.totalCost ?? item.TotalCost ?? 0),
    unitCost: Number(item.unitCost ?? item.UnitCost ?? 0),
  }
}

function formatMoney(value) {
  return Number(value ?? 0).toLocaleString('th-TH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildDocumentRows(reports) {
  return reports.map((report) => {
    const items = (report.items ?? []).map(normalizeReportItem)
    const sortId = getIdSortValue(report.headerId, report.documentId, report.documentNo, report.requestNo)

    return {
      createdAt: report.createdAt,
      date: formatDisplayDateTime(report.createdAt),
      documentNo: report.documentNo,
      documentType: report.documentType ?? 'ISSUE',
      documentTypeLabel: report.documentTypeLabel ?? 'เบิกสินค้า',
      employeeDepartment: report.employeeDepartment || 'HR',
      employeeName: report.employeeName,
      status: report.status,
      sortId,
      totalCost: items.reduce((total, item) => total + Number(item.totalCost ?? 0), 0),
      totalItems: items.length,
      totalQty: items.reduce((total, item) => total + Number(item.quantity ?? 0), 0),
    }
  })
}

function isReversedStatus(status) {
  return ['ถอยยอด', 'ถอยยอดบางส่วน', 'ยกเลิก'].includes(String(status ?? '').trim())
}

function getBacklogFollowUp(backlogDays) {
  if (backlogDays >= 7) {
    return { color: 'error', text: 'ตามด่วน' }
  }

  if (backlogDays >= 3) {
    return { color: 'warning', text: 'ควรตาม' }
  }

  return { color: 'default', text: 'ตามปกติ' }
}

function cleanReportDepartment(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return 'ไม่ระบุแผนก'
  }

  const cancelIndex = text.toLowerCase().indexOf('| cancel:')

  if (cancelIndex >= 0) {
    return text.slice(0, cancelIndex).trim() || 'ไม่ระบุแผนก'
  }

  return text
}

function getNumberValue(...values) {
  const value = values.find((item) => item !== undefined && item !== null && item !== '')
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function getTextValue(...values) {
  const value = values.find((item) => String(item ?? '').trim())

  return String(value ?? '').trim()
}

function findRelatedRequisition(report, requisitions) {
  const documentNo = String(report?.documentNo ?? '').trim()
  const requestNo = String(report?.requestNo ?? report?.RequestNo ?? '').trim()
  const headerId = String(report?.requestHeaderId ?? report?.RequestHeaderId ?? '').trim()

  return (requisitions ?? []).find((row) => {
    const rowRequestNo = String(row.requestNo ?? row.RequestNo ?? '').trim()
    const rowHeaderId = String(row.headerId ?? row.HeaderId ?? '').trim()

    return (
      (requestNo && rowRequestNo === requestNo)
      || (documentNo && rowRequestNo === documentNo)
      || (headerId && rowHeaderId === headerId)
    )
  })
}

function buildRequestSlipRowFromReport(report, requisitions) {
  const relatedRequisition = findRelatedRequisition(report, requisitions)

  if (relatedRequisition) {
    return buildPrintableRowWithBacklog(relatedRequisition, requisitions)
  }

  const items = (report.items ?? []).map((item, index) => {
    const normalizedItem = normalizeReportItem(item, index)
    const quantity = getNumberValue(
      normalizedItem.quantity,
      normalizedItem.qty,
      item.Qty,
      item.quantity,
    )

    return {
      ...normalizedItem,
      backlogQty: getNumberValue(normalizedItem.backlogQty, item.BacklogQty, 0),
      category: getTextValue(normalizedItem.category, item.Category, 'General'),
      fulfilledQty: getNumberValue(normalizedItem.fulfilledQty, item.FulfilledQty, quantity),
      productName: getTextValue(normalizedItem.productName, item.ProductName),
      quantity,
      remark: getTextValue(normalizedItem.remark, item.Remark),
      unit: getTextValue(normalizedItem.unit, item.Unit),
    }
  })

  return buildPrintableRowWithBacklog({
    createdAt: report.createdAt,
    department: cleanReportDepartment(report.department),
    employeeName: getTextValue(
      report.requesterName,
      report.requestEmployeeName,
      report.employeeName,
      report.department,
      '-',
    ),
    hrRemark: getTextValue(report.hrRemark, report.HrRemark),
    isUrgent: Boolean(report.isUrgent ?? report.IsUrgent),
    items,
    requestNo: getTextValue(report.requestNo, report.RequestNo, report.documentNo),
    status: report.status,
    statusId: getNumberValue(report.statusId, report.StatusId),
    urgentRemark: getTextValue(report.urgentRemark, report.UrgentRemark),
    userRemark: getTextValue(report.userRemark, report.UserRemark, report.remark),
  }, requisitions)
}

function flattenBacklogRows(requisitions) {
  return requisitions.flatMap((requisition) =>
    (requisition.items ?? [])
      .filter((item) => Number(item.backlogQty ?? 0) > 0)
      .map((item) => {
        const requestedAt = requisition.createdAt
        const requestDate = dayjs(requestedAt)
        const backlogDays = Math.max(0, dayjs().startOf('day').diff(requestDate.startOf('day'), 'day'))
        const followUp = getBacklogFollowUp(backlogDays)

        return {
          availableQty: Number(item.availableQty ?? 0),
          backlogDays,
          backlogQty: Number(item.backlogQty ?? 0),
          department: cleanReportDepartment(requisition.department),
          detailId: item.detailId,
          fulfilledQty: Number(item.fulfilledQty ?? 0),
          followUpColor: followUp.color,
          followUpText: followUp.text,
          hrRemark: requisition.hrRemark ?? '',
          productCode: item.code,
          productName: item.productName,
          requestDateName: formatDisplayDateTime(requestedAt),
          requestedAt,
          requesterName: requisition.employeeName ?? requisition.requesterName ?? '-',
          requestNo: requisition.requestNo,
          requestQty: Number(item.quantity ?? 0),
          unit: item.unit ?? '',
        }
      }),
  )
}

async function getHistoryReports(params) {
  const [stockIssues, stockReceives, stockAdjustments] = await Promise.all([
    getStockIssues(params),
    getStockReceives(params),
    getStockAdjustments(params),
  ])

  return [
    ...(stockIssues ?? []).map((report) => ({
      ...report,
      documentType: 'ISSUE',
      documentTypeLabel: 'เบิกสินค้า',
    })),
    ...(stockReceives ?? []).map((report) => ({
      ...report,
      documentType: 'RECEIVE',
      documentTypeLabel: 'รับเข้า',
    })),
    ...(stockAdjustments ?? []).map((report) => ({
      ...report,
      documentType: 'ADJUST',
      documentTypeLabel: 'ปรับสต๊อก',
    })),
  ].sort((a, b) => {
    const idDiff = getIdSortValue(b.headerId, b.documentId, b.documentNo, b.requestNo)
      - getIdSortValue(a.headerId, a.documentId, a.documentNo, a.requestNo)

    return idDiff || getDateSortValue(b.createdAt) - getDateSortValue(a.createdAt)
  })
}

function getDocumentLabels(report) {
  const isReceive = report.documentType === 'RECEIVE'
  const isAdjust = report.documentType === 'ADJUST'

  return {
    actorLabel: isAdjust ? 'ผู้ปรับสต๊อก' : isReceive ? 'ผู้รับเข้า' : 'ผู้จ่ายสินค้า',
    departmentLabel: isAdjust ? 'เหตุผลการปรับสต๊อก' : isReceive ? 'แผนก / หมายเหตุ' : 'ผู้เบิก / แผนก',
    printLabel: isAdjust ? 'พิมพ์ใบปรับสต๊อก' : isReceive ? 'พิมพ์ใบรับเข้า' : 'พิมพ์ใบเบิก',
    title: isAdjust ? 'ใบปรับสต๊อก' : isReceive ? 'ใบรับเข้าสินค้า' : 'ใบเบิกสินค้า',
  }
}

function buildIssueSlipContentHtml(report) {
  const labels = getDocumentLabels(report)
  const issueDepartment = report.department || '-'
  const issuedBy = report.employeeName || '-'
  const rows = report.items.map(normalizeReportItem)
    .map(
      (item) => `
        <tr>
          <td class="center">${escapeHtml(item.lineNo)}</td>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.barcode)}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(String(item.category ?? '').trim() || 'General')}</td>
          <td class="right">${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td class="right">${escapeHtml(formatMoney(item.unitCost))}</td>
          <td class="right">${escapeHtml(formatMoney(item.totalCost))}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <div class="issue-slip">
      <div class="issue-slip__header">
        <div>
          <h1>${escapeHtml(labels.title)}</h1>
          <p>ระบบการเบิกสินค้าสำนักงาน</p>
        </div>
        <div class="issue-slip__status">${escapeHtml(report.status)}</div>
      </div>

      <section class="issue-slip__info">
        <div>
          <span>วันที่บันทึก</span>
          <strong>${escapeHtml(formatDisplayDateTime(report.createdAt))}</strong>
        </div>
        <div>
          <span>${escapeHtml(labels.departmentLabel)}</span>
          <strong>${escapeHtml(issueDepartment)}</strong>
        </div>
        <div>
          <span>จำนวนรายการ</span>
          <strong>${escapeHtml(report.totalItems)} รายการ</strong>
        </div>
        <div>
          <span>จำนวนรวม</span>
          <strong>${escapeHtml(report.totalQty)} ชิ้น/หน่วย</strong>
        </div>
      </section>

      <table>
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>รหัสสินค้า</th>
            <th>Barcode</th>
            <th>ชื่อสินค้า</th>
            <th>หมวดหมู่</th>
            <th>จำนวน</th>
            <th>หน่วย</th>
            <th>ต้นทุน/หน่วย</th>
            <th>ต้นทุนรวม</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <section class="issue-slip__signatures">
        <div>
          <strong>${escapeHtml(issueDepartment)}</strong>
          <span>${escapeHtml(labels.departmentLabel)}</span>
        </div>
        <div>
          <strong>${escapeHtml(issuedBy)}</strong>
          <span>${escapeHtml(labels.actorLabel)}</span>
        </div>
      </section>
    </div>
  `
}

function buildIssueSlipStyleHtml() {
  return `
    <style>
      * { box-sizing: border-box; }
      body {
        color: #111827;
        font-family: "Tahoma", "Arial", sans-serif;
        font-size: 12px;
        margin: 0;
      }
      .issue-slip {
        background: #ffffff;
        color: #111827;
        font-family: "Tahoma", "Arial", sans-serif;
        min-height: 1123px;
        padding: 42px;
        width: 794px;
      }
      .issue-slip__header {
        align-items: flex-start;
        border-bottom: 2px solid #111827;
        display: flex;
        justify-content: space-between;
        padding-bottom: 14px;
      }
      .issue-slip h1 {
        font-size: 26px;
        font-weight: 800;
        margin: 0 0 6px;
      }
      .issue-slip p {
        color: #475569;
        margin: 0;
      }
      .issue-slip__status {
        border: 1px solid #16a34a;
        border-radius: 999px;
        color: #15803d;
        font-weight: 800;
        padding: 6px 14px;
      }
      .issue-slip__info {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(4, 1fr);
        margin: 18px 0;
      }
      .issue-slip__info span {
        color: #64748b;
        display: block;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .issue-slip__info strong {
        color: #0f172a;
        display: block;
        font-size: 13px;
        font-weight: 800;
      }
      .issue-slip table {
        border-collapse: collapse;
        margin-top: 10px;
        width: 100%;
      }
      .issue-slip th,
      .issue-slip td {
        border: 1px solid #cbd5e1;
        padding: 8px;
        vertical-align: top;
      }
      .issue-slip th {
        background: #f1f5f9;
        font-size: 11px;
        text-align: center;
      }
      .issue-slip .center { text-align: center; }
      .issue-slip .right { text-align: right; }
      .issue-slip__signatures {
        display: grid;
        gap: 28px;
        grid-template-columns: repeat(2, 1fr);
        margin-top: 58px;
      }
      .issue-slip__signatures div {
        color: #475569;
        text-align: center;
      }
      .issue-slip__signatures span {
        border-top: 1px solid #94a3b8;
        display: block;
        font-size: 11px;
        margin-top: 8px;
        padding-top: 8px;
      }
      .issue-slip__signatures strong {
        color: #0f172a;
        display: block;
        font-size: 13px;
        min-height: 20px;
      }
      @page { margin: 14mm; size: A4; }
      @media print {
        body { background: #ffffff; }
      }
    </style>
  `
}

function buildIssueSlipPrintHtml(report) {
  const labels = getDocumentLabels(report)

  return `
    <!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(labels.title)}</title>
        ${buildIssueSlipStyleHtml()}
      </head>
      <body>
        ${buildIssueSlipContentHtml(report)}
        <script>
          window.addEventListener('load', () => {
            window.focus()
            window.print()
          })
        </script>
      </body>
    </html>
  `
}

function openIssueSlipPrintWindow(report) {
  const printWindow = window.open('', '_blank', 'width=1100,height=800')

  if (!printWindow) {
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildIssueSlipPrintHtml(report))
  printWindow.document.close()
}

async function downloadIssueSlipPdf(report) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])
  const html2canvas = html2canvasModule.default
  const container = document.createElement('div')

  container.style.background = '#ffffff'
  container.style.left = '-10000px'
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.width = '794px'
  container.innerHTML = `${buildIssueSlipStyleHtml()}${buildIssueSlipContentHtml(report)}`
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container.querySelector('.issue-slip'), {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })
    const imageData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pdfWidth) / canvas.width
    let heightLeft = imageHeight
    let position = 0

    pdf.addImage(imageData, 'PNG', 0, position, pdfWidth, imageHeight)
    heightLeft -= pdfHeight

    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, position, pdfWidth, imageHeight)
      heightLeft -= pdfHeight
    }

    pdf.save(`${report.documentNo}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

function ReportsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const employee = useAuthStore((state) => state.employee)
  const employeeId = employee?.id ?? employee?.employeeId ?? employee?.EmployeeId ?? 0
  const employeeName =
    employee?.employeeName
    ?? employee?.EmployeeName
    ?? employee?.name
    ?? employee?.username
    ?? employee?.Username
    ?? 'ผู้ใช้งาน'
  const [reportType, setReportType] = useState('all')
  const [startDate, setStartDate] = useState(() => dayjs().subtract(6, 'day').format('YYYY-MM-DD'))
  const [endDate, setEndDate] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [reports, setReports] = useState(() => getIssueReports())
  const [requisitions, setRequisitions] = useState([])
  const [selectedDocumentNo, setSelectedDocumentNo] = useState('')
  const [cancelRemark, setCancelRemark] = useState('')
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isCancelLoading, setIsCancelLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  const selectedReport = useMemo(
    () => {
      const report = reports.find((item) => item.documentNo === selectedDocumentNo)

      if (!report) {
        return null
      }

      return {
        ...report,
        items: (report.items ?? []).map(normalizeReportItem),
      }
    },
    [reports, selectedDocumentNo],
  )

  const filteredReports = useMemo(() => {
    if (!['all', 'stockIssue', 'stockReceive', 'stockAdjust'].includes(reportType)) {
      return []
    }

    return reports.filter((report) => {
      const rowDate = dayjs(report.createdAt)
      const matchesStart = startDate ? rowDate.isAfter(dayjs(startDate).subtract(1, 'day')) : true
      const matchesEnd = endDate ? rowDate.isBefore(dayjs(endDate).add(1, 'day')) : true
      const matchesType =
        reportType === 'all'
          ? true
          : reportType === 'stockIssue'
            ? report.documentType === 'ISSUE'
            : reportType === 'stockReceive'
              ? report.documentType === 'RECEIVE'
              : report.documentType === 'ADJUST'

      return matchesStart && matchesEnd && matchesType
    })
  }, [endDate, reportType, reports, startDate])

  const documentRows = useMemo(() => buildDocumentRows(filteredReports), [filteredReports])
  const backlogRows = useMemo(() => flattenBacklogRows(requisitions), [requisitions])

  const summaryItems = useMemo(() => {
    if (reportType === 'backlog') {
      const backlogDocumentCount = new Set(backlogRows.map((row) => row.requestNo)).size
      const backlogProductCount = new Set(backlogRows.map((row) => row.productCode)).size
      const backlogTotalQty = backlogRows.reduce((total, row) => total + row.backlogQty, 0)
      const oldestBacklogDays = backlogRows.reduce((maxDays, row) => Math.max(maxDays, row.backlogDays), 0)

      return [
        { label: 'จำนวนใบค้าง', value: backlogDocumentCount.toLocaleString('th-TH') },
        { label: 'จำนวนค้างรวม', value: backlogTotalQty.toLocaleString('th-TH') },
        { label: 'สินค้าที่ค้าง', value: backlogProductCount.toLocaleString('th-TH') },
        { label: 'ค้างนานสุด', value: `${oldestBacklogDays.toLocaleString('th-TH')} วัน` },
      ]
    }

    const documentCount = filteredReports.length
    const receiveCount = filteredReports.filter(
      (report) => report.documentType === 'RECEIVE' && !isReversedStatus(report.status),
    ).length
    const issueCount = filteredReports.filter(
      (report) => report.documentType === 'ISSUE' && !isReversedStatus(report.status),
    ).length
    const adjustCount = filteredReports.filter(
      (report) => report.documentType === 'ADJUST' && !isReversedStatus(report.status),
    ).length
    const reverseCount = filteredReports.filter((report) => isReversedStatus(report.status)).length

    return [
      { label: 'จำนวนเอกสารทั้งหมด', value: documentCount.toLocaleString('th-TH') },
      { label: 'จำนวนรับเข้า', value: receiveCount.toLocaleString('th-TH') },
      { label: 'จำนวนเบิก', value: issueCount.toLocaleString('th-TH') },
      { label: 'ปรับสต๊อก', value: adjustCount.toLocaleString('th-TH') },
      { label: 'ถอยยอด', value: reverseCount.toLocaleString('th-TH') },
    ]
  }, [backlogRows, filteredReports, reportType])

  useEffect(() => {
    const documentNo = searchParams.get('documentNo')

    if (documentNo) {
      setSelectedDocumentNo(documentNo)
    }
  }, [searchParams])

  useEffect(() => {
    let isMounted = true

    const loadReports = async () => {
      setIsLoading(true)

      try {
        const [historyReports, requisitionData] = await Promise.all([
          getHistoryReports({
            endDate,
            startDate,
          }),
          getRequisitions(),
        ])

        if (isMounted) {
          setReports(historyReports)
          setRequisitions(requisitionData ?? [])
        }
      } catch {
        if (isMounted) {
          setReports(getIssueReports())
          setRequisitions([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      isMounted = false
    }
  }, [endDate, startDate])

  const handleRunReport = async () => {
    setIsLoading(true)

    try {
      const [historyReports, requisitionData] = await Promise.all([
        getHistoryReports({
          endDate,
          startDate,
        }),
        getRequisitions(),
      ])

      setReports(historyReports)
      setRequisitions(requisitionData ?? [])
    } catch {
      setReports(getIssueReports())
      setRequisitions([])
    } finally {
      setIsLoading(false)
    }
  }

  const reloadHistoryReports = async () => {
    const historyReports = await getHistoryReports({
      endDate,
      startDate,
    })

    setReports(historyReports)
  }

  const handleOpenCancelDialog = () => {
    setCancelRemark('')
    setIsCancelDialogOpen(true)
  }

  const handleCancelDocument = async () => {
    if (!selectedReport || !cancelRemark.trim() || isCancelLoading) {
      return
    }

    const headerId = Number(selectedReport.documentNo)

    if (!Number.isFinite(headerId) || headerId <= 0) {
      await Swal.fire({
        confirmButtonText: 'ตกลง',
        icon: 'error',
        text: 'ไม่พบเลขอ้างอิงเอกสารสำหรับถอยยอด',
        title: 'ไม่สำเร็จ',
      })
      return
    }

    setIsCancelLoading(true)

    try {
      const payload = {
        employeeId,
        employeeName,
        items: [],
        remark: cancelRemark.trim(),
      }

      if (selectedReport.documentType === 'RECEIVE') {
        await cancelStockReceive(headerId, payload)
      } else {
        await cancelStockIssue(headerId, payload)
      }

      await reloadHistoryReports()
      setIsCancelDialogOpen(false)
      setSelectedDocumentNo('')

      const isReceiveCancel = selectedReport.documentType === 'RECEIVE'
      const result = await Swal.fire({
        cancelButtonText: 'อยู่หน้านี้',
        confirmButtonText: isReceiveCancel ? 'ไปรับเข้าใหม่' : 'ตกลง',
        showCancelButton: isReceiveCancel,
        icon: 'success',
        text: isReceiveCancel
          ? 'ถอยยอดใบรับเข้าเรียบร้อยแล้ว หากต้องการเพิ่มยอดใหม่ให้ไปรับเข้าสินค้าด้วยจำนวนที่ถูกต้อง'
          : 'ระบบถอยยอดและคืนสต๊อกเรียบร้อยแล้ว',
        title: 'สำเร็จ',
      })

      if (isReceiveCancel && result.isConfirmed) {
        navigate('/stock-in')
      }
    } catch (error) {
      const message =
        error?.response?.data
        ?? error?.message
        ?? 'ถอยยอดไม่สำเร็จ กรุณาตรวจสอบ Backend API'

      await Swal.fire({
        confirmButtonText: 'ตกลง',
        icon: 'error',
        text: String(message),
        title: 'ไม่สำเร็จ',
      })
    } finally {
      setIsCancelLoading(false)
    }
  }

  const handleExport = () => {
    if (reportType === 'backlog') {
      exportRowsToExcel(
        backlogRows,
        backlogExportColumns,
        `backlog-history-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
      )
      return
    }

    exportRowsToExcel(
      documentRows,
      exportColumns,
      `stock-history-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
    )
  }

  const handlePrint = () => {
    if (!selectedReport) {
      return
    }

    if (selectedReport.documentType === 'ISSUE') {
      printRequestSlip(buildRequestSlipRowFromReport(selectedReport, requisitions))
      return
    }

    openIssueSlipPrintWindow(selectedReport)
  }

  const handleDownloadPdf = async () => {
    if (!selectedReport || isPdfLoading) {
      return
    }

    setIsPdfLoading(true)

    try {
      if (selectedReport.documentType === 'ISSUE') {
        await downloadRequestSlipPdf(buildRequestSlipRowFromReport(selectedReport, requisitions))
        return
      }

      await downloadIssueSlipPdf(selectedReport)
    } finally {
      setIsPdfLoading(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>
          ประวัติ
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
          ดูประวัติการเบิกสินค้า รับเข้า ปรับสต๊อก และส่งออก Excel / PDF
        </Typography>
      </Box>

      <Card
        elevation={0}
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #d9e0ea',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <ReportFilters
            endDate={endDate}
            reportType={reportType}
            startDate={startDate}
            onEndDateChange={setEndDate}
            onExport={handleExport}
            onReportTypeChange={setReportType}
            onRunReport={handleRunReport}
            onStartDateChange={setStartDate}
          />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {summaryItems.map((item, index) => (
          <Grid key={item.label} size={{ xs: 12, sm: 6, md: 2.4 }}>
            <ReportSummaryCard
              {...item}
              color={['#2563eb', '#16a34a', '#7c3aed', '#f59e0b', '#ef4444'][index]}
            />
          </Grid>
        ))}
      </Grid>

      <Card
        elevation={0}
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #d9e0ea',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          {reportType === 'backlog' ? (
            <Stack spacing={2}>
              <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                รายละเอียดงานค้าง
              </Typography>
              <AppTable
                columns={backlogColumns}
                defaultSortField="requestDateName"
                defaultSortDirection="desc"
                isLoading={isLoading}
                maxHeight={560}
                noDataText="ไม่มีงานค้าง"
                rowKey={(row) => `${row.requestNo}-${row.detailId}`}
                rows={backlogRows}
                showGlobalSearch
              />
            </Stack>
          ) : (
            <ReportDataTable
              data={documentRows}
              isLoading={isLoading}
              onViewDocument={setSelectedDocumentNo}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        fullWidth
        maxWidth="lg"
        open={Boolean(selectedReport)}
        onClose={() => setSelectedDocumentNo('')}
      >
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1.25 }}>
          <FileText size={22} />
          {selectedReport ? getDocumentLabels(selectedReport).title : 'เอกสารรายการ'}
        </DialogTitle>
        <DialogContent>
          {selectedReport ? (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Box>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography sx={{ color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
                      {getDocumentLabels(selectedReport).title}
                    </Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                      วันที่บันทึก {formatDisplayDateTime(selectedReport.createdAt)}
                    </Typography>
                  </Box>
                  <Chip color="success" label={selectedReport.status} />
                </Stack>
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid size={3}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    {getDocumentLabels(selectedReport).departmentLabel}
                  </Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 14, fontWeight: 800 }}>
                    {selectedReport.department || '-'}
                  </Typography>
                </Grid>
                <Grid size={3}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    {getDocumentLabels(selectedReport).actorLabel}
                  </Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 14, fontWeight: 800 }}>
                    {selectedReport.employeeName || '-'}
                  </Typography>
                </Grid>
                <Grid size={3}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>จำนวนรายการ</Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 14, fontWeight: 800 }}>
                    {selectedReport.totalItems} รายการ
                  </Typography>
                </Grid>
                <Grid size={3}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>จำนวนรวม</Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 14, fontWeight: 800 }}>
                    {selectedReport.totalQty} ชิ้น/หน่วย
                  </Typography>
                </Grid>
              </Grid>

              <AppTable
                columns={issueSlipColumns}
                maxHeight={430}
                noDataText="ไม่พบรายการสินค้าในเอกสาร"
                rowKey="lineNo"
                rows={selectedReport.items}
                showColumnFilters={false}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setSelectedDocumentNo('')}>
            ปิด
          </Button>
          <Button
            color="error"
            disabled={
              !selectedReport
              || selectedReport.documentType === 'ADJUST'
              || isReversedStatus(selectedReport.status)
            }
            startIcon={<RotateCcw size={18} />}
            variant="outlined"
            onClick={handleOpenCancelDialog}
          >
            ถอยยอด
          </Button>
          <Button startIcon={<Printer size={18} />} variant="outlined" onClick={handlePrint}>
            {selectedReport ? getDocumentLabels(selectedReport).printLabel : 'พิมพ์เอกสาร'}
          </Button>
          <Button
            disabled={isPdfLoading}
            startIcon={<FileDown size={18} />}
            variant="contained"
            onClick={handleDownloadPdf}
          >
            {isPdfLoading ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="md"
        open={isCancelDialogOpen}
        onClose={() => {
          if (!isCancelLoading) {
            setIsCancelDialogOpen(false)
          }
        }}
      >
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <RotateCcw size={22} />
          ถอยยอดเอกสาร
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              {selectedReport?.documentType === 'RECEIVE'
                ? 'กรณีรับเข้าผิด ให้ถอยยอดใบรับเข้านี้ แล้วรับเข้าใหม่ด้วยข้อมูลที่ถูกต้อง'
                : 'การถอยยอดใบเบิกจะคืนสต๊อกและคืน FIFO lot ตามรายการในเอกสารนี้'}
            </Alert>
            <Box>
              <Typography sx={{ color: '#64748b', fontSize: 13, fontWeight: 700 }}>
                เอกสาร
              </Typography>
              <Typography sx={{ color: '#0f172a', fontSize: 18, fontWeight: 900 }}>
                {selectedReport?.documentTypeLabel || '-'} #{selectedReport?.documentNo || '-'}
              </Typography>
            </Box>
            <Alert severity="info">
              ระบบจะถอยยอดทั้งเอกสารเท่านั้น หากต้องการแก้ข้อมูลให้ทำรายการใหม่หลังถอยยอดเรียบร้อย
            </Alert>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              helperText="กรุณาระบุเหตุผล เช่น ยิงผิด เลือกสินค้าผิด หรือจำนวนผิด"
              label="เหตุผลในการถอยยอด"
              value={cancelRemark}
              onChange={(event) => setCancelRemark(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            color="inherit"
            disabled={isCancelLoading}
            onClick={() => setIsCancelDialogOpen(false)}
          >
            ยกเลิก
          </Button>
          <Button
            color="error"
            disabled={!cancelRemark.trim() || isCancelLoading}
            startIcon={<RotateCcw size={18} />}
            variant="contained"
            onClick={handleCancelDocument}
          >
            {isCancelLoading ? 'กำลังถอยยอด...' : 'ยืนยันถอยยอด'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default ReportsPage
