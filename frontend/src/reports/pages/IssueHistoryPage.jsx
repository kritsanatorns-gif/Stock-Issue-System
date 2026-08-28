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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { FileBarChart, FileDown, FileSpreadsheet, FileText, Printer, RotateCcw } from 'lucide-react'
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
  { header: 'แผนกผู้เบิก', value: (row) => row.requestDepartment },
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

function getReportTypeLabel(reportType) {
  if (reportType === 'stockReceive') return 'รับเข้า'
  if (reportType === 'stockIssue') return 'เบิกสินค้า'
  if (reportType === 'stockAdjust') return 'ปรับสต็อก'
  if (reportType === 'backlog') return 'งานค้าง'
  return 'ทั้งหมด'
}

function printSummaryReport({ detailRows, endDate, reportType, startDate, summaryItems }) {
  const printWindow = window.open('', '_blank')

  if (!printWindow) return

  const rows = summaryItems.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.label)}</td>
      <td>${escapeHtml(item.value)}</td>
    </tr>
  `).join('')
  const summarySection = reportType === 'all' ? `
    <table>
      <thead><tr><th>ลำดับ</th><th>รายการ</th><th>จำนวนเอกสาร</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  ` : ''
  const detailRowsHtml = detailRows.map((row, index) => `
    <tr><td>${index + 1}</td><td>${escapeHtml(formatDisplayDateTime(row.createdAt))}</td><td>${escapeHtml(row.employeeName)}</td><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(`${Number(row.quantity).toLocaleString('th-TH')} ${row.unit}`)}</td><td>${escapeHtml(row.reason || '-')}</td></tr>
  `).join('')
  const detailSection = reportType !== 'all' ? `
    <h3>รายละเอียด${escapeHtml(getReportTypeLabel(reportType))}</h3>
    <table class="detail-table"><thead><tr><th>ลำดับ</th><th>วันเวลา</th><th>ผู้ทำรายการ</th><th>สินค้า</th><th>จำนวน</th><th>รายละเอียด</th></tr></thead><tbody>${detailRowsHtml}</tbody></table>
  ` : ''

  printWindow.document.write(`<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>รายงานสรุปการเคลื่อนไหวสต็อก</title>
        <style>
          @page { size: A4; margin: 8mm; }
          body { font-family: Tahoma, Arial, sans-serif; color: #111827; font-size: 13px; }
          .sheet { min-height: 276mm; padding: 4mm 0; box-sizing: border-box; }
          h1 { font-size: 22px; margin: 0; text-align: center; }
          h2 { font-size: 14px; font-weight: normal; margin: 4px 0 22px; text-align: center; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 18px; }
          table { border-collapse: collapse; font-size: 11px; width: 100%; }
          th, td { border: 1px solid #111; padding: 5px 6px; text-align: center; vertical-align: middle; }
          th { background: #f1f5f9; text-align: center; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          td:first-child { text-align: center; width: 5%; }
          td:last-child { text-align: center; width: 28%; font-weight: bold; }
          .detail-table th:nth-child(1) { width: 5%; }
          .detail-table th:nth-child(2) { width: 18%; }
          .detail-table th:nth-child(3) { width: 12%; }
          .detail-table th:nth-child(4) { width: 30%; }
          .detail-table th:nth-child(5) { width: 9%; }
          .detail-table td:nth-child(2) { white-space: nowrap; }
          .footer { break-inside: avoid; display: flex; justify-content: space-between; margin-top: 24px; page-break-inside: avoid; text-align: center; }
          .sign { min-width: 220px; border-top: 1px solid #111; padding-top: 8px; }
        </style>
      </head>
      <body>
        <section class="sheet">
          <h1>รายงานสรุปการเคลื่อนไหวสต็อก</h1>
          <h2>ระบบเบิกสินค้าสำนักงาน</h2>
          <div class="meta">
            <span>ช่วงวันที่ ${escapeHtml(dayjs(startDate).format('DD/MM/YYYY'))} ถึง ${escapeHtml(dayjs(endDate).format('DD/MM/YYYY'))}</span>
            <span>ประเภท: ${escapeHtml(getReportTypeLabel(reportType))}</span>
          </div>
          ${summarySection}
          ${detailSection}
          <div class="footer">
            <div class="sign">ผู้จัดทำรายงาน</div>
            <div class="sign">ผู้ตรวจสอบ</div>
          </div>
        </section>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
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
      poInvoiceNo: getTextValue(report.poInvoiceNo, report.PoInvoiceNo),
      documentType: report.documentType ?? 'ISSUE',
      documentTypeLabel: report.documentTypeLabel ?? 'เบิกสินค้า',
      employeeDepartment: report.employeeDepartment || 'HR',
      employeeName: report.employeeName,
      requestDepartment: (report.documentType ?? 'ISSUE') === 'ISSUE'
        ? cleanReportDepartment(report.department)
        : '-',
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
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)

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
  const reportDetailRows = useMemo(() => {
    if (reportType === 'all') return []

    if (reportType === 'backlog') {
      return backlogRows.map((row) => ({
        createdAt: row.requestedAt,
        employeeName: row.requesterName,
        productCode: row.productCode,
        productName: row.productName,
        quantity: row.backlogQty,
        reason: row.hrRemark || 'รายการค้าง',
        rowKey: `${row.requestNo}-${row.detailId}`,
        unit: row.unit,
      }))
    }

    return filteredReports.flatMap((report) => (report.items ?? []).map((item, index) => ({
      createdAt: report.createdAt,
      employeeName: report.employeeName ?? '-',
      productCode: item.code ?? item.Code ?? '-',
      productName: item.productName ?? item.ProductName ?? '-',
      quantity: Number(item.quantity ?? item.Quantity ?? 0),
      reason: report.documentType === 'ADJUST'
        ? (report.department ?? report.Department ?? '-')
        : (report.poInvoiceNo ?? report.PoInvoiceNo ?? report.department ?? report.Department ?? '-'),
      rowKey: `${report.documentNo}-${item.detailId ?? item.DetailId ?? index}`,
      unit: item.unit ?? item.Unit ?? '',
    })))
  }, [backlogRows, filteredReports, reportType])

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

    const documentCount = documentRows.length
    const receiveCount = documentRows.filter(
      (report) => report.documentType === 'RECEIVE' && !isReversedStatus(report.status),
    ).length
    const issueCount = documentRows.filter(
      (report) => report.documentType === 'ISSUE' && !isReversedStatus(report.status),
    ).length
    const adjustCount = documentRows.filter(
      (report) => report.documentType === 'ADJUST' && !isReversedStatus(report.status),
    ).length
    const reverseCount = documentRows.filter((report) => isReversedStatus(report.status)).length

    return [
      { label: 'งานทั้งหมด', value: documentCount.toLocaleString('th-TH') },
      { label: 'ใบเบิก', value: issueCount.toLocaleString('th-TH') },
      { label: 'ใบรับเข้า', value: receiveCount.toLocaleString('th-TH') },
      { label: 'ใบถอยยอด', value: reverseCount.toLocaleString('th-TH') },
      { label: 'ใบปรับสต็อก', value: adjustCount.toLocaleString('th-TH') },
    ]
  }, [backlogRows, documentRows, reportType])

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

  const handleExportSummary = () => {
    const reportContext = {
      period: `ช่วงวันที่ ${startDate ? dayjs(startDate).format('DD/MM/YYYY') : '-'} ถึง ${endDate ? dayjs(endDate).format('DD/MM/YYYY') : '-'}`,
      type: `ประเภท: ${getReportTypeLabel(reportType)}`,
    }

    if (reportType === 'all') {
      exportRowsToExcel(
        documentRows,
        [
          { header: 'วันเวลา', value: (row) => row.date },
          { header: 'ประเภท', value: (row) => row.documentTypeLabel },
          { header: 'ผู้ทำรายการ', value: (row) => row.employeeName },
          { header: 'เลขที่เอกสาร', value: (row) => row.documentNo },
        ],
        `stock-report-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
        { reportContext },
      )
      return
    }

    exportRowsToExcel(
      reportDetailRows,
      [
        { header: 'วันเวลา', value: (row) => formatDisplayDateTime(row.createdAt) },
        { header: 'ผู้ทำรายการ', value: (row) => row.employeeName },
        { header: 'สินค้า', value: (row) => row.productName },
        { header: 'จำนวน', value: (row) => `${row.quantity} ${row.unit}` },
        { header: 'รายละเอียด', value: (row) => row.reason || '-' },
      ],
      `${reportType}-report-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
      { reportContext },
    )
  }

  const handleDownloadSummaryPdf = async () => {
    const reportElement = document.getElementById('summary-report-sheet')

    if (!reportElement) return

    const [{ jsPDF }, html2canvasModule] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ])
    const html2canvas = html2canvasModule.default
    const canvas = await html2canvas(reportElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pdfWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')
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

    pdf.save(`stock-report-${dayjs().format('YYYYMMDD-HHmm')}.pdf`)
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
            onOpenSummary={() => setIsSummaryOpen(true)}
            onReportTypeChange={setReportType}
            onRunReport={handleRunReport}
            onStartDateChange={setStartDate}
          />
        </CardContent>
      </Card>

      <Box>
        <Typography sx={{ color: '#334155', fontSize: 15, fontWeight: 900, mb: 1 }}>
          สรุปจำนวนงานในช่วงวันที่และประเภทที่เลือก
        </Typography>
        <Grid container spacing={2}>
          {summaryItems.map((item, index) => (
            <Grid key={item.label} size={{ xs: 12, sm: 6, md: 2.4 }}>
              <ReportSummaryCard
                {...item}
                color={['#2563eb', '#7c3aed', '#16a34a', '#ef4444', '#f59e0b'][index]}
              />
            </Grid>
          ))}
        </Grid>
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

      <Dialog fullWidth maxWidth="lg" open={isSummaryOpen} onClose={() => setIsSummaryOpen(false)}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1.25 }}>
          <FileBarChart size={22} />
          รายงานสรุปการเคลื่อนไหวสต็อก
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#e2e8f0', p: { xs: 1.5, sm: 3 } }}>
          <Box
            id="summary-report-sheet"
            sx={{
              bgcolor: '#ffffff',
              boxShadow: '0 3px 12px rgba(15, 23, 42, 0.18)',
              minHeight: 620,
              mx: 'auto',
              maxWidth: 794,
              p: { xs: 2, sm: 4 },
              width: '100%',
            }}
          >
            <Typography align="center" sx={{ fontSize: 24, fontWeight: 900 }}>
              รายงานสรุปการเคลื่อนไหวสต็อก
            </Typography>
            <Typography align="center" sx={{ fontSize: 14, mb: 3 }}>ระบบเบิกสินค้าสำนักงาน</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between', mb: 2.5 }}>
              <Typography sx={{ fontSize: 14 }}>
                ช่วงวันที่ {startDate ? dayjs(startDate).format('DD/MM/YYYY') : '-'} ถึง {endDate ? dayjs(endDate).format('DD/MM/YYYY') : '-'}
              </Typography>
              <Typography sx={{ fontSize: 14 }}>ประเภท: {getReportTypeLabel(reportType)}</Typography>
            </Box>
            {reportType === 'all' ? (
              <Table size="small" sx={{ border: '1px solid #0f172a', tableLayout: 'fixed', '& .MuiTableCell-root': { borderBottom: '1px solid #0f172a', borderRight: '1px solid #0f172a', textAlign: 'center' }, '& .MuiTableCell-root:last-child': { borderRight: 0 } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                    <TableCell align="center" sx={{ fontWeight: 900, width: 80 }}>ลำดับ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 900 }}>รายการ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 900, width: 180 }}>จำนวนเอกสาร</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summaryItems.map((item, index) => (
                    <TableRow key={item.label}>
                      <TableCell align="center">{index + 1}</TableCell>
                      <TableCell>{item.label}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>{item.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 900, mb: 1 }}>รายละเอียด{getReportTypeLabel(reportType)}</Typography>
                <Table size="small" sx={{ border: '1px solid #0f172a', tableLayout: 'fixed', '& .MuiTableCell-root': { borderBottom: '1px solid #0f172a', borderRight: '1px solid #0f172a', fontSize: 12, textAlign: 'center' }, '& .MuiTableCell-root:last-child': { borderRight: 0 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                      <TableCell align="center" sx={{ fontWeight: 900, width: 128, whiteSpace: 'nowrap' }}>วันเวลา</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900, width: 150 }}>ผู้ทำรายการ</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900, width: 250 }}>สินค้า</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900, width: 90 }}>จำนวน</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900 }}>รายละเอียด</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportDetailRows.map((row) => (
                      <TableRow key={row.rowKey}>
                        <TableCell align="center" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDisplayDateTime(row.createdAt)}</TableCell>
                        <TableCell align="center">{row.employeeName}</TableCell>
                        <TableCell align="center">{row.productName}</TableCell>
                        <TableCell align="center" sx={{ color: '#0f172a', fontWeight: 900 }}>
                          {row.quantity.toLocaleString('th-TH')} {row.unit}
                        </TableCell>
                        <TableCell align="center">{row.reason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 8, justifyContent: 'flex-end', mt: 12 }}>
              <Box sx={{ borderTop: '1px solid #0f172a', pt: 1, textAlign: 'center', width: 190 }}>ผู้จัดทำรายงาน</Box>
              <Box sx={{ borderTop: '1px solid #0f172a', pt: 1, textAlign: 'center', width: 190 }}>ผู้ตรวจสอบ</Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<FileSpreadsheet size={17} />} variant="outlined" onClick={handleExportSummary}>
            ดาวน์โหลด Excel
          </Button>
          <Button startIcon={<FileDown size={17} />} variant="outlined" onClick={handleDownloadSummaryPdf}>
            ดาวน์โหลด PDF
          </Button>
          <Button startIcon={<Printer size={17} />} variant="outlined" onClick={() => printSummaryReport({ detailRows: reportDetailRows, endDate, reportType, startDate, summaryItems })}>
            พิมพ์รายงาน
          </Button>
          <Button onClick={() => setIsSummaryOpen(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

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
                {selectedReport.documentType === 'RECEIVE' && (
                  <Grid size={3}>
                    <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>เลขที่ PO / Invoice</Typography>
                    <Typography sx={{ color: '#0f172a', fontSize: 14, fontWeight: 800 }}>
                      {selectedReport.poInvoiceNo || '-'}
                    </Typography>
                  </Grid>
                )}
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
