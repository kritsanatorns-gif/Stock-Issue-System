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
  ListSubheader,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { AlertTriangle, Building2, ChevronDown, ChevronRight, Clock, Download, FileText, Package, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getPurchasesByProduct, getPurchasesBySupplier, getPurchaseTrend, getRequisitions, getStockIssues, getSupplierPurchaseItems, getVatSetting, updateVatSetting } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { getDateSortValue, getElapsedDuration, getIdSortValue, toThailandDate } from '../../utils/dateUtils'
import { exportDepartmentCostSummaryToExcel, exportDepartmentIssueToExcel, exportDivisionCostToExcel, exportProductIssueByCategoryToExcel, exportProductPurchaseIssueToExcel, exportPurchaseSummaryToExcel, exportRowsToExcel } from '../../utils/excelUtils'
import { exportDepartmentCostSummaryToPdf, exportDepartmentIssueToPdf, exportDivisionCostToPdf, exportProductIssueByCategoryToPdf, exportProductIssueHistoryToPdf, exportProductPurchaseIssueToPdf, exportPurchaseHistoryBySupplierToPdf, exportPurchaseSummaryToPdf, exportTableToPdf } from '../../utils/pdfUtils'

const shortMonthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const palette = ['#2563eb', '#22b8cf', '#f97316', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b', '#f59e0b']

const formatReportDate = (value) => {
  const date = toThailandDate(value)
  return date ? `${date.format('DD/MM/')}${date.year() + 543}` : '-'
}

const formatReportDateTime = (value) => {
  const date = toThailandDate(value)
  return date ? `${date.format('DD/MM/')}${date.year() + 543} ${date.format('HH:mm')}` : '-'
}

const reportGroups = [
  {
    label: 'รายงานวิเคราะห์การขาย (เบิก)',
    categories: [
      { label: 'สรุปยอดขาย', items: [{ label: 'แยกตามลูกค้า', value: 'issue' }, { label: 'แยกตามหมวดสินค้า', value: 'product' }] },
      { label: 'ประวัติการขาย', items: [{ label: 'แยกตามลูกค้า', value: 'department-history' }, { label: 'แยกตามสินค้า', value: 'product-history' }] },
      { label: 'จัดลำดับยอดขาย', items: [{ label: 'ตามมูลค่า', value: 'issue-rank-value' }, { label: 'ตามปริมาณ', value: 'issue-rank-qty' }, { label: 'ตามลูกค้า / มูลค่า', value: 'issue-customer-rank-value' }, { label: 'ตามลูกค้า / ปริมาณ', value: 'issue-customer-rank-qty' }] },
      { label: 'ค่าใช้จ่าย', items: [{ label: 'รายงานค่าใช้จ่ายรวม', value: 'division-cost' }] },
    ],
  },
  {
    label: 'รายงานวิเคราะห์การซื้อ (รับเข้า)',
    categories: [
      { label: 'สรุปยอดซื้อ', items: [{ label: 'แยกตามผู้จำหน่าย', value: 'purchase' }, { label: 'แยกตามหมวดสินค้า', value: 'purchase-category' }] },
      { label: 'ประวัติการซื้อ', items: [{ label: 'แยกตามผู้จำหน่าย', value: 'purchase-history' }, { label: 'แยกตามสินค้า', value: 'purchase-product-history' }] },
      { label: 'จัดลำดับยอดซื้อ', items: [{ label: 'ตามมูลค่า', value: 'purchase-rank-value' }, { label: 'ตามปริมาณ', value: 'purchase-rank-qty' }, { label: 'จากบิลผู้จำหน่าย', value: 'purchase-rank-invoice' }] },
    ],
  },
]

const reportModes = reportGroups.flatMap((group) => group.categories.flatMap((category) => category.items))

const exportColumns = [
  { header: 'วันที่', value: (row) => row.dateName },
  { header: 'แผนก', value: (row) => row.department },
  { header: 'รหัสสินค้า', value: (row) => row.productCode },
  { header: 'ชื่อสินค้า', value: (row) => row.productName },
  { header: 'จำนวนสินค้าที่ถูกเบิก', value: (row) => row.totalQty },
  { header: 'มูลค่าต้นทุน FIFO ที่เบิก', value: (row) => row.totalCost },
  { header: 'จำนวนใบเบิก', value: (row) => row.documentCount },
]

const backlogExportColumns = [
  { header: 'วันที่ขอเบิก', value: (row) => row.requestDateName },
  { header: 'เลขที่คำขอ', value: (row) => row.requestNo },
  { header: 'ระยะเวลาค้าง', value: (row) => row.backlogDurationLabel },
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
  { header: 'หมายเหตุ HR', value: (row) => row.hrRemark },
]

const purchaseExportColumns = [
  { header: 'ผู้ขาย', value: (row) => row.supplierName },
  { header: 'ข้อมูล', value: (row) => row.documentCount },
  { header: 'จำนวนรายการสินค้า', value: (row) => row.itemCount },
  { header: 'ข้อมูล', value: (row) => row.totalQty },
  { header: 'ยอดซื้อรวม', value: (row) => row.totalPurchase },
]

const purchaseHistoryExportColumns = [
  { header: 'ผู้ขาย', value: (row) => row.supplierName },
  { header: 'วันที่รับเข้า', value: (row) => formatReportDate(row.receivedAt) },
  { header: 'เลขที่ Invoice', value: (row) => row.poInvoiceNo || '-' },
  { header: 'รหัสสินค้า', value: (row) => row.productCode },
  { header: 'ชื่อสินค้า', value: (row) => row.productName },
  { header: 'จำนวนรับเข้า', value: (row) => row.quantity },
  { header: 'หน่วย', value: (row) => row.unit || '-' },
  { header: 'ต้นทุน/หน่วย', value: (row) => row.unitCost },
  { header: 'ราคา VAT/หน่วย', value: (row) => row.vatUnitCost },
  { header: 'ยอดซื้อรวม', value: (row) => row.totalPurchase },
]

const productRankingExportColumns = [
  { header: 'อันดับ', value: (row) => row.rank },
  { header: 'รหัสสินค้า', value: (row) => row.productCode },
  { header: 'สินค้า', value: (row) => row.label },
  { header: 'ข้อมูล', value: (row) => row.totalQty },
  { header: 'มูลค่าต้นทุน FIFO', value: (row) => row.totalCost },
  { header: 'ข้อมูล', value: (row) => row.documentCount },
]

const productSummaryExportColumns = [
  { header: 'รหัสสินค้า', value: (row) => row.productCode },
  { header: 'ชื่อสินค้า', value: (row) => row.productName },
  { header: 'ข้อมูล', value: (row) => row.unit || '-' },
  { header: 'ข้อมูล', value: (row) => row.purchaseQty },
  { header: 'ข้อมูล', value: (row) => row.purchaseAmount },
  { header: 'ข้อมูล', value: (row) => row.issueQty },
  { header: 'ข้อมูล FIFO ข้อมูล', value: (row) => row.issueAmount },
]

const divisionCostColumns = [
  { key: 'division', label: 'ข้อมูล', minWidth: 240 },
  { key: 'totalQty', label: 'จำนวนที่เบิก', width: 150, align: 'center' },
  {
    key: 'totalCost', label: 'ข้อมูล', width: 190, align: 'right',
    render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
]

const divisionCostDetailColumns = [
  { key: 'department', label: 'ข้อมูล', minWidth: 240 },
  { key: 'totalQty', label: 'จำนวนที่เบิก', width: 150, align: 'center' },
  {
    key: 'totalCost', label: 'ข้อมูล FIFO', width: 190, align: 'right',
    render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  { key: 'documentCount', label: 'จำนวนใบเบิก', width: 140, align: 'center' },
]

const departmentCostSummaryColumns = [
  { key: 'label', label: 'แผนก', minWidth: 260 },
  { key: 'totalQty', label: 'จำนวนที่เบิก', width: 150, align: 'center' },
  { key: 'totalCost', label: 'ค่าใช้จ่าย', width: 190, align: 'right', render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
]

const purchaseColumns = [
  { key: 'supplierName', label: 'ผู้ขาย', minWidth: 260 },
  { key: 'documentCount', label: 'เอกสารรับเข้า', width: 160, align: 'center' },
  { key: 'itemCount', label: 'รายการสินค้า', width: 160, align: 'center' },
  { key: 'totalQty', label: 'จำนวนรับเข้ารวม', width: 180, align: 'center' },
  {
    key: 'totalPurchase',
    label: 'ยอดซื้อรวม',
    width: 180,
    align: 'right',
    render: (row) => Number(row.totalPurchase ?? 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  },
]

const supplierPurchaseDetailColumns = [
  { key: 'receivedAt', label: 'วันที่รับเข้า', width: 150, value: (row) => formatReportDate(row.receivedAt), sortValue: (row) => getDateSortValue(row.receivedAt) },
  { key: 'poInvoiceNo', label: 'เลขที่ PO / Invoice', width: 170, value: (row) => row.poInvoiceNo || '-' },
  { key: 'productCode', label: 'รหัสสินค้า', width: 140 },
  { key: 'productName', label: 'สินค้า', minWidth: 220 },
  { key: 'quantity', label: 'จำนวนรับเข้า', width: 120, align: 'center', render: (row) => Number(row.quantity ?? 0).toLocaleString('th-TH') },
  { key: 'unit', label: 'หน่วย', width: 90, align: 'center', render: (row) => row.unit || '-' },
  {
    key: 'unitCost',
    label: 'ต้นทุน/หน่วย',
    width: 150,
    align: 'right',
    render: (row) => Number(row.unitCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    key: 'vatUnitCost',
    label: 'ราคา VAT/หน่วย',
    width: 150,
    align: 'right',
    render: (row) => Number(row.vatUnitCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    key: 'totalPurchase',
    label: 'ยอดซื้อรวม',
    width: 160,
    align: 'right',
    render: (row) => Number(row.totalPurchase ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
]

const departmentIssueColumns = [
  { key: 'label', label: 'แผนก', minWidth: 220 },
  { key: 'totalQty', label: 'จำนวนที่เบิก', width: 150, align: 'center' },
  {
    key: 'totalCost',
    label: 'มูลค่าต้นทุน FIFO',
    width: 190,
    align: 'right',
    render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  { key: 'documentCount', label: 'จำนวนใบเบิก', width: 140, align: 'center' },
]

const departmentIssueDetailColumns = [
  { key: 'createdAt', label: 'วันที่เบิก', width: 150, value: (row) => formatReportDate(row.createdAt), sortValue: (row) => getDateSortValue(row.createdAt) },
  { key: 'documentNo', label: 'เลขที่เอกสาร', width: 190 },
  { key: 'productCode', label: 'รหัสสินค้า', width: 190 },
  { key: 'productName', label: 'สินค้า', width: 340 },
  { key: 'quantity', label: 'จำนวนเบิก', width: 115, align: 'center', render: (row) => Number(row.quantity ?? 0).toLocaleString('th-TH') },
  { key: 'unit', label: 'หน่วย', width: 90, align: 'center', render: (row) => row.unit || '-' },
  {
    key: 'totalCost',
    label: 'ต้นทุน FIFO',
    width: 180,
    align: 'right',
    render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
]

const productRankingColumns = [
  { key: 'rank', label: 'อันดับ', width: 90, align: 'center', searchable: false },
  { key: 'productCode', label: 'รหัสสินค้า', width: 160 },
  { key: 'label', label: 'สินค้า', minWidth: 260 },
  { key: 'totalQty', label: 'จำนวนที่เบิกรวม', width: 160, align: 'center' },
  {
    key: 'totalCost',
    label: 'มูลค่าต้นทุน FIFO',
    width: 190,
    align: 'right',
    render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  { key: 'documentCount', label: 'จำนวนใบเบิก', width: 140, align: 'center' },
]

const productSummaryColumns = [
  { key: 'category', label: 'ข้อมูล', width: 160 },
  { key: 'productCode', label: 'รหัสสินค้า', width: 160 },
  { key: 'productName', label: 'ข้อมูล', minWidth: 260, bodyAlign: 'center' },
  { key: 'unit', label: 'ข้อมูล', width: 90, align: 'center', render: (row) => row.unit || '-' },
  { key: 'totalQty', label: 'ข้อมูล', width: 120, align: 'center', render: (row) => Number(row.totalQty ?? 0).toLocaleString('th-TH') },
  { key: 'totalCost', label: 'ข้อมูล FIFO ข้อมูล', width: 175, align: 'right', render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
]

const productHistoryColumns = [
  { key: 'productCode', label: 'รหัสสินค้า', width: 170 },
  { key: 'productName', label: 'ข้อมูล', minWidth: 280, bodyAlign: 'center' },
  {
    key: 'issueDocumentNos',
    label: 'ข้อมูล',
    minWidth: 190,
    align: 'center',
    render: (row) => (
      <Button size="small" variant="outlined" onClick={() => row.onShowIssueDocuments?.(row)}>
        ข้อมูล ({row.documentCount})
      </Button>
    ),
  },
  { key: 'totalQty', label: 'ข้อมูล', width: 140, align: 'center', render: (row) => Number(row.totalQty ?? 0).toLocaleString('th-TH') },
  { key: 'unit', label: 'ข้อมูล', width: 90, align: 'center', render: (row) => row.unit || '-' },
  { key: 'totalCost', label: 'ข้อมูล FIFO ข้อมูล', width: 180, align: 'right', render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  { key: 'documentCount', label: 'ข้อมูล', width: 125, align: 'center' },
]

const productHistoryDetailColumns = [
  { key: 'createdAt', label: 'ข้อมูล', width: 130, value: (row) => formatReportDate(row.createdAt), sortValue: (row) => getDateSortValue(row.createdAt) },
  { key: 'documentNo', label: 'ข้อมูล', width: 160 },
  { key: 'department', label: 'ข้อมูล', width: 170 },
  { key: 'quantity', label: 'ข้อมูล', width: 105, align: 'center', render: (row) => Number(row.quantity ?? 0).toLocaleString('th-TH') },
  { key: 'unit', label: 'ข้อมูล', width: 85, align: 'center', render: (row) => row.unit || '-' },
  { key: 'totalCost', label: 'ข้อมูล', width: 150, align: 'right', render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
]

const departmentHistoryColumns = [
  { key: 'department', label: 'ลูกค้า (แผนก)', minWidth: 260, bodyAlign: 'center' },
  {
    key: 'issueDocumentNos',
    label: 'เลขที่ใบเบิก',
    minWidth: 210,
    align: 'center',
    render: (row) => (
      <Button size="small" variant="outlined" onClick={() => row.onShowDepartmentIssueDetails?.(row)}>
        ดูเลขที่ใบเบิก ({row.documentCount})
      </Button>
    ),
  },
  { key: 'totalQty', label: 'จำนวนเบิกรวม', width: 140, align: 'center', render: (row) => Number(row.totalQty ?? 0).toLocaleString('th-TH') },
  { key: 'totalCost', label: 'ต้นทุน FIFO รวม', width: 180, align: 'right', render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  { key: 'documentCount', label: 'จำนวนใบเบิก', width: 125, align: 'center' },
]

const backlogColumns = [
  { key: 'requestDateName', label: 'วันที่ขอเบิก', width: 140, value: (row) => row.requestDateName, sortValue: (row) => getDateSortValue(row.requestedAt) },
  { key: 'requestNo', label: 'เลขที่คำขอ', width: 130 },
  { key: 'backlogDurationLabel', label: 'ค้างมาแล้ว', width: 125, align: 'center', value: (row) => row.backlogDurationLabel, sortValue: (row) => row.backlogDays, render: (row) => row.backlogDurationLabel },
  {
    key: 'followUpText',
    label: 'ข้อมูล',
    width: 130,
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
  { key: 'department', label: 'แผนก', width: 120 },
  { key: 'requesterName', label: 'ผู้ขอเบิก', width: 180 },
  { key: 'productCode', label: 'รหัสสินค้า', width: 170 },
  { key: 'productName', label: 'ชื่อสินค้า', width: 260 },
  { key: 'requestQty', label: 'จำนวนที่ขอ', width: 115, align: 'center' },
  { key: 'fulfilledQty', label: 'จ่ายแล้ว', width: 105, align: 'center' },
  { key: 'backlogQty', label: 'ยังค้าง', width: 105, align: 'center' },
  { key: 'availableQty', label: 'คงเหลือปัจจุบัน', width: 140, align: 'center' },
  { key: 'unit', label: 'หน่วย', width: 90, align: 'center' },
  { key: 'hrRemark', label: 'หมายเหตุ HR', width: 260, wrap: true, value: (row) => row.hrRemark || '-', render: (row) => row.hrRemark || '-' },
]

const backlogDepartmentColumns = [
  { key: 'department', label: 'แผนก', width: 180 },
  { key: 'backlogQty', label: 'จำนวนค้าง', width: 120, align: 'center' },
  { key: 'documentCount', label: 'จำนวนใบค้าง', width: 130, align: 'center' },
  { key: 'oldestBacklogDays', label: 'ค้างนานสุด', width: 130, align: 'center', render: (row) => `${row.oldestBacklogDays} วัน` },
]

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

function flattenBacklogRows(requisitions) {
  return requisitions.flatMap((requisition) =>
    (requisition.items ?? [])
      .filter((item) => Number(item.backlogQty ?? 0) > 0)
      .map((item) => {
        const requestedAt = requisition.createdAt
        const backlogDuration = getElapsedDuration(requestedAt)
        const backlogDays = backlogDuration.days
        const followUp = getBacklogFollowUp(backlogDays)

        return {
          availableQty: Number(item.availableQty ?? 0),
          backlogDurationLabel: backlogDuration.label,
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
          requestDateName: formatReportDateTime(requestedAt),
          requestedAt,
          requesterName: requisition.requesterName ?? requisition.employeeName ?? '-',
          requestNo: requisition.requestNo,
          requestQty: Number(item.quantity ?? 0),
          unit: item.unit ?? '',
        }
      }),
  )
}

function buildBacklogDepartmentRows(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    if (!groups.has(row.department)) {
      groups.set(row.department, {
        department: row.department,
        documentNos: new Set(),
        backlogQty: 0,
        oldestBacklogDays: 0,
      })
    }

    const group = groups.get(row.department)
    group.backlogQty += row.backlogQty
    group.documentNos.add(row.requestNo)
    group.oldestBacklogDays = Math.max(group.oldestBacklogDays, row.backlogDays)
  })

  return [...groups.values()]
    .map((row) => ({
      ...row,
      documentCount: row.documentNos.size,
      documentNos: undefined,
    }))
    .sort((first, second) => second.backlogQty - first.backlogQty)
}

function isReportableIssue(report) {
  const status = String(report.status ?? '').trim().toLowerCase()

  if (!status) {
    return true
  }

  return status.includes('บางส่วน')
    || (!status.includes('ถอย')
    && !status.includes('ข้อมูล')
    && !status.includes('cancel')
    && !status.includes('ข้อมูล')
    && !status.includes('adjust'))
}

function flattenIssueRows(reports) {
  return reports.filter(isReportableIssue).flatMap((report) =>
    (report.items ?? []).map((item) => ({
      createdAt: report.createdAt,
      department: cleanReportDepartment(report.department),
      division: String(report.division ?? '').trim() || 'ข้อมูล',
      category: String(item.category ?? item.Category ?? '').trim() || 'ข้อมูล',
      documentNo: report.documentNo,
      productCode: item.code,
      productName: item.productName,
      quantity: Number(item.quantity ?? 0),
      totalVat: Number(item.totalVat ?? 0),
      totalCost: Number(item.totalCost ?? 0),
      unit: item.unit ?? '',
    })),
  )
}

function summarizeByDayDepartmentProduct(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    const date = dayjs(row.createdAt)
    const dateKey = date.format('YYYY-MM-DD')
    const key = [dateKey, row.department, row.productCode, row.productName].join('|')

    if (!groups.has(key)) {
      groups.set(key, {
        date: dateKey,
        dateName: formatReportDate(dateKey),
        department: row.department,
        documentNos: new Set(),
        productCode: row.productCode,
        productName: row.productName,
        totalQty: 0,
        totalCost: 0,
      })
    }

    const group = groups.get(key)

    group.totalQty += row.quantity
    group.totalCost += row.totalCost
    group.documentNos.add(row.documentNo)
  })

  return [...groups.values()]
    .map((group) => ({
      ...group,
      documentCount: group.documentNos.size,
      documentNos: undefined,
    }))
    .sort((first, second) =>
      second.date.localeCompare(first.date)
      || first.department.localeCompare(second.department, 'th')
      || first.productName.localeCompare(second.productName, 'th'),
    )
}

function buildDepartmentRows(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    if (!groups.has(row.department)) {
      groups.set(row.department, { documentNos: new Set(), totalCost: 0, totalQty: 0 })
    }

    const group = groups.get(row.department)
    group.totalQty += row.quantity
    group.totalCost += row.totalCost
    group.documentNos.add(row.documentNo)
  })

  return [...groups.entries()]
    .map(([department, group], index) => ({
      color: palette[index % palette.length],
      label: department,
      documentCount: group.documentNos.size,
      totalCost: group.totalCost,
      totalQty: group.totalQty,
    }))
    .sort((first, second) => second.totalQty - first.totalQty)
}

function buildProductRows(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    const key = `${row.productCode}|${row.productName}`

    if (!groups.has(key)) {
      groups.set(key, {
        category: row.category,
        documentNos: new Set(),
        label: row.productName || row.productCode,
        productCode: row.productCode,
        totalCost: 0,
        totalQty: 0,
      })
    }

    const group = groups.get(key)
    group.totalQty += row.quantity
    group.totalCost += row.totalCost
    group.documentNos.add(row.documentNo)
  })

  return [...groups.values()]
    .sort((first, second) => second.totalQty - first.totalQty)
    .map((row, index) => ({
      ...row,
      color: palette[index % palette.length],
      documentCount: row.documentNos.size,
      documentNos: undefined,
      rank: index + 1,
    }))
}

function buildProductSummaryRows(issueRows, purchases) {
  const groups = new Map()
  const get = (code, name, unit) => {
    const key = `${code}|${name}`
    if (!groups.has(key)) groups.set(key, { productCode: code, productName: name || code, unit: unit || '', purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0 })
    return groups.get(key)
  }
  purchases.forEach((row) => {
    const item = get(row.productCode, row.productName, row.unit)
    item.purchaseQty += Number(row.purchaseQty ?? 0)
    item.purchaseAmount += Number(row.purchaseAmount ?? 0)
  })
  issueRows.forEach((row) => {
    const item = get(row.productCode, row.productName, row.unit)
    item.issueQty += Number(row.quantity ?? 0)
    item.issueAmount += Number(row.totalCost ?? 0)
  })
  return [...groups.values()].sort((left, right) => left.productName.localeCompare(right.productName, 'th') || left.productCode.localeCompare(right.productCode, 'th'))
}

function buildDepartmentIssueGroups(rows) {
  const departments = new Map()

  rows.forEach((row) => {
    const department = String(row.department ?? '').trim() || 'ข้อมูล'
    const products = departments.get(department) ?? new Map()
    const key = `${row.productCode}|${row.productName}`
    const product = products.get(key) ?? { productCode: row.productCode, productName: row.productName || row.productCode, totalCost: 0, totalQty: 0, unit: row.unit ?? '' }

    product.totalQty += Number(row.quantity ?? 0)
    product.totalCost += Number(row.totalCost ?? 0)
    if (!product.unit && row.unit) product.unit = row.unit
    products.set(key, product)
    departments.set(department, products)
  })

  return [...departments.entries()]
    .map(([department, products]) => ({
      department,
      products: [...products.values()].sort((first, second) => first.productName.localeCompare(second.productName, 'th') || first.productCode.localeCompare(second.productCode, 'th')),
    }))
    .sort((first, second) => first.department.localeCompare(second.department, 'th'))
}

function buildProductHistoryGroups(rows) {
  const products = new Map()
  rows.forEach((row) => {
    const key = `${row.productCode}|${row.productName}`
    const product = products.get(key) ?? { productCode: row.productCode, productName: row.productName || row.productCode, unit: row.unit || '', totalQty: 0, totalCost: 0, documentNos: new Set(), rows: [] }
    product.totalQty += Number(row.quantity ?? 0)
    product.totalCost += Number(row.totalCost ?? 0)
    product.documentNos.add(row.documentNo)
    product.rows.push(row)
    products.set(key, product)
  })
  return [...products.values()].map((product) => ({
    ...product,
    documentCount: product.documentNos.size,
    issueDocumentNos: [...product.documentNos].filter(Boolean).join(', ') || '-',
    rows: product.rows.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
  })).sort((left, right) => left.productName.localeCompare(right.productName, 'th') || left.productCode.localeCompare(right.productCode, 'th'))
}

function buildDepartmentHistoryGroups(rows) {
  const departments = new Map()
  rows.forEach((row) => {
    const department = String(row.department ?? '').trim() || 'ข้อมูล'
    const group = departments.get(department) ?? { department, totalQty: 0, totalCost: 0, documentNos: new Set(), rows: [] }
    group.totalQty += Number(row.quantity ?? 0)
    group.totalCost += Number(row.totalCost ?? 0)
    group.documentNos.add(row.documentNo)
    group.rows.push(row)
    departments.set(department, group)
  })
  return [...departments.values()].map((group) => ({
    ...group,
    documentCount: group.documentNos.size,
    issueDocumentNos: [...group.documentNos].filter(Boolean).join(', ') || '-',
    rows: group.rows.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
  })).sort((left, right) => left.department.localeCompare(right.department, 'th'))
}

function buildProductCategoryGroups(rows) {
  const categories = new Map()

  rows.forEach((row) => {
    const category = String(row.category ?? '').trim() || 'ข้อมูล'
    const products = categories.get(category) ?? new Map()
    const key = `${row.productCode}|${row.productName}`
    const product = products.get(key) ?? { productCode: row.productCode, productName: row.productName || row.productCode, totalCost: 0, totalQty: 0, unit: row.unit ?? '' }

    product.totalQty += Number(row.quantity ?? 0)
    product.totalCost += Number(row.totalCost ?? 0)
    if (!product.unit && row.unit) product.unit = row.unit
    products.set(key, product)
    categories.set(category, products)
  })

  return [...categories.entries()]
    .map(([category, products]) => ({
      category,
      products: [...products.values()].sort((first, second) => first.productName.localeCompare(second.productName, 'th') || first.productCode.localeCompare(second.productCode, 'th')),
    }))
    .sort((first, second) => first.category.localeCompare(second.category, 'th'))
}

function buildDivisionCostRows(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    if (!groups.has(row.division)) {
      groups.set(row.division, { departments: new Map(), totalCost: 0, totalQty: 0 })
    }

    const group = groups.get(row.division)
    const department = group.departments.get(row.department) ?? { department: row.department, documentNos: new Set(), totalCost: 0, totalQty: 0 }
    department.totalCost += row.totalCost
    department.totalQty += row.quantity
    department.documentNos.add(row.documentNo)
    group.departments.set(row.department, department)
    group.totalCost += row.totalCost
    group.totalQty += row.quantity
  })

  return [...groups.entries()]
    .map(([division, group]) => ({
      division,
      totalCost: group.totalCost,
      totalQty: group.totalQty,
      departments: [...group.departments.values()].map((department) => ({ ...department, documentCount: department.documentNos.size })),
    }))
    .sort((left, right) => right.totalCost - left.totalCost)
}

function buildTimeTrendRows(rows, reportPeriod, selectedYear) {
  if (reportPeriod === 'daily') {
    const startDate = dayjs().subtract(6, 'day')
    const trendRows = Array.from({ length: 7 }, (_, index) => {
      const date = startDate.add(index, 'day')

      return {
        color: '#2563eb',
        key: date.format('YYYY-MM-DD'),
        label: date.format('DD/MM'),
        totalQty: 0,
      }
    })

    rows.forEach((row) => {
      const dateKey = dayjs(row.createdAt).format('YYYY-MM-DD')
      const trendRow = trendRows.find((item) => item.key === dateKey)

      if (trendRow) {
        trendRow.totalQty += row.quantity
      }
    })

    return trendRows
  }

  const trendRows = shortMonthNames.map((label, index) => ({
    color: '#2563eb',
    key: `${selectedYear}-${String(index + 1).padStart(2, '0')}`,
    label,
    totalQty: 0,
  }))

  rows.forEach((row) => {
    const date = dayjs(row.createdAt)

    if (date.year() === selectedYear) {
      trendRows[date.month()].totalQty += row.quantity
    }
  })

  return trendRows
}

function buildDailyIssueHistoryRows(rows, selectedYear, selectedMonth) {
  const firstDay = dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
  const trendRows = Array.from({ length: firstDay.daysInMonth() }, (_, index) => {
    const date = firstDay.add(index, 'day')
    return { color: '#14b8a6', key: date.format('YYYY-MM-DD'), label: date.format('DD'), totalQty: 0 }
  })
  const rowsByDate = new Map(trendRows.map((row) => [row.key, row]))
  rows.forEach((row) => {
    const trendRow = rowsByDate.get(dayjs(row.createdAt).format('YYYY-MM-DD'))
    if (trendRow) trendRow.totalQty += Number(row.quantity ?? 0)
  })
  return trendRows
}

function isRowInPeriod(row, selectedYear, selectedMonth) {
  const date = dayjs(row.createdAt)

  return date.year() === selectedYear && date.month() === selectedMonth - 1
}

function StatCard({ color, helper, icon: Icon, label, value }) {
  return (
    <Card
      elevation={0}
      sx={{
        background: `linear-gradient(135deg, ${color}22, #ffffff 86%)`,
        border: `1px solid ${color}33`,
        borderRadius: 2,
        minHeight: 86,
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1.25}>
          <Box>
            <Typography sx={{ color: '#475569', fontSize: 11, fontWeight: 800 }}>
              {label}
            </Typography>
            <Typography sx={{ color: '#0f172a', fontSize: 24, fontWeight: 900, mt: 0.5 }}>
              {value}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 11, mt: 0.25 }}>
              {helper}
            </Typography>
          </Box>
          <Box
            sx={{
              alignItems: 'center',
              bgcolor: '#ffffffcc',
              borderRadius: 2,
              color,
              display: 'flex',
              height: 34,
              justifyContent: 'center',
              width: 34,
            }}
          >
            <Icon size={18} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function DonutChart({ action, legendValueLabel = 'ข้อมูล', roundValues = false, rows, subtitle, title, totalLabel = 'ข้อมูล' }) {
  const topRows = [...rows]
    .sort((first, second) => Number(second.totalQty ?? 0) - Number(first.totalQty ?? 0))
    .slice(0, 5)
  const chartRows = topRows
  const totalQty = chartRows.reduce((total, row) => total + Number(row.totalQty ?? 0), 0)
  let currentPercent = 0
  const gradient = totalQty
    ? chartRows.map((row) => {
      const percent = (row.totalQty / totalQty) * 100
      const segment = `${row.color} ${currentPercent}% ${currentPercent + percent}%`

      currentPercent += percent

      return segment
    }).join(', ')
    : '#e2e8f0 0% 100%'

  return (
    <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0, 1fr) auto auto',
            width: '100%',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#111827', fontSize: 15, fontWeight: 900 }}>
              {title}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
              {subtitle}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-end', ml: 'auto' }}>
            {action}
          </Box>
        </Box>

        <Box
          sx={{
            alignItems: 'center',
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: 'minmax(250px, 1fr) 150px',
            ml: 5,
            mt: 4,
            width: 'calc(100% - 40px)',
          }}
        >
          <Box
            sx={{
              alignItems: 'center',
              background: `conic-gradient(${gradient})`,
              borderRadius: '50%',
              display: 'flex',
              height: 250,
              justifyContent: 'center',
              flexShrink: 0,
              justifySelf: 'center',
              width: 250,
            }}
          >
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: 'background.default',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                height: 142,
                justifyContent: 'center',
                width: 142,
              }}
            >
              <Typography sx={{ color: 'text.primary', fontSize: 24, fontWeight: 900 }}>
                {Math.round(totalQty).toLocaleString('th-TH')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                {totalLabel}
              </Typography>
            </Box>
          </Box>

          <Stack alignItems="flex-start" gap={1.2} justifyContent="flex-start" sx={{ alignSelf: 'start', flexShrink: 0, mt: 1.5, width: 150 }}>
            {chartRows.map((row) => (
              <Stack key={row.label} alignItems="flex-start" direction="row" spacing={0.75} sx={{ width: '100%', minWidth: 0 }}>
                <Box sx={{ bgcolor: row.color, borderRadius: '50%', height: 8, width: 8, flexShrink: 0, mt: 0.25 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap title={row.label} sx={{ color: '#475569', fontSize: 12, lineHeight: 1.2 }}>
                    {row.label}
                  </Typography>
                  <Typography sx={{ color: '#0f172a', fontSize: 11, fontWeight: 800, mt: 0.25 }}>
                    {(roundValues ? Math.round(Number(row.totalQty ?? 0)) : Number(row.totalQty ?? 0)).toLocaleString('th-TH')} {legendValueLabel}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}

function TimeTrendBarChart({ action, periodMode, rows, title: customTitle, subtitle: customSubtitle, valueLabel = 'ยอดเบิก', valueUnit = 'Qty' }) {
  const chartRows = rows
  const maxQty = Math.max(...chartRows.map((row) => row.totalQty), 1)
  const chartWidth = 720
  const chartHeight = 252
  const chartPadding = { bottom: 34, left: 28, right: 28, top: 26 }
  const drawableWidth = chartWidth - chartPadding.left - chartPadding.right
  const drawableHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const chartPoints = chartRows.map((row, index) => ({
    ...row,
    x: chartPadding.left + (chartRows.length > 1 ? (drawableWidth * index) / (chartRows.length - 1) : drawableWidth / 2),
    y: chartPadding.top + drawableHeight - (Number(row.totalQty ?? 0) / maxQty) * drawableHeight,
  }))
  const linePoints = chartPoints.map((row) => `${row.x},${row.y}`).join(' ')
  const barWidth = Math.min(34, Math.max(14, (drawableWidth / Math.max(chartRows.length, 1)) * 0.34))
  const title = customTitle ?? (periodMode === 'daily' ? 'แนวโน้มการเบิก 7 วันล่าสุด' : 'แนวโน้มการเบิกรายเดือน')
  const subtitle = customSubtitle ?? (periodMode === 'daily'
    ? 'ดูยอดเบิกแยกตามวันย้อนหลัง 7 วัน'
    : 'ข้อมูล')

  return (
    <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            width: '100%',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#111827', fontSize: 15, fontWeight: 900 }}>
              {title}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
              {subtitle}
            </Typography>
          </Box>
          <Stack alignItems="center" direction="row" spacing={0.75} sx={{ flexShrink: 0, gridColumn: '1', gridRow: '2', justifySelf: 'start' }}>
            <Box sx={{ bgcolor: '#2563eb', borderRadius: '50%', height: 8, width: 8 }} />
            <Typography sx={{ color: '#64748b', fontSize: 12 }}>{valueLabel}</Typography>
          </Stack>
          <Stack alignItems="center" direction="row" justifyContent="flex-end" spacing={1.25} sx={{ flexShrink: 0, gridColumn: '2', gridRow: '1', justifySelf: 'end' }}>
            {action}
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', mt: 2.5, pl: 0.5, pr: 1 }}>
          <Box
            sx={{
              alignItems: 'flex-start',
              borderRight: '3px solid #1e1b4b',
              color: '#475569',
              display: 'flex',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 800,
              height: 252,
              justifyContent: 'center',
              pr: 1,
              width: 44,
            }}
          >
            {valueUnit}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ borderBottom: '3px solid #1e1b4b', height: 252, overflow: 'hidden' }}>
              <svg aria-label={title} viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="252" preserveAspectRatio="none">
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = chartPadding.top + drawableHeight - drawableHeight * ratio
                  return <line key={ratio} x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                })}
                {chartPoints.map((row) => (
                  <rect
                    key={`bar-${row.key}`}
                    x={row.x - barWidth / 2}
                    y={row.y}
                    width={barWidth}
                    height={chartPadding.top + drawableHeight - row.y}
                    rx="6"
                    fill="#14b8a6"
                    fillOpacity="0.92"
                  />
                ))}
                <polyline points={linePoints} fill="none" stroke="#1677ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {chartPoints.map((row) => (
                  <g key={row.key}>
                    <title>{row.fullLabel ?? row.label}: {Number(row.totalQty ?? 0).toLocaleString('th-TH')}</title>
                    <text className="report-trend-chart__value" x={row.x} y={Math.max(row.y - 14, 14)} fill="#0f172a" fontSize="12" fontWeight="800" textAnchor="middle">
                      {Number(row.totalQty ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </text>
                    <circle cx={row.x} cy={row.y} r="3.5" fill="#ffffff" stroke="#1677ff" strokeWidth="2" />
                    <text className="report-trend-chart__axis-label" x={row.x} y={chartHeight - 8} fill="#475569" fontSize="11" fontWeight="800" textAnchor="middle">
                      {row.label}
                    </text>
                  </g>
                ))}
              </svg>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function buildPurchaseTrendRows(rows, reportPeriod, selectedYear) {
  const templates = reportPeriod === 'daily'
    ? Array.from({ length: 7 }, (_, index) => {
      const date = dayjs().subtract(6, 'day').add(index, 'day')
      return { color: '#2563eb', key: date.format('YYYY-MM-DD'), label: date.format('DD/MM'), totalQty: 0 }
    })
    : shortMonthNames.map((label, index) => ({
      color: '#2563eb',
      key: `${selectedYear}-${String(index + 1).padStart(2, '0')}`,
      label,
      totalQty: 0,
    }))

  const totals = new Map(rows.map((row) => [
    reportPeriod === 'daily' ? dayjs(row.periodStart).format('YYYY-MM-DD') : dayjs(row.periodStart).format('YYYY-MM'),
    Number(row.totalPurchase ?? 0),
  ]))

  return templates.map((row) => ({ ...row, totalQty: totals.get(row.key) ?? 0 }))
}

function SupplierPurchaseBarChart({ action, rows, periodLabel, title = 'เปรียบเทียบยอดซื้อ', valueLabel = 'ยอดซื้อ (บาท)', valueUnit = 'บาท' }) {
  const chartRows = rows.slice(0, 8)
  const maxPurchase = Math.max(...chartRows.map((row) => Number(row.totalQty ?? 0)), 1)

  return (
    <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            width: '100%',
          }}
        >
          <Box>
            <Typography sx={{ color: '#111827', fontSize: 15, fontWeight: 900 }}>
              {title}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
              เปรียบเทียบ 8 อันดับแรก · {periodLabel}
            </Typography>
          </Box>
          <Box sx={{ justifySelf: 'end' }}>{action}</Box>
          <Stack alignItems="center" direction="row" spacing={0.75} sx={{ gridColumn: '1', gridRow: '2' }}>
            <Box sx={{ bgcolor: '#2563eb', borderRadius: '50%', height: 8, width: 8 }} />
            <Typography sx={{ color: '#64748b', fontSize: 12 }}>{valueLabel}</Typography>
          </Stack>
        </Box>

        {chartRows.length ? (
          <Box sx={{ display: 'flex', mt: 2.5, pl: 0.5, pr: 1 }}>
            <Box
              sx={{
                alignItems: 'flex-start',
                borderRight: '3px solid #1e1b4b',
                color: '#475569',
                display: 'flex',
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 800,
                height: 252,
                justifyContent: 'center',
                pr: 1,
                width: 44,
              }}
            >
              {valueUnit}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  alignItems: 'end',
                  borderBottom: '3px solid #1e1b4b',
                  display: 'grid',
                  gap: 1.2,
                  gridTemplateColumns: `repeat(${chartRows.length}, minmax(0, 1fr))`,
                  height: 252,
                  px: 1.5,
                }}
              >
                {chartRows.map((row) => {
                  const totalPurchase = Number(row.totalQty ?? 0)
                  const barHeight = totalPurchase > 0 ? Math.max((totalPurchase / maxPurchase) * 205, 18) : 0

                  return (
                    <Box key={row.key} sx={{ height: '100%', minWidth: 0, position: 'relative' }}>
                      <Typography
                        sx={{
                          bottom: barHeight + 8,
                          color: '#334155',
                          fontSize: 11,
                          fontWeight: 800,
                          left: 0,
                          position: 'absolute',
                          right: 0,
                          textAlign: 'center',
                        }}
                      >
                        {totalPurchase.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                      </Typography>
                      <Box
                        sx={{
                          bgcolor: '#2563eb',
                          bottom: 0,
                          height: barHeight,
                          left: '50%',
                          position: 'absolute',
                          transform: 'translateX(-50%)',
                          width: 30,
                        }}
                      />
                    </Box>
                  )
                })}
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1.2,
                  gridTemplateColumns: `repeat(${chartRows.length}, minmax(0, 1fr))`,
                  px: 1.5,
                  pt: 1,
                }}
              >
                {chartRows.map((row) => (
                  <Typography key={row.key} noWrap title={row.label} sx={{ color: '#475569', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>
                    {row.label}
                  </Typography>
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ alignItems: 'center', color: '#64748b', display: 'flex', height: 300, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 14 }}>ไม่พบข้อมูลในช่วงที่เลือก</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function ReportsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reports, setReports] = useState([])
  const [requisitions, setRequisitions] = useState([])
  const [purchaseReports, setPurchaseReports] = useState([])
  const [purchaseProductReports, setPurchaseProductReports] = useState([])
  const [purchaseTrendReports, setPurchaseTrendReports] = useState([])
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [expandedDepartment, setExpandedDepartment] = useState('')
  const [expandedDivision, setExpandedDivision] = useState('')
  const [expandedSupplier, setExpandedSupplier] = useState('')
  const [expandedProductHistory, setExpandedProductHistory] = useState('')
  const [expandedDepartmentHistory, setExpandedDepartmentHistory] = useState('')
  const [selectedIssueDocumentProduct, setSelectedIssueDocumentProduct] = useState(null)
  const [selectedDepartmentIssueDetails, setSelectedDepartmentIssueDetails] = useState(null)
  const [supplierPurchaseItems, setSupplierPurchaseItems] = useState({})
  const [reportMode, setReportMode] = useState('issue')
  const [reportMenuAnchor, setReportMenuAnchor] = useState(null)
  const [reportMenuGroup, setReportMenuGroup] = useState(null)
  const [reportMenuCategory, setReportMenuCategory] = useState(null)
  const [selectedYear, setSelectedYear] = useState(dayjs().year())
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1)
  const [vatRate, setVatRate] = useState(7)
  const [vatInput, setVatInput] = useState('7')
  const [savedVatRate, setSavedVatRate] = useState(7)
  const [pendingVatRate, setPendingVatRate] = useState(null)
  const [isVatSaving, setIsVatSaving] = useState(false)
  const [vatLoadedMonth, setVatLoadedMonth] = useState(null)
  const [vatError, setVatError] = useState('')
  const [vatSaveSuccess, setVatSaveSuccess] = useState(false)
  const reportPeriod = 'monthly'

  const dateRange = useMemo(() => {
    return {
      endDate: dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD'),
      startDate: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
    }
  }, [selectedMonth, selectedYear])

  const yearlyDateRange = useMemo(() => ({
    endDate: `${selectedYear}-12-31`,
    startDate: `${selectedYear}-01-01`,
  }), [selectedYear])

  useEffect(() => {
    let isMounted = true

    const loadReports = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const [issueData, requisitionData, purchaseData, purchaseProductData, purchaseTrendData] = await Promise.all([
          getStockIssues(yearlyDateRange),
          getRequisitions(),
          getPurchasesBySupplier(dateRange),
          getPurchasesByProduct(dateRange),
          getPurchaseTrend({ ...yearlyDateRange, period: reportPeriod }),
        ])

        // Older API versions return amounts but omit monthly quantities.
        // Recover missing quantities from the same supplier summary used by the cards.
        const completePurchaseTrend = await Promise.all((purchaseTrendData ?? []).map(async (row) => {
          if (row.totalQty != null) return row
          const month = dayjs(row.periodStart)
          if (!month.isValid()) throw new Error('Invalid purchase trend period')
          const startDate = month.startOf('month').format('YYYY-MM-DD')
          const monthlySuppliers = startDate === dateRange.startDate
            ? purchaseData
            : await getPurchasesBySupplier({ startDate, endDate: month.endOf('month').format('YYYY-MM-DD') })
          return {
            ...row,
            totalQty: (monthlySuppliers ?? []).reduce((sum, supplier) => sum + Number(supplier.totalQty ?? 0), 0),
          }
        }))

        if (isMounted) {
          setReports(issueData ?? [])
          setRequisitions(requisitionData ?? [])
          setPurchaseReports(purchaseData ?? [])
          setPurchaseProductReports(purchaseProductData ?? [])
          setPurchaseTrendReports(completePurchaseTrend)
          setSupplierPurchaseItems({})
          setExpandedSupplier('')
        }
      } catch {
        if (isMounted) {
          setReports([])
          setRequisitions([])
          setPurchaseReports([])
          setPurchaseProductReports([])
          setPurchaseTrendReports([])
          setLoadError('โหลดข้อมูลรายงานไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
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
  }, [dateRange, reportPeriod, yearlyDateRange])

  useEffect(() => {
    let isMounted = true

    setPendingVatRate(null)
    setVatLoadedMonth(null)
    setVatError('')
    getVatSetting(dateRange.startDate)
      .then((setting) => {
        if (isMounted) {
          const rate = Number(setting?.vatRate ?? 7)
          setVatRate(rate)
          setVatInput(String(rate))
          setSavedVatRate(rate)
          setVatLoadedMonth(dateRange.startDate)
        }
      })
      .catch(() => { if (isMounted) setVatError('โหลด VAT ของเดือนที่เลือกไม่สำเร็จ กรุณาเลือกเดือนใหม่หรือลองอีกครั้ง') })

    return () => {
      isMounted = false
    }
  }, [dateRange.startDate])

  const saveVatRate = async (value = vatRate) => {
    const normalizedVatRate = value === '' ? 7 : Number(value)
    setVatRate(normalizedVatRate)
    setIsVatSaving(true)
    try {
      const setting = await updateVatSetting({ vatRate: normalizedVatRate, effectiveFrom: dateRange.startDate })
      const savedRate = Number(setting?.vatRate ?? normalizedVatRate)
      setVatRate(savedRate)
      setVatInput(String(savedRate))
      setSavedVatRate(savedRate)
      setVatSaveSuccess(true)
      setVatError('')
      setPendingVatRate(null)
    } catch {
      setVatRate(savedVatRate)
      setVatError('บันทึก VAT ไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setIsVatSaving(false)
    }
  }

  const issueRows = useMemo(() => flattenIssueRows(reports), [reports])
  const backlogRows = useMemo(() => flattenBacklogRows(requisitions), [requisitions])
  const purchaseRows = useMemo(
    () => purchaseReports.map((row) => ({ ...row, totalPurchase: Number(row.totalPurchase ?? 0) })).sort((left, right) => Number(right.totalPurchase) - Number(left.totalPurchase)),
    [purchaseReports],
  )
  const needsPurchaseDetails = ['purchase-product-history', 'purchase-rank-invoice'].includes(reportMode)
  const [expandedAnalysisRow, setExpandedAnalysisRow] = useState('')

  useEffect(() => {
    if (!needsPurchaseDetails || !purchaseRows.length) return
    if (purchaseRows.every((supplier) => supplierPurchaseItems[supplier.supplierId])) return

    let isMounted = true
    Promise.all(purchaseRows.map(async (supplier) => [
      supplier.supplierId,
      supplierPurchaseItems[supplier.supplierId] ?? await getSupplierPurchaseItems(supplier.supplierId, dateRange),
    ])).then((entries) => {
      if (isMounted) setSupplierPurchaseItems((current) => ({ ...current, ...Object.fromEntries(entries) }))
    }).catch(() => { if (isMounted) setLoadError('โหลดรายละเอียดการซื้อไม่สำเร็จ') })

    return () => { isMounted = false }
  }, [dateRange, needsPurchaseDetails, purchaseRows, supplierPurchaseItems])
  const purchaseChartRows = useMemo(
    () => purchaseRows.map((row, index) => ({
      color: palette[index % palette.length],
      key: row.supplierId ?? `supplier-${index}`,
      label: row.supplierName,
      totalQty: Number(row.totalPurchase ?? 0),
    })),
    [purchaseRows],
  )
  const purchaseTrendRows = useMemo(
    () => buildPurchaseTrendRows(purchaseTrendReports.map((row) => ({ ...row, totalPurchase: Number(row.totalPurchase ?? 0) })), reportPeriod, selectedYear),
    [purchaseTrendReports, reportPeriod, selectedYear],
  )
  const backlogDepartmentRows = useMemo(() => buildBacklogDepartmentRows(backlogRows), [backlogRows])

  const periodRows = useMemo(
    () => issueRows.filter((row) => isRowInPeriod(row, selectedYear, selectedMonth)),
    [issueRows, selectedMonth, selectedYear],
  )

  const filteredRows = periodRows

  const reportRows = useMemo(
    () => summarizeByDayDepartmentProduct(filteredRows),
    [filteredRows],
  )

  const trendRows = useMemo(
    () => buildTimeTrendRows(issueRows, reportPeriod, selectedYear),
    [issueRows, reportPeriod, selectedYear],
  )

  const departmentRows = useMemo(
    () => buildDepartmentRows(filteredRows),
    [filteredRows],
  )
  const departmentIssueGroups = useMemo(
    () => buildDepartmentIssueGroups(filteredRows),
    [filteredRows],
  )
  const departmentExpenseGroups = useMemo(
    () => departmentRows.map((department) => ({
      department: department.label,
      products: [{ productCode: '', productName: 'ข้อมูล', totalCost: department.totalCost, totalQty: department.totalQty, unit: '' }],
    })),
    [departmentRows],
  )
  const productCategoryGroups = useMemo(
    () => buildProductCategoryGroups(filteredRows),
    [filteredRows],
  )
  const productHistoryGroups = useMemo(
    () => buildProductHistoryGroups(filteredRows),
    [filteredRows],
  )
  const departmentHistoryGroups = useMemo(
    () => buildDepartmentHistoryGroups(filteredRows),
    [filteredRows],
  )

  const divisionCostRows = useMemo(
    () => buildDivisionCostRows(filteredRows),
    [filteredRows],
  )
  const divisionCostChartRows = useMemo(
    () => divisionCostRows.map((row, index) => ({
      color: palette[index % palette.length],
      label: row.division,
      totalQty: row.totalCost,
    })),
    [divisionCostRows],
  )

  const costTrendRows = useMemo(
    () => buildTimeTrendRows(
      issueRows.map((row) => ({ ...row, quantity: row.totalCost })),
      reportPeriod,
      selectedYear,
    ),
    [issueRows, reportPeriod, selectedYear],
  )

  const toggleDepartment = (department) => {
    setExpandedDepartment((current) => (current === department ? '' : department))
  }

  const toggleDivision = (division) => {
    setExpandedDivision((current) => (current === division ? '' : division))
  }

  const toggleProductHistory = (product) => {
    const key = `${product.productCode}|${product.productName}`
    setExpandedProductHistory((current) => (current === key ? '' : key))
  }

  const toggleDepartmentHistory = (department) => {
    setExpandedDepartmentHistory((current) => (current === department.department ? '' : department.department))
  }

  const toggleSupplier = async (supplier) => {
    const supplierId = supplier.supplierId

    if (!supplierId) return

    if (expandedSupplier === supplierId) {
      setExpandedSupplier('')
      return
    }

    setExpandedSupplier(supplierId)

    if (supplierPurchaseItems[supplierId]) return

    try {
      const items = await getSupplierPurchaseItems(supplierId, dateRange)
      setSupplierPurchaseItems((current) => ({ ...current, [supplierId]: items ?? [] }))
    } catch {
      setSupplierPurchaseItems((current) => ({ ...current, [supplierId]: [] }))
      setLoadError('ข้อมูล ข้อมูล')
    }
  }

  const loadSupplierPurchaseGroups = async () => {
    const groups = await Promise.all(purchaseRows.map(async (supplier) => {
      const items = supplierPurchaseItems[supplier.supplierId] ?? await getSupplierPurchaseItems(supplier.supplierId, dateRange)
      const products = new Map()
      ;(items ?? []).forEach((item) => {
        const key = `${item.productCode}|${item.productName}`
        const product = products.get(key) ?? { productCode: item.productCode, productName: item.productName, totalCost: 0, totalQty: 0, unit: item.unit || '' }
        product.totalQty += Number(item.quantity ?? 0)
        product.totalCost += Number(item.totalPurchase ?? 0)
        products.set(key, product)
      })
      return { department: supplier.supplierName, products: [...products.values()] }
    }))
    return groups
  }

  const loadSupplierPurchaseHistoryRows = async () => {
    const groups = await loadSupplierPurchaseHistoryGroups()
    return groups.flatMap((supplier) => supplier.rows)
  }

  const loadSupplierPurchaseHistoryGroups = async () => {
    return Promise.all(purchaseRows.map(async (supplier) => {
      const items = supplierPurchaseItems[supplier.supplierId] ?? await getSupplierPurchaseItems(supplier.supplierId, dateRange)
      return {
        supplierName: supplier.supplierName,
        rows: (items ?? []).map((item) => ({
        ...item,
        supplierName: supplier.supplierName,
        totalPurchase: Number(item.totalPurchase ?? 0),
        unitCost: Number(item.unitCost ?? 0),
        vatUnitCost: Number(item.unitCost ?? 0) * Number(vatRate || 0) / 100,
        })),
      }
    }))
  }

  const productRows = useMemo(
    () => buildProductRows(filteredRows),
    [filteredRows],
  )
  const productSummaryRows = useMemo(
    () => buildProductSummaryRows(filteredRows, purchaseProductReports),
    [filteredRows, purchaseProductReports],
  )
  const categoryProductRows = useMemo(
    () => productCategoryGroups.flatMap((group) => group.products.map((product) => ({ ...product, category: group.category }))),
    [productCategoryGroups],
  )

  const rankingRows = departmentRows
  const rankingTitle = 'แผนกที่เบิกเยอะสุด'
  const rankingSubtitle = 'จำนวนสินค้าที่ถูกเบิก แยกตามแผนก'
  const periodLabel = `${shortMonthNames[selectedMonth - 1]} ${selectedYear}`
  const purchaseDetailRows = useMemo(
    () => purchaseRows.flatMap((supplier) => (supplierPurchaseItems[supplier.supplierId] ?? []).map((item) => ({
      ...item,
      supplierName: supplier.supplierName,
      totalPurchase: Number(item.totalPurchase ?? 0),
    }))),
    [purchaseRows, supplierPurchaseItems],
  )
  const analysisReport = useMemo(() => {
    const withRank = (rows) => rows.map((row, index) => ({ ...row, rank: index + 1 }))
    const productPurchaseRows = purchaseProductReports.map((row) => ({
      label: row.productName,
      productCode: row.productCode,
      totalCost: Number(row.purchaseAmount ?? 0),
      totalQty: Number(row.purchaseQty ?? 0),
      unit: row.unit || '-',
    }))
    const customerRows = departmentRows.map((row) => ({ label: row.label, totalCost: Number(row.totalCost ?? 0), totalQty: Number(row.totalQty ?? 0), documentCount: Number(row.documentCount ?? 0) }))
    const issueProductRows = productRows.map((row) => ({ label: row.label, productCode: row.productCode, totalCost: Number(row.totalCost ?? 0), totalQty: Number(row.totalQty ?? 0), documentCount: Number(row.documentCount ?? 0) }))
    const baseColumns = [
      { key: 'rank', label: 'อันดับ', width: 80, align: 'center' },
      { key: 'label', label: 'รายการ', minWidth: 260 },
      { key: 'totalQty', label: 'ปริมาณ', width: 140, align: 'center' },
      { key: 'totalCost', label: 'มูลค่า', width: 170, align: 'right', render: (row) => Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    ]
    if (reportMode === 'purchase-product-history') {
      const groups = new Map()
      purchaseDetailRows.forEach((row) => {
        const key = `${row.productCode}|${row.unit}`
        const group = groups.get(key) ?? { key, productCode: row.productCode, label: row.productName, unit: row.unit, totalQty: 0, totalCost: 0, rows: [] }
        group.totalQty += Number(row.quantity ?? 0)
        group.totalCost += Number(row.totalPurchase ?? 0)
        group.rows.push(row)
        groups.set(key, group)
      })
      return { title: 'ประวัติการซื้อแยกตามสินค้า', subtitle: `กดสินค้าเพื่อดูวันที่รับเข้า ผู้จำหน่าย และเลขที่ Invoice ${periodLabel}`, columns: [{ key: 'productCode', label: 'รหัสสินค้า', width: 180 }, ...baseColumns.slice(1), { key: 'unit', label: 'หน่วย', width: 100 }], rows: [...groups.values()], history: true }
    }
    if (reportMode === 'purchase-category') {
      const categories = new Map()
      purchaseProductReports.forEach((row) => {
        const category = row.category || 'ไม่ระบุหมวดสินค้า'
        const group = categories.get(category) ?? { label: category, totalQty: 0, totalCost: 0 }
        group.totalQty += Number(row.purchaseQty ?? 0)
        group.totalCost += Number(row.purchaseAmount ?? 0)
        categories.set(category, group)
      })
      return { title: 'รายงานสรุปยอดซื้อแยกตามหมวดสินค้า', subtitle: periodLabel, columns: [{ key: 'label', label: 'หมวดสินค้า', minWidth: 260 }, ...baseColumns.slice(2)], rows: [...categories.values()] }
    }
    if (reportMode === 'purchase-rank-value') return { title: 'จัดลำดับยอดซื้อตามมูลค่า', subtitle: periodLabel, columns: baseColumns, rows: withRank([...productPurchaseRows].sort((a, b) => b.totalCost - a.totalCost)) }
    if (reportMode === 'purchase-rank-qty') return { title: 'จัดลำดับยอดซื้อตามปริมาณ', subtitle: periodLabel, columns: baseColumns, rows: withRank([...productPurchaseRows].sort((a, b) => b.totalQty - a.totalQty)) }
    if (reportMode === 'purchase-rank-invoice') {
      const invoices = new Map()
      purchaseDetailRows.forEach((row) => { const key = `${row.supplierName}|${row.poInvoiceNo || '-'}`; const item = invoices.get(key) ?? { label: `${row.supplierName} / ${row.poInvoiceNo || '-'}`, totalQty: 0, totalCost: 0 }; item.totalQty += Number(row.quantity ?? 0); item.totalCost += Number(row.totalPurchase ?? 0); invoices.set(key, item) })
      return { title: 'จัดลำดับยอดซื้อจากบิลผู้จำหน่าย', subtitle: periodLabel, columns: baseColumns, rows: withRank([...invoices.values()].sort((a, b) => b.totalCost - a.totalCost)) }
    }
    if (reportMode === 'issue-rank-value') return { title: 'จัดลำดับยอดขายตามมูลค่า', subtitle: `มูลค่าต้นทุนสินค้าที่เบิก ${periodLabel}`, columns: baseColumns, rows: withRank([...issueProductRows].sort((a, b) => b.totalCost - a.totalCost)) }
    if (reportMode === 'issue-rank-qty') return { title: 'จัดลำดับยอดขายตามปริมาณ', subtitle: periodLabel, columns: baseColumns, rows: withRank([...issueProductRows].sort((a, b) => b.totalQty - a.totalQty)) }
    if (reportMode === 'issue-customer-rank-value') return { title: 'จัดลำดับยอดขายตามลูกค้า / มูลค่า', subtitle: periodLabel, columns: baseColumns, rows: withRank([...customerRows].sort((a, b) => b.totalCost - a.totalCost)) }
    if (reportMode === 'issue-customer-rank-qty') return { title: 'จัดลำดับยอดขายตามลูกค้า / ปริมาณ', subtitle: periodLabel, columns: baseColumns, rows: withRank([...customerRows].sort((a, b) => b.totalQty - a.totalQty)) }
    return null
  }, [departmentRows, periodLabel, productRows, purchaseDetailRows, purchaseProductReports, reportMode])

  const totalQty = filteredRows.reduce((total, row) => total + row.quantity, 0)
  const analysisByQuantity = reportMode.endsWith('-qty')
  const analysisIsPurchase = reportMode.startsWith('purchase')
  const analysisMonthlyRows = analysisIsPurchase
    ? buildPurchaseTrendRows(purchaseTrendReports.map((row) => ({ ...row, totalPurchase: Number(analysisByQuantity ? row.totalQty ?? 0 : row.totalPurchase ?? 0) })), 'monthly', selectedYear)
    : analysisByQuantity ? trendRows : costTrendRows
  const analysisChartRows = (analysisReport?.rows ?? []).map((row, index) => ({
    key: `${row.label}-${index}`,
    label: row.label,
    totalQty: Number(row[analysisByQuantity ? 'totalQty' : 'totalCost'] ?? 0),
    color: palette[index % palette.length],
  })).sort((a, b) => b.totalQty - a.totalQty)
  const analysisDonutRows = analysisChartRows.length > 5
    ? [...analysisChartRows.slice(0, 4), { key: 'others', label: 'อื่น ๆ', color: '#64748b', totalQty: analysisChartRows.slice(4).reduce((sum, row) => sum + row.totalQty, 0) }]
    : analysisChartRows
  const totalIssueCost = filteredRows.reduce((total, row) => total + row.totalCost, 0)
  const totalDocuments = new Set(filteredRows.map((row) => row.documentNo)).size
  const totalProducts = new Set(filteredRows.map((row) => row.productCode)).size
  const summaryItems = [
    {
      color: '#60a5fa',
      helper: periodLabel,
      icon: ShoppingCart,
      label: 'จำนวนสินค้าที่ถูกเบิก',
      value: totalQty.toLocaleString('th-TH'),
    },
    {
      color: '#a78bfa',
      helper: 'เอกสารเบิกที่บันทึกแล้ว',
      icon: FileText,
      label: 'จำนวนใบเบิก',
      value: totalDocuments.toLocaleString('th-TH'),
    },
    {
      color: '#fbbf24',
      helper: 'รายการสินค้าที่ถูกเบิก',
      icon: Package,
      label: 'จำนวนสินค้า',
      value: totalProducts.toLocaleString('th-TH'),
    },
    {
      color: '#14b8a6',
      helper: 'คำนวณจาก FIFO ของรายการที่เบิก',
      icon: ShoppingCart,
      label: 'มูลค่าต้นทุน FIFO',
      value: `${totalIssueCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
    },
  ]

  const divisionSummaryItems = [
    {
      color: '#14b8a6',
      helper: 'คำนวณจาก FIFO ของรายการที่เบิก',
      icon: ShoppingCart,
      label: 'ค่าใช้จ่ายรวม',
      value: `${totalIssueCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
    },
    {
      color: '#60a5fa',
      helper: 'ฝ่ายที่มีรายการเบิกในช่วงที่เลือก',
      icon: Building2,
      label: 'จำนวนฝ่าย',
      value: divisionCostRows.length.toLocaleString('th-TH'),
    },
    {
      color: '#a78bfa',
      helper: 'แผนกที่มีการเบิก',
      icon: Building2,
      label: 'จำนวนแผนก',
      value: divisionCostRows.reduce((sum, division) => sum + division.departments.length, 0).toLocaleString('th-TH'),
    },
    {
      color: '#fbbf24',
      helper: 'สินค้าที่ถูกเบิกทั้งหมด',
      icon: Package,
      label: 'จำนวนที่เบิก',
      value: totalQty.toLocaleString('th-TH'),
    },
  ]

  const backlogDocumentCount = new Set(backlogRows.map((row) => row.requestNo)).size
  const backlogProductCount = new Set(backlogRows.map((row) => row.productCode)).size
  const backlogTotalQty = backlogRows.reduce((total, row) => total + row.backlogQty, 0)
  const oldestBacklogDays = backlogRows.reduce((maxDays, row) => Math.max(maxDays, row.backlogDays), 0)
  const topBacklogDepartment = backlogDepartmentRows[0]
  const backlogSummaryItems = [
    {
      color: '#60a5fa',
      helper: 'ข้อมูล',
      icon: FileText,
      label: 'ข้อมูล',
      value: backlogDocumentCount.toLocaleString('th-TH'),
    },
    {
      color: '#f97316',
      helper: 'ข้อมูล',
      icon: AlertTriangle,
      label: 'ข้อมูล',
      value: backlogTotalQty.toLocaleString('th-TH'),
    },
    {
      color: '#fbbf24',
      helper: 'ข้อมูล',
      icon: Package,
      label: 'ข้อมูล',
      value: backlogProductCount.toLocaleString('th-TH'),
    },
    {
      color: '#fb7185',
      helper: topBacklogDepartment ? `แผนก ${topBacklogDepartment.department}` : 'ยังไม่มีข้อมูล',
      icon: Clock,
      label: 'ข้อมูล',
      value: `${oldestBacklogDays.toLocaleString('th-TH')} วัน`,
    },
  ]

  const totalPurchase = purchaseRows.reduce((total, row) => total + Number(row.totalPurchase ?? 0), 0)
  const purchaseDocumentCount = purchaseRows.reduce((total, row) => total + Number(row.documentCount ?? 0), 0)
  const purchaseItemCount = purchaseRows.reduce((total, row) => total + Number(row.itemCount ?? 0), 0)
  const purchaseQty = purchaseRows.reduce((total, row) => total + Number(row.totalQty ?? 0), 0)
  const topSupplier = purchaseRows[0]
  const purchasePeriodLabel = `${shortMonthNames[selectedMonth - 1]} ${selectedYear}`
  const makeReportFileName = (reportName, extension) => `${reportName}_${selectedYear}-${String(selectedMonth).padStart(2, '0')}_${dayjs().format('YYYYMMDD-HHmm')}.${extension}`
  const money = (value) => Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const reportSubtotal = Math.round((analysisReport
    ? analysisReport.rows.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0)
    : reportMode.startsWith('purchase') ? totalPurchase : totalIssueCost) * 100) / 100
  const reportVatAmount = Math.round(reportSubtotal * Number(vatRate || 0)) / 100
  const reportGrandTotal = Math.round((reportSubtotal + reportVatAmount) * 100) / 100
  const vatSummaryLines = [
    `มูลค่าก่อน VAT: ${money(reportSubtotal)} บาท`,
    `VAT ${Number(vatRate || 0)}%: ${money(reportVatAmount)} บาท`,
    `มูลค่ารวม VAT: ${money(reportGrandTotal)} บาท`,
  ]
  const vatExportPeriod = `${periodLabel}\n${vatSummaryLines.join('\n')}`
  const purchaseSummaryItems = [
    { color: '#60a5fa', helper: purchasePeriodLabel, icon: Building2, label: 'จำนวนผู้ขาย', value: purchaseRows.length.toLocaleString('th-TH') },
    { color: '#a78bfa', helper: 'เอกสารรับเข้าที่บันทึกแล้ว', icon: FileText, label: 'จำนวนเอกสารรับเข้า', value: purchaseDocumentCount.toLocaleString('th-TH') },
    { color: '#fbbf24', helper: `จำนวนรับเข้ารวม ${purchaseQty.toLocaleString('th-TH')} หน่วย`, icon: Package, label: 'จำนวนรายการสินค้า', value: purchaseItemCount.toLocaleString('th-TH') },
    { color: '#fb7185', helper: topSupplier ? `สูงสุด: ${topSupplier.supplierName}` : 'ยังไม่มีข้อมูล', icon: ShoppingCart, label: 'ยอดซื้อรวม', value: `${totalPurchase.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท` },
  ]

  const handleExport = async () => {
    if (vatLoadedMonth !== dateRange.startDate || isVatSaving) return
    const periodLabel = vatExportPeriod
    const purchasePeriodLabel = vatExportPeriod
    if (analysisReport) {
      const columns = analysisReport.history ? purchaseHistoryExportColumns : analysisReport.columns.map((column) => ({ header: column.label, value: (row) => row[column.key] ?? '' }))
      const rows = analysisReport.history ? analysisReport.rows.flatMap((group) => group.rows) : analysisReport.rows
      await exportRowsToExcel(rows, columns, makeReportFileName(analysisReport.title.replaceAll('/', '-'), 'xlsx'), { reportContext: { period: periodLabel, title: analysisReport.title } })
      return
    }
    if (reportMode === 'backlog') {
      exportRowsToExcel(
        backlogRows,
        backlogExportColumns,
        makeReportFileName('รายงานรายการค้าง', 'xlsx'),
      )
      return
    }

    if (reportMode === 'purchase') {
      const groups = await loadSupplierPurchaseGroups()
      exportDepartmentIssueToExcel(groups, makeReportFileName('รายงานยอดซื้อแยกตามผู้ขาย', 'xlsx'), purchasePeriodLabel, vatRate, 'ข้อมูล', 'ข้อมูล')
      return
    }

    if (reportMode === 'purchase-history') {
      const rows = await loadSupplierPurchaseHistoryRows()
      exportRowsToExcel(rows, purchaseHistoryExportColumns, makeReportFileName('ประวัติยอดซื้อแยกตามผู้ขาย', 'xlsx'), { reportContext: { title: 'ประวัติยอดซื้อแยกตามผู้ขาย', period: periodLabel } })
      return
    }

    if (reportMode === 'product') {
      exportProductIssueByCategoryToExcel(productCategoryGroups, makeReportFileName('รายงานสินค้าแยกตามหมวดหมู่', 'xlsx'), periodLabel, 'รายงานสินค้าแยกตามหมวดหมู่', vatRate)
      return
    }

    if (reportMode === 'product-history') {
      exportRowsToExcel(
        productHistoryGroups.flatMap((product) => product.rows.map((row) => ({ ...row, productCode: product.productCode, productName: product.productName }))),
        [
          { header: 'รหัสสินค้า', value: (row) => row.productCode }, { header: 'ชื่อสินค้า', value: (row) => row.productName }, { header: 'วันที่เบิก', value: (row) => formatReportDate(row.createdAt) }, { header: 'เลขที่ใบเบิก', value: (row) => row.documentNo }, { header: 'ลูกค้า (แผนก)', value: (row) => row.department }, { header: 'จำนวน', value: (row) => row.quantity }, { header: 'หน่วย', value: (row) => row.unit }, { header: 'ยอดเบิก', value: (row) => row.totalCost },
        ],
        makeReportFileName('ประวัติการเบิกแยกตามสินค้า', 'xlsx'),
        { reportContext: { period: periodLabel, title: 'ประวัติการเบิกแยกตามสินค้า' } },
      )
      return
    }

    if (reportMode === 'department-history') {
      exportRowsToExcel(
        departmentHistoryGroups.flatMap((department) => department.rows),
        [
          { header: 'วันที่เบิก', value: (row) => formatReportDate(row.createdAt) }, { header: 'เลขที่ใบเบิก', value: (row) => row.documentNo }, { header: 'ลูกค้า (แผนก)', value: (row) => row.department }, { header: 'รหัสสินค้า', value: (row) => row.productCode }, { header: 'ชื่อสินค้า', value: (row) => row.productName }, { header: 'จำนวน', value: (row) => row.quantity }, { header: 'หน่วย', value: (row) => row.unit }, { header: 'ยอดเบิก', value: (row) => row.totalCost },
        ],
        makeReportFileName('ประวัติการเบิกแยกตามลูกค้า (แผนก)', 'xlsx'),
        { reportContext: { period: periodLabel, title: 'ประวัติการเบิกแยกตามลูกค้า (แผนก)' } },
      )
      return
    }

    if (reportMode === 'division-cost') {
      exportDepartmentCostSummaryToExcel(departmentRows, makeReportFileName('รายงานค่าใช้จ่ายรวม', 'xlsx'), periodLabel, vatRate)
      return
    }

    if (reportMode === 'issue') {
      exportDepartmentIssueToExcel(
        departmentIssueGroups,
        makeReportFileName('รายงานสรุปแยกตามลูกค้า (แผนก)', 'xlsx'),
        periodLabel,
        vatRate,
      )
      return
    }

    exportRowsToExcel(
      reportRows,
      exportColumns,
      makeReportFileName('รายงานการเบิก', 'xlsx'),
    )
  }

  const handlePdfExport = async () => {
    if (vatLoadedMonth !== dateRange.startDate || isVatSaving) return
    const periodLabel = vatExportPeriod
    const purchasePeriodLabel = vatExportPeriod
    if (analysisReport) {
      setIsPdfLoading(true)
      try {
        if (analysisReport.history) {
          await exportPurchaseHistoryBySupplierToPdf({ fileName: makeReportFileName(analysisReport.title, 'pdf'), groups: analysisReport.rows.map((group) => ({ supplierName: `${group.productCode} ${group.label}`, rows: group.rows })), periodLabel, title: analysisReport.title, vatRate })
        } else {
          const formatValue = (value, key) => typeof value === 'number' ? value.toLocaleString('th-TH', { minimumFractionDigits: key === 'totalCost' ? 2 : 0, maximumFractionDigits: key === 'totalCost' ? 2 : 3 }) : value ?? ''
          await exportTableToPdf({
            fileName: makeReportFileName(analysisReport.title.replaceAll('/', '-'), 'pdf'),
            title: analysisReport.title,
            periodLabel: `ประจำเดือน ${periodLabel}`,
            rows: analysisReport.rows,
            summaryStyle: true,
            vatRate,
            totalAmount: reportSubtotal,
            columns: analysisReport.columns.map((column) => ({
              header: column.label,
              align: ['rank', 'label'].includes(column.key) ? 'left' : ['totalQty', 'totalCost'].includes(column.key) ? 'right' : 'center',
              value: (row) => formatValue(row[column.key], column.key),
              totalValue: ['totalQty', 'totalCost'].includes(column.key) ? (rows) => formatValue(rows.reduce((sum, row) => sum + Number(row[column.key] ?? 0), 0), column.key) : undefined,
            })),
          })
        }
      } finally { setIsPdfLoading(false) }
      return
    }
    let columns = exportColumns
    let rows = reportRows
    let title = 'รายงานการเบิก'

    if (reportMode === 'purchase') {
      setIsPdfLoading(true)
      try {
        const groups = await loadSupplierPurchaseGroups()
        await exportDepartmentIssueToPdf({ fileName: makeReportFileName('รายงานยอดซื้อแยกตามผู้ขาย', 'pdf'), groups, periodLabel: purchasePeriodLabel, vatRate, title: 'รายงานยอดซื้อแยกตามผู้ขาย', groupLabel: 'ผู้ขาย' })
      } finally {
        setIsPdfLoading(false)
      }
      return
    } else if (reportMode === 'purchase-history') {
      setIsPdfLoading(true)
      try {
        const groups = await loadSupplierPurchaseHistoryGroups()
        await exportPurchaseHistoryBySupplierToPdf({
          fileName: makeReportFileName('ประวัติยอดซื้อแยกตามผู้ขาย', 'pdf'),
          groups,
          periodLabel: purchasePeriodLabel,
          title: 'ประวัติยอดซื้อแยกตามผู้ขาย',
          vatRate,
        })
      } finally {
        setIsPdfLoading(false)
      }
      return
    } else if (reportMode === 'product') {
      setIsPdfLoading(true)
      try {
        await exportProductIssueByCategoryToPdf({ fileName: makeReportFileName('รายงานสินค้าแยกตามหมวดหมู่', 'pdf'), groups: productCategoryGroups, periodLabel, vatRate })
      } finally {
        setIsPdfLoading(false)
      }
      return
    } else if (reportMode === 'product-history') {
      setIsPdfLoading(true)
      try {
        await exportProductIssueHistoryToPdf({
          fileName: makeReportFileName('ประวัติการเบิกแยกตามสินค้า', 'pdf'),
          groups: productHistoryGroups,
          periodLabel,
          vatRate,
        })
      } finally {
        setIsPdfLoading(false)
      }
      return
    } else if (reportMode === 'department-history') {
      setIsPdfLoading(true)
      try {
        await exportProductIssueHistoryToPdf({
          fileName: makeReportFileName('ประวัติการเบิกแยกตามลูกค้า (แผนก)', 'pdf'),
          groups: departmentHistoryGroups.map((department) => ({ productCode: '', productName: `ลูกค้า (แผนก): ${department.department}`, rows: department.rows })),
          periodLabel,
          title: 'ประวัติการเบิกแยกตามลูกค้า (แผนก)',
          vatRate,
        })
      } finally {
        setIsPdfLoading(false)
      }
      return
    } else if (reportMode === 'backlog') {
      columns = backlogExportColumns
      rows = backlogRows
      title = 'รายงานรายการค้าง'
    } else if (reportMode === 'division-cost') {
      setIsPdfLoading(true)
      try {
        await exportDepartmentCostSummaryToPdf({ fileName: makeReportFileName('รายงานค่าใช้จ่ายรวม', 'pdf'), periodLabel, rows: departmentRows, vatRate })
      } finally {
        setIsPdfLoading(false)
      }
      return
    } else if (reportMode === 'issue') {
      setIsPdfLoading(true)
      try {
        await exportDepartmentIssueToPdf({
          fileName: makeReportFileName('รายงานสรุปแยกตามลูกค้า (แผนก)', 'pdf'),
          groups: departmentIssueGroups,
          periodLabel,
          vatRate,
        })
      } finally {
        setIsPdfLoading(false)
      }
      return
    }

    setIsPdfLoading(true)
    try {
      await exportTableToPdf({
        columns,
        fileName: makeReportFileName(title, 'pdf'),
        periodLabel: `ข้อมูล: ${periodLabel}`,
        rows,
        title,
        vatRate,
        totalAmount: reportSubtotal,
      })
    } finally {
      setIsPdfLoading(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        alignItems="flex-start"
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ width: '100%' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 900 }}>
            รายงาน
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
            ภาพรวมการเบิกสินค้า แยกตามแผนก สินค้า รายวัน และรายเดือน
          </Typography>
        </Box>

        <Stack
          alignItems="center"
          direction="row"
          justifyContent="flex-end"
          spacing={1.25}
          sx={{ flexShrink: 0, ml: { xs: 0, md: 'auto' }, width: { xs: '100%', md: 'auto' } }}
        >
          <Button
            id="report-selector"
            aria-haspopup="menu"
            aria-expanded={Boolean(reportMenuAnchor)}
            aria-controls={reportMenuAnchor ? 'report-selector-menu' : undefined}
            variant="outlined"
            endIcon={<ChevronDown size={16} />}
            onClick={(event) => {
              const group = reportGroups.find((item) => item.categories.some((category) => category.items.some((mode) => mode.value === reportMode)))
              setReportMenuGroup(group?.label ?? null)
              setReportMenuCategory(group?.categories.find((category) => category.items.some((mode) => mode.value === reportMode))?.label ?? null)
              setReportMenuAnchor(event.currentTarget)
            }}
            sx={{ height: 40, justifyContent: 'space-between', minWidth: 255, px: 1.5, textTransform: 'none', color: 'text.primary', borderColor: 'divider' }}
          >
            {reportGroups.flatMap((group) => group.categories).filter((category) => category.items.some((mode) => mode.value === reportMode)).map((category) => `${category.label} / ${reportModes.find((mode) => mode.value === reportMode)?.label}`).join('') || 'ประเภทรายงาน'}
          </Button>
          <Menu
            id="report-selector-menu"
            anchorEl={reportMenuAnchor}
            open={Boolean(reportMenuAnchor)}
            onClose={() => setReportMenuAnchor(null)}
            MenuListProps={{ 'aria-labelledby': 'report-selector' }}
            PaperProps={{ sx: { minWidth: 320, maxWidth: 'calc(100vw - 32px)', maxHeight: '70vh' } }}
          >
            {reportGroups.flatMap((group) => [
              <MenuItem key={group.label} aria-expanded={reportMenuGroup === group.label} sx={{ gap: 1, fontWeight: 700 }} onClick={() => {
                setReportMenuGroup(reportMenuGroup === group.label ? null : group.label)
                setReportMenuCategory(null)
              }}>
                {reportMenuGroup === group.label ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {group.label}
              </MenuItem>,
              ...(reportMenuGroup === group.label ? group.categories.flatMap((category) => [
                <MenuItem key={`${group.label}-${category.label}`} aria-expanded={reportMenuCategory === category.label} sx={{ pl: 4, gap: 1 }} onClick={() => setReportMenuCategory(reportMenuCategory === category.label ? null : category.label)}>
                  {reportMenuCategory === category.label ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {category.label}
                </MenuItem>,
                ...(reportMenuCategory === category.label ? category.items.map((mode) => (
                  <MenuItem key={mode.value} selected={reportMode === mode.value} sx={{ pl: 8, whiteSpace: 'normal' }} onClick={() => {
                    setReportMode(mode.value)
                    setReportMenuAnchor(null)
                  }}>
                    {mode.label}
                  </MenuItem>
                )) : []),
              ]) : []),
            ])}
          </Menu>
          {reportMode !== 'backlog' ? (
            <>
              <TextField select label="เดือน" size="small" value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} sx={{ width: 125 }}>
                {shortMonthNames.map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
              </TextField>
              <TextField select label="ปี" size="small" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} sx={{ width: 105 }}>
                {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
              </TextField>
            </>
          ) : null}
          {false ? (
            <>
              <TextField select label="เดือน" size="small" value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} sx={{ width: 125 }}>
                {shortMonthNames.map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
              </TextField>
              <TextField select label="ปี" size="small" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} sx={{ width: 105 }}>
                {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
              </TextField>
            </>
          ) : null}
          {reportMode !== 'backlog' ? (
            <TextField
              label="VAT สรุป (%)"
              disabled={vatLoadedMonth !== dateRange.startDate || isVatSaving}
              size="small"
              type="number"
              value={vatInput}
              onChange={(event) => {
                const nextValue = event.target.value
                if (/^\d{0,3}(?:\.\d{0,2})?$/.test(nextValue)) setVatInput(nextValue)
              }}
              onBlur={() => {
                if (!/^\d+(?:\.\d{1,2})?$/.test(vatInput)) {
                  setVatRate(savedVatRate)
                  setVatInput(String(savedVatRate))
                  return
                }
                const nextRate = Math.min(100, Math.max(0, Number(vatInput)))
                setVatRate(nextRate)
                if (nextRate !== savedVatRate) setPendingVatRate(nextRate)
                else setVatInput(String(savedVatRate))
              }}
              helperText={isVatSaving ? 'กำลังบันทึก...' : `อัตราเฉพาะเดือน ${shortMonthNames[selectedMonth - 1]} ${selectedYear}`}
              FormHelperTextProps={{ sx: { fontSize: 11, whiteSpace: 'nowrap' } }}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              sx={{ width: 175 }}
            />
          ) : null}
          <Button
            disabled={isVatSaving || vatLoadedMonth !== dateRange.startDate}
            size="small"
            startIcon={<Download size={16} />}
            sx={{
              fontSize: 13,
              fontWeight: 800,
              height: 40,
              minWidth: 132,
              px: 1.5,
            }}
            variant="outlined"
            onClick={handleExport}
          >
            ส่งออก Excel
          </Button>
          <Button
            disabled={isPdfLoading || isVatSaving || vatLoadedMonth !== dateRange.startDate}
            size="small"
            startIcon={<FileText size={16} />}
            sx={{ fontSize: 13, fontWeight: 800, height: 40, minWidth: 126, px: 1.5 }}
            variant="outlined"
            onClick={handlePdfExport}
          >
            {isPdfLoading ? 'กำลังสร้าง PDF...' : 'ส่งออก PDF'}
          </Button>
        </Stack>
      </Stack>

      {loadError ? <Alert severity="warning">{loadError}</Alert> : null}
      {vatError ? <Alert severity="error">{vatError}</Alert> : null}

      {reportMode === 'issue' ? (
        <>
          <Grid container spacing={2}>
            {summaryItems.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <DonutChart
                legendValueLabel="เบิก"
                rows={rankingRows}
                subtitle={rankingSubtitle}
                title={rankingTitle}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <TimeTrendBarChart
                periodMode={reportPeriod}
                rows={trendRows}
              />
            </Grid>
          </Grid>

          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                      ยอดขายแยกตามลูกค้า (แผนก)
                    </Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                      รวมจำนวนและมูลค่าต้นทุน FIFO ของสินค้าที่แต่ละลูกค้าเบิกในเดือน {periodLabel}
                    </Typography>
                  </Box>
                </Stack>
                <AppTable
                  columns={departmentIssueColumns}
                  defaultSortField="totalCost"
                  defaultSortDirection="desc"
                  expandable
                  isRowExpanded={(row) => expandedDepartment === row.label}
                  isLoading={isLoading}
                  maxHeight={560}
                  noDataText="ไม่พบรายการเบิกตามช่วงที่เลือก"
                  onToggleRow={(row) => toggleDepartment(row.label)}
                  renderExpandedRow={(department) => (
                    <Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 900, mb: 1.25 }}>
                        รายการที่แผนก {department.label} เบิก
                      </Typography>
                      <AppTable
                        columns={departmentIssueDetailColumns}
                        defaultSortField="createdAt"
                        defaultSortDirection="desc"
                        maxHeight={360}
                        noDataText="ไม่พบรายการเบิกของแผนกนี้"
                        rowKey={(row) => `${row.documentNo}-${row.productCode}-${row.createdAt}`}
                        rows={filteredRows.filter((row) => row.department === department.label)}
                        showColumnFilters={false}
                      />
                    </Box>
                  )}
                  rowKey="label"
                  rows={departmentRows}
                  showGlobalSearch
                />
              </Stack>
            </CardContent>
          </Card>

        </>
      ) : reportMode === 'division-cost' ? (
        <>
          <Grid container spacing={2}>
            {divisionSummaryItems.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <DonutChart
                legendValueLabel="บาท"
                rows={divisionCostChartRows}
                subtitle={`ค่าใช้จ่ายจากต้นทุน FIFO ประจำเดือน ${periodLabel}`}
                title="สัดส่วนค่าใช้จ่ายแต่ละแผนก"
                totalLabel="ค่าใช้จ่ายรวม (บาท)"
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <TimeTrendBarChart
                periodMode={reportPeriod}
                rows={costTrendRows}
                subtitle="ต้นทุน FIFO ของรายการเบิกในแต่ละช่วงเวลา"
                title="แนวโน้มค่าใช้จ่าย"
                valueLabel="ค่าใช้จ่าย (บาท)"
                valueUnit="บาท"
              />
            </Grid>
          </Grid>
          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                  ค่าใช้จ่ายแยกตามแผนก
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                  มูลค่าต้นทุน FIFO ของสินค้าที่แผนกเบิกในเดือน {periodLabel}
                </Typography>
              </Box>
              <AppTable
                columns={departmentCostSummaryColumns}
                defaultSortField="totalCost"
                defaultSortDirection="desc"
                isLoading={isLoading}
                maxHeight={560}
                noDataText="ไม่พบรายการเบิกตามช่วงที่เลือก"
                rowKey="label"
                rows={departmentRows}
                showGlobalSearch
              />
              <Typography align="right" sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                รวมทั้งหมด {departmentRows.reduce((sum, row) => sum + Number(row.totalCost || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
              </Typography>
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : reportMode === 'purchase' ? (
        <>
          <Grid container spacing={2}>
            {purchaseSummaryItems.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <DonutChart
                legendValueLabel="บาท"
                roundValues
                rows={purchaseChartRows}
                subtitle={`สัดส่วนยอดซื้อจากรายการรับเข้า ${purchasePeriodLabel}`}
                title="สัดส่วนยอดซื้อแต่ละผู้ขาย"
                totalLabel="ยอดซื้อรวม (บาท)"
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <TimeTrendBarChart
                periodMode={reportPeriod}
                rows={purchaseTrendRows}
                subtitle={reportPeriod === 'daily' ? 'ดูยอดซื้อแยกตามวันย้อนหลัง 7 วัน' : 'ดูยอดซื้อแยกตามเดือนในปีที่เลือก'}
                title={reportPeriod === 'daily' ? 'แนวโน้มยอดซื้อ 7 วันล่าสุด' : 'แนวโน้มยอดซื้อรายเดือน'}
                valueLabel="ยอดซื้อ (บาท)"
                valueUnit="บาท"
              />
            </Grid>
          </Grid>

          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                      ยอดซื้อแยกตามผู้ขาย
                    </Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                      รวมจากรายการรับเข้าที่บันทึกต้นทุนจริง {purchasePeriodLabel}
                    </Typography>
                  </Box>
                </Stack>
                <AppTable
                  columns={purchaseColumns}
                  defaultSortField="totalPurchase"
                  defaultSortDirection="desc"
                  expandable
                  isRowExpanded={(row) => expandedSupplier === row.supplierId}
                  isLoading={isLoading}
                  maxHeight={560}
                  noDataText="ไม่พบรายการรับเข้าตามช่วงที่เลือก"
                  onToggleRow={toggleSupplier}
                  renderExpandedRow={(supplier) => (
                    <Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 900, mb: 1.25 }}>
                        รายการที่รับเข้าจากผู้ขาย {supplier.supplierName}
                      </Typography>
                      <AppTable
                        columns={supplierPurchaseDetailColumns}
                        defaultSortField="receivedAt"
                        defaultSortDirection="desc"
                        maxHeight={360}
                        noDataText="ไม่พบรายการรับเข้าจากผู้ขายรายนี้"
                        rowKey={(row) => `${row.receiveHeaderId}-${row.productCode}-${row.receivedAt}`}
                        rows={(supplierPurchaseItems[supplier.supplierId] ?? []).map((row) => ({ ...row, totalPurchase: Number(row.totalPurchase ?? 0), unitCost: Number(row.unitCost ?? 0), vatUnitCost: Number(row.unitCost ?? 0) * Number(vatRate || 0) / 100 }))}
                        showColumnFilters={false}
                      />
                    </Box>
                  )}
                  rowKey={(row) => row.supplierId ?? 'unspecified-supplier'}
                  rows={purchaseRows}
                  showGlobalSearch
                />
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : reportMode === 'purchase-history' ? (
        <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                  ประวัติยอดซื้อแยกตามผู้ขาย
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                  กดผู้ขายเพื่อดูวันที่รับเข้า เลขที่ Invoice และสินค้าที่ซื้อในเดือน {purchasePeriodLabel}
                </Typography>
              </Box>
              <AppTable
                columns={purchaseColumns}
                defaultSortField="totalPurchase"
                defaultSortDirection="desc"
                expandable
                isRowExpanded={(row) => expandedSupplier === row.supplierId}
                isLoading={isLoading}
                maxHeight={560}
                noDataText="ไม่พบประวัติรับเข้าตามช่วงที่เลือก"
                onToggleRow={toggleSupplier}
                renderExpandedRow={(supplier) => (
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 900, mb: 1.25 }}>
                        รายการที่รับเข้าจากผู้ขาย {supplier.supplierName}
                    </Typography>
                    <AppTable
                      columns={supplierPurchaseDetailColumns}
                      defaultSortField="receivedAt"
                      defaultSortDirection="desc"
                      maxHeight={360}
                      noDataText="ไม่พบประวัติรับเข้าจากผู้ขายรายนี้"
                      rowKey={(row) => `${row.receiveHeaderId}-${row.productCode}-${row.receivedAt}`}
                      rows={(supplierPurchaseItems[supplier.supplierId] ?? []).map((row) => ({ ...row, totalPurchase: Number(row.totalPurchase ?? 0), unitCost: Number(row.unitCost ?? 0), vatUnitCost: Number(row.unitCost ?? 0) * Number(vatRate || 0) / 100 }))}
                      showColumnFilters={false}
                    />
                  </Box>
                )}
                rowKey={(row) => row.supplierId ?? 'unspecified-supplier'}
                rows={purchaseRows}
                showGlobalSearch
              />
            </Stack>
          </CardContent>
        </Card>
      ) : reportMode === 'product' ? (
        <>
          <Grid container spacing={2}>
            {summaryItems.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <DonutChart
                legendValueLabel="เบิก"
                rows={productRows}
                subtitle="จำนวนสินค้าที่ถูกเบิก แยกตามสินค้า"
                title="สัดส่วนการเบิกตามหมวดหมู่"
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <TimeTrendBarChart
                periodMode={reportPeriod}
                rows={trendRows}
              />
            </Grid>
          </Grid>

          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
              <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                    รายงานสินค้าแยกตามหมวดหมู่
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                    สรุปจำนวนและมูลค่าต้นทุน FIFO ของสินค้าแต่ละหมวดหมู่
                  </Typography>
                </Box>
              </Stack>
              <AppTable
                columns={productSummaryColumns}
                defaultSortField="productName"
                defaultSortDirection="asc"
                isLoading={isLoading}
                key={`product-ranking-${reportPeriod}-${selectedYear}`}
                maxHeight={560}
                noDataText="ไม่พบรายการสินค้าในช่วงที่เลือก"
                rowKey={(row) => `${row.category}-${row.productCode}-${row.productName}`}
                rows={categoryProductRows}
                showGlobalSearch
              />
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : reportMode === 'product-history' ? (
        <>
          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                  ประวัติการเบิกแยกตามสินค้า
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                  กดที่สินค้าเพื่อดูรายการเบิกและเลขที่ใบเบิกในเดือน {periodLabel}
                </Typography>
              </Box>
              <AppTable
                columns={productHistoryColumns}
                defaultSortField="productName"
                defaultSortDirection="asc"
                expandable
                isLoading={isLoading}
                isRowExpanded={(row) => expandedProductHistory === `${row.productCode}|${row.productName}`}
                maxHeight={560}
                noDataText="ไม่พบประวัติการเบิกตามช่วงที่เลือก"
                onToggleRow={toggleProductHistory}
                renderExpandedRow={(product) => (
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 900, mb: 1.25 }}>
                      รายการเบิก: {product.productName} / {product.productCode}
                    </Typography>
                    <AppTable
                      columns={productHistoryDetailColumns}
                      defaultSortField="createdAt"
                      defaultSortDirection="desc"
                      maxHeight={360}
                      noDataText="ไม่พบรายการเบิกของสินค้านี้"
                      rowKey={(row) => `${row.documentNo}-${row.createdAt}-${row.department}`}
                      rows={product.rows}
                      showColumnFilters={false}
                    />
                  </Box>
                )}
                rowKey={(row) => `${row.productCode}|${row.productName}`}
                rows={productHistoryGroups.map((product) => ({ ...product, onShowIssueDocuments: setSelectedIssueDocumentProduct }))}
                showGlobalSearch
              />
            </Stack>
          </CardContent>
          </Card>
          <Dialog fullWidth maxWidth="sm" open={Boolean(selectedIssueDocumentProduct)} onClose={() => setSelectedIssueDocumentProduct(null)}>
            <DialogTitle>เลขที่ใบเบิก</DialogTitle>
            <DialogContent dividers>
              <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
                {selectedIssueDocumentProduct?.productName} / {selectedIssueDocumentProduct?.productCode}
              </Typography>
              <Stack spacing={0.75}>
                {selectedIssueDocumentProduct?.issueDocumentNos?.split(', ').map((documentNo) => (
                  <Typography key={documentNo}>{documentNo}</Typography>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedIssueDocumentProduct(null)}>ปิด</Button>
            </DialogActions>
          </Dialog>
        </>
      ) : reportMode === 'department-history' ? (
        <>
        <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                  ประวัติการเบิกแยกตามลูกค้า (แผนก)
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                  กดที่แผนกเพื่อดูรายการสินค้าและใบเบิกในเดือน {periodLabel}
                </Typography>
              </Box>
              <AppTable
                columns={departmentHistoryColumns}
                defaultSortField="department"
                defaultSortDirection="asc"
                expandable
                isLoading={isLoading}
                isRowExpanded={(row) => expandedDepartmentHistory === row.department}
                maxHeight={560}
                noDataText="ไม่พบประวัติการเบิกตามช่วงที่เลือก"
                onToggleRow={toggleDepartmentHistory}
                renderExpandedRow={(department) => (
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 900, mb: 1.25 }}>
                      รายการเบิกของ {department.department}
                    </Typography>
                    <AppTable
                      columns={departmentIssueDetailColumns}
                      defaultSortField="createdAt"
                      defaultSortDirection="desc"
                      maxHeight={360}
                      noDataText="ไม่พบรายการเบิกของแผนกนี้"
                      rowKey={(row) => `${row.documentNo}-${row.productCode}-${row.createdAt}`}
                      rows={department.rows}
                      showColumnFilters={false}
                    />
                  </Box>
                )}
                rowKey="department"
                rows={departmentHistoryGroups.map((department) => ({ ...department, onShowDepartmentIssueDetails: setSelectedDepartmentIssueDetails }))}
                showGlobalSearch
              />
            </Stack>
          </CardContent>
        </Card>
        <Dialog fullWidth maxWidth="sm" open={Boolean(selectedDepartmentIssueDetails)} onClose={() => setSelectedDepartmentIssueDetails(null)}>
          <DialogTitle>เลขที่ใบเบิก</DialogTitle>
          <DialogContent dividers>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
              ลูกค้า (แผนก): {selectedDepartmentIssueDetails?.department}
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1.25 }}>
              {selectedDepartmentIssueDetails?.issueDocumentNos?.split(', ').map((documentNo) => (
                <Typography key={documentNo}>{documentNo}</Typography>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedDepartmentIssueDetails(null)}>ปิด</Button>
          </DialogActions>
        </Dialog>
        </>
      ) : analysisReport ? (
        <>
        {!analysisReport.history ? (
          <>
            <Grid container spacing={2}>
              {[
                { label: 'จำนวนรายการ', value: analysisReport.rows.length.toLocaleString('th-TH'), color: '#60a5fa', icon: Package },
                { label: 'ปริมาณรวม', value: analysisReport.rows.reduce((sum, row) => sum + Number(row.totalQty ?? 0), 0).toLocaleString('th-TH'), color: '#a78bfa', icon: ShoppingCart },
                { label: 'มูลค่ารวม', value: `${analysisReport.rows.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`, color: '#14b8a6', icon: FileText },
              ].map((item) => <Grid key={item.label} size={{ xs: 12, md: 4 }}><StatCard {...item} helper={periodLabel} /></Grid>)}
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 4 }}>
                <DonutChart rows={analysisDonutRows} title={analysisByQuantity ? 'สัดส่วนตามปริมาณ' : 'สัดส่วนตามมูลค่า'} subtitle={periodLabel} legendValueLabel={analysisByQuantity ? '' : 'บาท'} totalLabel={analysisByQuantity ? 'ปริมาณรวม' : 'มูลค่ารวม (บาท)'} roundValues />
              </Grid>
              <Grid size={{ xs: 12, lg: 8 }}>
                <TimeTrendBarChart
                  rows={analysisMonthlyRows}
                  periodMode="monthly"
                  title={analysisIsPurchase ? (analysisByQuantity ? 'แนวโน้มปริมาณซื้อรายเดือน' : 'แนวโน้มยอดซื้อรายเดือน') : (analysisByQuantity ? 'แนวโน้มปริมาณเบิกรายเดือน' : 'แนวโน้มมูลค่าเบิกรายเดือน')}
                  subtitle={`ดู${analysisIsPurchase ? 'ยอดซื้อ' : 'ยอดเบิก'}แยกตามเดือนในปี ${selectedYear}`}
                  valueLabel={analysisByQuantity ? 'ปริมาณ' : 'มูลค่า (บาท)'}
                  valueUnit={analysisByQuantity ? 'จำนวน' : 'บาท'}
                />
              </Grid>
            </Grid>
          </>
        ) : null}
        <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>{analysisReport.title}</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>{analysisReport.subtitle}</Typography>
              </Box>
              <AppTable
                columns={analysisReport.columns}
                key={reportMode}
                defaultSortField={analysisReport.history ? 'label' : 'rank'}
                defaultSortDirection="asc"
                expandable={Boolean(analysisReport.history)}
                isRowExpanded={(row) => expandedAnalysisRow === row.key}
                onToggleRow={(row) => setExpandedAnalysisRow((current) => current === row.key ? '' : row.key)}
                renderExpandedRow={(row) => (
                  <AppTable columns={[{ key: 'supplierName', label: 'ผู้จำหน่าย', width: 200 }, ...supplierPurchaseDetailColumns]} rows={row.rows ?? []} rowKey={(item, index) => `${item.receiveHeaderId}-${item.productCode}-${index}`} defaultSortField="receivedAt" defaultSortDirection="desc" showColumnFilters={false} maxHeight={360} />
                )}
                isLoading={isLoading}
                maxHeight={560}
                noDataText="ไม่พบข้อมูลตามช่วงที่เลือก"
                rowKey={(row, index) => row.key ?? `${row.rank ?? index}-${row.label ?? row.productCode ?? row.poInvoiceNo ?? ''}`}
                rows={analysisReport.rows}
                showGlobalSearch
              />
            </Stack>
          </CardContent>
        </Card>
        </>
      ) : null}
      <Dialog
        open={pendingVatRate !== null}
        onClose={() => {
          setVatRate(savedVatRate)
          setVatInput(String(savedVatRate))
          setPendingVatRate(null)
        }}
      >
        <DialogTitle>ยืนยันการบันทึก VAT</DialogTitle>
        <DialogContent>
          <Typography>ต้องการบันทึก VAT จาก {savedVatRate}% เป็น {pendingVatRate ?? savedVatRate}% สำหรับเดือน {dayjs(dateRange.startDate).format('DD/MM/YYYY')} ใช่หรือไม่ โดยไม่เปลี่ยนอัตราของเดือนอื่น</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setVatRate(savedVatRate); setVatInput(String(savedVatRate)); setPendingVatRate(null) }}>ยกเลิก</Button>
          <Button
            variant="contained"
            disabled={isVatSaving}
            onClick={async () => {
              await saveVatRate(pendingVatRate)
            }}
          >
            ยืนยันบันทึก
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        autoHideDuration={3000}
        onClose={() => setVatSaveSuccess(false)}
        open={vatSaveSuccess}
      >
        <Alert severity="success" variant="filled" onClose={() => setVatSaveSuccess(false)}>
          บันทึก VAT สำเร็จ
        </Alert>
      </Snackbar>
    </Stack>
  )

}

export default ReportsPage
