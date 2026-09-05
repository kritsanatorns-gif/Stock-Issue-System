import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Camera, CheckCircle2, PackageCheck, Search, Send, Trash2 } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { createRequisition, getProducts, getRequisitions } from '../../api/api'
import { apiOrigin } from '../../api/apiConfig'
import { useRequestAuthStore } from '../../store/requestAuthStore'
import { formatDisplayDateTime, getThailandDateParts } from '../../utils/dateUtils'
import { normalizeWholeNumberInput } from '../../utils/inputGuards'

function normalizeProduct(row) {
  const productId = row.productId ?? row.ProductId ?? row.code ?? row.Code ?? ''
  const issueUnit = row.issueUnit ?? row.IssueUnit ?? row.unit ?? row.Unit ?? 'ชิ้น'

  return {
    barcode: row.barcode ?? row.Barcode ?? '',
    category: row.categoryName ?? row.CategoryName ?? row.category ?? row.Category ?? 'General',
    id: productId,
    imageName: row.imageName ?? row.ImageName ?? '',
    issueUnit,
    productId,
    productName: row.productName ?? row.ProductName ?? row.name ?? row.Name ?? productId,
    stockQty: Number(row.stockQty ?? row.StockQty ?? 0),
  }
}

function getImageUrl(imageName) {
  if (!imageName) {
    return ''
  }

  const normalizedImageName = String(imageName).trim()

  if (!/\.(jpg|jpeg|png|webp)$/i.test(normalizedImageName)) {
    return ''
  }

  if (/^https?:\/\//i.test(normalizedImageName)) {
    return normalizedImageName
  }

  const baseUrl = apiOrigin

  if (normalizedImageName.startsWith('/')) {
    return `${baseUrl}${normalizedImageName}`
  }

  if (normalizedImageName.startsWith('uploads/')) {
    return `${baseUrl}/${normalizedImageName}`
  }

  return `${baseUrl}/uploads/products/${normalizedImageName}`
}

function getStockStatus(product) {
  if (product.stockQty <= 0) {
    return { color: 'error', label: 'ของหมด' }
  }

  if (product.stockQty <= 10) {
    return { color: 'warning', label: 'ใกล้หมด' }
  }

  return { color: 'success', label: 'พร้อมเบิก' }
}

function getStockStatusValue(product) {
  if (product.stockQty <= 0) {
    return 'out'
  }

  if (product.stockQty <= 10) {
    return 'low'
  }

  return 'ready'
}

const stockStatusOptions = [
  { label: 'พร้อมเบิก', value: 'ready' },
  { label: 'ใกล้หมด', value: 'low' },
  { label: 'ของหมด', value: 'out' },
]

const MAX_ITEMS_PER_REQUEST = 25

function createRequestBarcodeDataUrl(requestNo) {
  const value = String(requestNo ?? '').trim()
  if (!value) return ''

  const canvas = document.createElement('canvas')
  JsBarcode(canvas, value, {
    displayValue: false,
    height: 28,
    margin: 0,
    width: 1.4,
  })

  return canvas.toDataURL('image/png')
}

function printRequestSlipOld({ department, items, remark, requesterName, requestNo = 'รอเลขคำขอ' }) {
  const printedAt = formatDisplayDateTime(new Date())
  const rows = items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.productId}</td>
      <td>${item.barcode || '-'}</td>
      <td>${item.productName}</td>
      <td>${item.category}</td>
      <td>${Number(item.quantity).toLocaleString('th-TH')}</td>
      <td>-</td>
      <td>${item.issueUnit}</td>
    </tr>
  `).join('')
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const printWindow = window.open('', '_blank', 'width=1000,height=800')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>ใบคำขอเบิกสินค้า</title>
        <style>
          body { color: #0f172a; font-family: Tahoma, Arial, sans-serif; margin: 32px; }
          h1 { font-size: 24px; margin: 0 0 4px; }
          .muted { color: #64748b; font-size: 12px; }
          .status { border: 1px solid #94a3b8; border-radius: 999px; display: inline-block; font-size: 12px; padding: 4px 14px; }
          .head { align-items: flex-start; display: flex; justify-content: space-between; margin-bottom: 24px; }
          .grid { display: grid; gap: 16px; grid-template-columns: repeat(4, 1fr); margin: 18px 0; }
          .label { color: #64748b; font-size: 11px; font-weight: 700; }
          .value { font-size: 14px; font-weight: 700; margin-top: 3px; }
          table { border-collapse: collapse; font-size: 12px; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
          th { background: #f8fafc; }
          td:nth-child(4) { text-align: left; }
          .remark { border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 18px; min-height: 56px; padding: 10px; }
          .signatures { display: grid; gap: 36px; grid-template-columns: repeat(2, 1fr); margin-top: 56px; }
          .line { border-top: 1px solid #334155; padding-top: 8px; text-align: center; }
          @media print { button { display: none; } body { margin: 18mm; } }
        </style>
      </head>
      <body>
        <div class="head">
          <div>
            <h1>ใบคำขอเบิกสินค้า</h1>
            <div class="muted">ระบบการเบิกสินค้าสำนักงาน</div>
          </div>
          <div class="status">รอ HR จัดของ</div>
        </div>
        <div class="grid">
          <div><div class="label">เลขที่คำขอ</div><div class="value">${requestNo}</div></div>
          <div><div class="label">วันที่พิมพ์</div><div class="value">${printedAt}</div></div>
          <div><div class="label">ผู้ขอเบิก</div><div class="value">${requesterName}</div></div>
          <div><div class="label">แผนก</div><div class="value">${department}</div></div>
          <div><div class="label">จำนวนรายการ</div><div class="value">${items.length} รายการ</div></div>
          <div><div class="label">จำนวนรวม</div><div class="value">${totalQty.toLocaleString('th-TH')} ชิ้น/หน่วย</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>รหัสสินค้า</th>
              <th>Barcode</th>
              <th>ชื่อสินค้า</th>
              <th>หมวดหมู่</th>
              <th>จำนวน</th>
              <th>ค้าง</th>
              <th>หน่วย</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="remark">
          <div class="label">หมายเหตุ</div>
          <div>${remark || '-'}</div>
        </div>
        <div class="signatures">
          <div class="line">ผู้ขอเบิก / แผนก</div>
          <div class="line">ผู้จ่ายสินค้า / HR</div>
        </div>
        <script>window.onload = () => { window.print() }</script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

function normalizeBacklogRequest(row) {
  const items = (row.items ?? row.Items ?? []).map((item, index) => {
    const quantity = Number(item.quantity ?? item.Quantity ?? 0)
    const fulfilledQty = Number(item.fulfilledQty ?? item.FulfilledQty ?? 0)
    const backlogQty = Number(item.backlogQty ?? item.BacklogQty ?? Math.max(0, quantity - fulfilledQty))

    return {
      backlogQty,
      category: item.category ?? item.Category ?? '',
      code: item.code ?? item.Code ?? '',
      detailId: item.detailId ?? item.DetailId ?? index + 1,
      fulfilledQty,
      productName: item.productName ?? item.ProductName ?? '',
      quantity,
      unit: item.unit ?? item.Unit ?? '',
    }
  })

  return {
    // StockHeader.Division เก็บแผนก
    department: row.division ?? row.Division ?? '',
    employeeId: Number(row.employeeId ?? row.EmployeeId ?? 0),
    headerId: Number(row.headerId ?? row.HeaderId ?? 0),
    items,
    requestNo: row.requestNo ?? row.RequestNo ?? '',
    statusId: Number(row.statusId ?? row.StatusId ?? 0),
  }
}

function buildCarryOverBacklogItems(rows, { currentHeaderId = 0, department = '', employeeId = 0 } = {}) {
  const normalizedDepartment = String(department ?? '').trim().toLowerCase()
  const normalizedEmployeeId = Number(employeeId || 0)

  return (rows ?? [])
    .map(normalizeBacklogRequest)
    .filter((row) => row.headerId !== Number(currentHeaderId || 0))
    .filter((row) => row.statusId === 8)
    .filter((row) => {
      if (normalizedEmployeeId && row.employeeId) {
        return row.employeeId === normalizedEmployeeId
      }

      return normalizedDepartment && String(row.department ?? '').trim().toLowerCase() === normalizedDepartment
    })
    .flatMap((row) =>
      row.items
        .filter((item) => Number(item.backlogQty) > 0)
        .map((item) => ({
          category: item.category,
          isCarryOverBacklog: true,
          issueUnit: item.unit,
          productName: item.productName,
          quantity: Number(item.backlogQty),
          remark: `ค้างจาก ${row.requestNo || 'ใบเดิม'}`,
          sourceRequestNo: row.requestNo,
        })),
    )
}

async function getCarryOverBacklogItems({ currentHeaderId, department, employeeId }) {
  try {
    const rows = await getRequisitions({ status: 'pending' })

    return buildCarryOverBacklogItems(rows, { currentHeaderId, department, employeeId })
  } catch {
    return []
  }
}

function printRequestSlip({ department, division = '', isUrgent = false, items, remark, requesterName, requestNo = '' }) {
  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const {
    day: requestDay,
    month: requestMonth,
    time: requestTime,
    year: requestYear,
  } = getThailandDateParts(new Date())
  const printItems = items
  const fixedRowCount = 25
  const stampText = isUrgent ? 'ด่วน' : ''
  const barcodeImage = createRequestBarcodeDataUrl(requestNo)
  const rows = printItems
    .map(
      (item, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="center">${escapeHtml(item.category || '')}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td class="center">${Number(item.quantity || 0).toLocaleString('th-TH')}</td>
          <td class="center">${escapeHtml(item.issueUnit)}</td>
          <td>${escapeHtml(item.remark || '')}</td>
        </tr>
      `,
    )
    .join('')
    + Array.from({ length: Math.max(0, fixedRowCount - printItems.length) }, (_, index) => `
      <tr>
        <td class="center">${printItems.length + index + 1}</td>
        <td></td><td></td><td></td><td></td><td></td>
      </tr>
    `).join('')
  const printWindow = window.open('', '_blank', 'width=900,height=900')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ใบเบิกของ</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 5mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            background: #fff;
            color: #000;
            font-family: Tahoma, Arial, sans-serif;
            font-size: 15px;
            margin: 0;
          }

          .sheet {
            border: 2px solid #111;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 287mm;
            padding: 3mm 1mm;
            position: relative;
            width: 100%;
          }

          .urgent-stamp {
            border: 2px solid #dc2626;
            color: #dc2626;
            display: ${stampText ? 'inline-flex' : 'none'};
            font-size: 22px;
            font-weight: 900;
            left: 5mm;
            letter-spacing: 1px;
            line-height: 1;
            padding: 6px 14px;
            position: absolute;
            top: 5mm;
          }

          .document-no {
            position: absolute;
            right: 5mm;
            text-align: right;
            top: 5mm;
          }

          .document-barcode {
            display: block;
            height: 28px;
            margin: 9px 0 0 auto;
            width: 145px;
          }

          .title {
            font-size: 28px;
            font-weight: 900;
            line-height: 1.1;
            margin-top: 20px;
            text-align: center;
          }

          .subtitle {
            margin-bottom: 4px;
            text-align: center;
          }

          .line {
            border-bottom: 1px solid #111;
            display: inline-block;
            min-height: 17px;
            padding: 0 5px 1px;
            vertical-align: bottom;
          }

          .line-xs {
            min-width: 36px;
          }

          .line-sm {
            min-width: 62px;
          }

          .line-md {
            min-width: 88px;
          }

          .line-lg {
            min-width: 260px;
          }

          .line-xl {
            min-width: 270px;
          }

          .top-section {
            display: grid;
            gap: 10px;
            grid-template-columns: minmax(0, 1fr) 310px;
            margin-top: 4px;
          }

          .approval-box {
            border: 1px solid #111;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .approval-cell {
            min-height: 96px;
            padding: 3px 6px;
            text-align: center;
          }

          .approval-cell + .approval-cell {
            border-left: 1px solid #111;
          }

          .approval-title {
            border-bottom: 1px solid #111;
            font-size: 11px;
            font-weight: 700;
            margin: -3px -6px 38px;
            padding: 3px 2px;
            white-space: nowrap;
          }

          .approval-sign-line {
            border-bottom: 1px solid #111;
            margin: 0 auto 9px;
            width: 82%;
          }

          .approval-date-line {
            font-size: 11px;
            line-height: 1;
            white-space: nowrap;
          }

          .field-row {
            margin-bottom: 4px;
            white-space: nowrap;
          }

          table {
            border-collapse: collapse;
            margin-top: 8px;
            page-break-inside: auto;
            width: 100%;
          }

          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          th,
          td {
            border: 1px solid #111;
            font-size: 12px;
            height: 28px;
            padding: 1px 3px;
            text-align: center;
            vertical-align: middle;
            word-break: break-word;
          }

          th {
            font-weight: 800;
            text-align: center;
          }

          .center {
            text-align: center;
          }

          .receive-section {
            display: grid;
            gap: 10px;
            grid-template-columns: minmax(0, 1fr) 310px;
            margin-top: 8px;
            padding-top: 8px;
          }

          .receiver-fields {
            padding-top: 8px;
          }

          .receiver-fields .field-row { margin-bottom: 10px; }
          .receiver-fields .field-row:last-child { margin-bottom: 0; }

          .remark-extra-line { margin-left: 0; margin-top: 6px; }
          .remark-extra-line .remark-line { max-width: 365px; width: 365px; }

          .bottom-sign-box {
            border: 1px solid #111;
            display: grid;
            grid-template-columns: 1fr 1fr;
            min-height: 90px;
          }

          .bottom-sign-box .approval-sign-line { margin-bottom: 9px; }

          .bottom-sign-cell {
            padding: 0 8px 6px;
            text-align: center;
          }

          .bottom-sign-cell + .bottom-sign-cell {
            border-left: 1px solid #111;
          }

          .bottom-sign-title {
            align-items: center;
            border-bottom: 1px solid #111;
            box-sizing: border-box;
            display: flex;
            font-size: 11px;
            font-weight: 700;
            height: 22px;
            justify-content: center;
            margin: 0 -8px 38px;
            padding: 4px;
            white-space: nowrap;
          }

          .remark-line {
            display: inline-block;
            margin-left: 6px;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            width: 300px;
          }

          .print-value {
            font-weight: 700;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .sheet {
              border: 2px solid #111;
            }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <div class="urgent-stamp">${escapeHtml(stampText)}</div>
          <div class="document-no">เลขที่เอกสาร <span class="line line-md">${escapeHtml(requestNo)}</span>${barcodeImage ? `<img class="document-barcode" src="${barcodeImage}" alt="${escapeHtml(requestNo)}" />` : ''}</div>
          <div class="title">ใบเบิกของ</div>
          <div class="subtitle">แผนกธุรการ ฝ่ายทรัพยากรบุคคล</div>

          <section class="top-section">
            <div>
              <div class="field-row">
                วันที่ส่งใบเบิก
                <span class="line line-xs print-value">${escapeHtml(requestDay)}</span>
                /
                <span class="line line-xs print-value">${escapeHtml(requestMonth)}</span>
                /
                <span class="line line-sm print-value">${escapeHtml(requestYear)}</span>
                เวลา
                <span class="line line-sm print-value">${escapeHtml(requestTime)}</span>
                น.
              </div>
              <div class="field-row">ชื่อ-สกุล ผู้ขอเบิก <span class="line line-xl print-value">${escapeHtml(requesterName)}</span></div>
              <div class="field-row">
                ฝ่าย
                <span class="line line-md print-value">${escapeHtml(division)}</span>
                แผนก
                <span class="line line-md print-value">${escapeHtml(department)}</span>
                หน่วย
                <span class="line line-md"></span>
              </div>
            </div>

            <div class="approval-box">
              <div class="approval-cell">
                <div class="approval-title">ผู้อนุมัติ (ผจก. แผนก)</div>
                <div class="approval-sign-line"></div>
                <div class="approval-date-line">____ / ____ / ____</div>
              </div>
              <div class="approval-cell">
                <div class="approval-title">ผู้อนุมัติ (รอง/ผจก.ฝ่าย)</div>
                <div class="approval-sign-line"></div>
                <div class="approval-date-line">____ / ____ / ____</div>
              </div>
            </div>
          </section>

          <table>
            <thead>
              <tr>
                <th style="width: 58px;">ลำดับ</th>
                <th style="width: 130px;">หมวด</th>
                <th style="width: 175px;">รายการ</th>
                <th style="width: 68px;">จำนวน</th>
                <th style="width: 72px;">หน่วยนับ</th>
                <th style="width: 180px;">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <section class="receive-section">
            <div class="receiver-fields">
              <div class="field-row">
                วันที่รับของ
                <span class="line line-xs"></span>
                /
                <span class="line line-xs"></span>
                /
                <span class="line line-sm"></span>
                เวลา
                <span class="line line-sm"></span>
                น.
              </div>
              <div class="field-row">ชื่อ-สกุล ผู้รับของ <span class="line line-lg"></span></div>
              <div class="field-row">หมายเหตุ <span class="line remark-line">${escapeHtml(remark?.trim() || '')}</span></div>
              <div class="remark-extra-line"><span class="line remark-line"></span></div>
            </div>

            <div class="bottom-sign-box">
              <div class="bottom-sign-cell">
                <div class="bottom-sign-title">ผู้รับของ</div>
                <div class="approval-sign-line"></div>
                <div class="approval-date-line">____ / ____ / ____</div>
              </div>
              <div class="bottom-sign-cell">
                <div class="bottom-sign-title">ผู้จ่าย (เจ้าหน้าที่ธุรการ)</div>
                <div class="approval-sign-line"></div>
                <div class="approval-date-line">____ / ____ / ____</div>
              </div>
            </div>
          </section>
        </main>
        <script>window.onload = () => { window.print() }</script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

function getEmployeeValue(employee, keys, fallback = '') {
  for (const key of keys) {
    if (employee?.[key] !== undefined && employee?.[key] !== null && employee?.[key] !== '') {
      return employee[key]
    }
  }

  return fallback
}

function RequestPage() {
  const employee = useRequestAuthStore((state) => state.employee)
  const isAuthenticated = useRequestAuthStore((state) => state.isAuthenticated)
  const expiresAt = useRequestAuthStore((state) => state.expiresAt)
  const [products, setProducts] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [isUrgent, setIsUrgent] = useState(false)
  const [urgentRemark, setUrgentRemark] = useState('')
  const [urgentTouched, setUrgentTouched] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loadError, setLoadError] = useState('')
  const employeeId = Number(getEmployeeValue(employee, ['id', 'employeeId', 'EmployeeId'], 0))
  const requesterName = getEmployeeValue(employee, ['employeeName', 'EmployeeName', 'name', 'username', 'Username'], 'ผู้ใช้งาน')
  const department = getEmployeeValue(employee, ['department', 'Department', 'employeeDepartment', 'EmployeeDepartment'], 'HR')
  const division = getEmployeeValue(employee, ['division', 'Division'], '')
  const isSessionActive = isAuthenticated && expiresAt && expiresAt > Date.now()

  useEffect(() => {
    async function loadProducts() {
      try {
        const rows = await getProducts()

        setProducts((rows ?? []).map(normalizeProduct))
      } catch {
        setLoadError('โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
      }
    }

    loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    return products.filter((item) =>
      (!keyword || `${item.productId} ${item.barcode} ${item.productName}`.toLowerCase().includes(keyword))
      && (!categoryFilter || item.category === categoryFilter)
      && (!statusFilter || getStockStatusValue(item) === statusFilter),
    )
  }, [categoryFilter, products, searchText, statusFilter])

  const categories = useMemo(
    () => Array.from(new Set(products.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')),
    [products],
  )

  if (!isSessionActive) {
    return <Navigate to="/request-login" replace />
  }

  const handleAddItem = (product) => {
    if (!selectedItems.some((item) => item.productId === product.productId) && selectedItems.length >= MAX_ITEMS_PER_REQUEST) {
      Swal.fire('ครบจำนวนรายการแล้ว', `ใบเบิกหนึ่งใบเลือกได้ไม่เกิน ${MAX_ITEMS_PER_REQUEST} รายการสินค้า`, 'warning')
      return
    }
    setSelectedItems((current) => {
      if (current.some((item) => item.productId === product.productId)) {
        return current
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
        },
      ]
    })
  }

  const handleToggleItem = (product) => {
    if (!selectedItems.some((item) => item.productId === product.productId) && selectedItems.length >= MAX_ITEMS_PER_REQUEST) {
      Swal.fire('ครบจำนวนรายการแล้ว', `ใบเบิกหนึ่งใบเลือกได้ไม่เกิน ${MAX_ITEMS_PER_REQUEST} รายการสินค้า`, 'warning')
      return
    }
    setSelectedItems((current) => {
      if (current.some((item) => item.productId === product.productId)) {
        return current.filter((item) => item.productId !== product.productId)
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
        },
      ]
    })
  }

  const handleQtyChange = (productId, value) => {
    const quantity = normalizeWholeNumberInput(value)

    setSelectedItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity,
            }
          : item,
      ),
    )
  }

  const handleRemoveItem = (productId) => {
    setSelectedItems((current) => current.filter((item) => item.productId !== productId))
  }

  const hasInvalidRequestQuantity = selectedItems.some(
    (item) => !String(item.quantity ?? '').trim() || Number(item.quantity) <= 0,
  )

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      Swal.fire('ยังไม่มีสินค้า', 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ', 'warning')
      return
    }

    const invalidItem = selectedItems.find((item) => Number(item.quantity) <= 0)

    if (invalidItem) {
      Swal.fire('จำนวนไม่ถูกต้อง', `กรุณาตรวจสอบจำนวนของ ${invalidItem.productName}`, 'warning')
      return
    }

    if (isUrgent && !urgentRemark.trim()) {
      setUrgentTouched(true)
      Swal.fire('กรุณาระบุเหตุผลเบิกด่วน', 'ถ้าเลือกเบิกด่วน ต้องใส่เหตุผลเพื่อให้ HR จัดลำดับงานได้ถูกต้อง', 'warning')
      return
    }

    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonText: 'ส่งคำขอ',
      icon: 'question',
      showCancelButton: true,
      text: 'ระบบจะส่งคำขอให้ HR อนุมัติ ยังไม่ตัดสต๊อกทันที',
      title: 'ยืนยันส่งคำขอเบิก',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      const submittedItems = selectedItems.map((item) => ({ ...item }))
      const savedRequest = await createRequisition({
        // StockHeader.Department เก็บฝ่าย, StockHeader.Division เก็บแผนก
        department: division,
        division: department,
        employeeId,
        isUrgent,
        requesterName,
        remark: '',
        urgentRemark: isUrgent ? urgentRemark.trim() : '',
        items: submittedItems.map((item, index) => ({
          barcode: item.barcode,
          category: item.category,
          code: item.productId,
          lineNo: index + 1,
          productName: item.productName,
          quantity: Number(item.quantity),
          unit: item.issueUnit,
        })),
      })

      setSelectedItems([])
      setIsUrgent(false)
      setUrgentRemark('')
      setUrgentTouched(false)
      const printResult = await Swal.fire({
        cancelButtonText: 'ไม่พิมพ์',
        confirmButtonText: 'พิมพ์ใบคำขอ',
        icon: 'success',
        showCancelButton: true,
        text: 'ส่งคำขอเบิกให้ HR แล้ว สามารถพิมพ์ใบคำขอไปแนบให้ HR จัดของได้',
        title: 'สำเร็จ',
      })

      if (printResult.isConfirmed) {
        printRequestSlip({
          department,
          division,
          isUrgent,
          items: submittedItems,
          remark: isUrgent ? urgentRemark.trim() : '',
          requesterName,
          requestNo: savedRequest?.requestNo ?? savedRequest?.RequestNo ?? 'รอเลขคำขอ',
        })

        // โหลดหน้าใหม่เพื่อให้ตัวเลขและสถานะที่หน้าประวัติคำขออัปเดตทันที
        window.location.assign('/request/history')
      }
    } catch (error) {
      Swal.fire('ไม่สำเร็จ', error?.response?.data ?? 'ส่งคำขอเบิกไม่สำเร็จ', 'error')
    }
  }

  return (
    <Box sx={{ bgcolor: '#f5f7fb', minHeight: '100vh', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 900 }}>คำขอเบิกสินค้า</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14 }}>
            เลือกสินค้าแล้วส่งคำขอให้ HR อนุมัติ
          </Typography>
        </Box>
        <Button
          color="inherit"
          sx={{ display: 'none' }}
          onClick={() => {
          }}
        >
          ออกจากระบบ
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>ฝ่าย</Typography>
              <Typography sx={{ fontWeight: 900 }}>{division || '-'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>ผู้ขอเบิก</Typography>
              <Typography sx={{ fontWeight: 900 }}>{requesterName}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>แผนก</Typography>
              <Typography sx={{ fontWeight: 900 }}>{department}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loadError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Search size={20} />
                <Typography sx={{ fontWeight: 900 }}>เลือกสินค้า</Typography>
              </Stack>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    fullWidth
                    placeholder="ค้นหาสินค้า / บาร์โค้ด / รหัสสินค้า"
                    size="small"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={18} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3.5 }}>
                  <TextField
                    fullWidth
                    select
                    label="หมวดหมู่"
                    size="small"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <MenuItem value="">ทั้งหมด</MenuItem>
                    {categories.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3.5 }}>
                  <TextField
                    fullWidth
                    select
                    label="สถานะ"
                    size="small"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <MenuItem value="">ทั้งหมด</MenuItem>
                    {stockStatusOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              {filteredProducts.length > 0 ? (
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: 'repeat(auto-fill, minmax(190px, 1fr))',
                      md: 'repeat(auto-fill, minmax(210px, 1fr))',
                    },
                    maxHeight: 'calc(100vh - 360px)',
                    overflowY: 'auto',
                    pr: 0.5,
                  }}
                >
                  {filteredProducts.map((product) => {
                    const imageUrl = getImageUrl(product.imageName)
                    const isSelected = selectedItems.some((item) => item.productId === product.productId)
                    const stockStatus = getStockStatus(product)

                    return (
                      <Card
                        key={product.productId}
                        variant="outlined"
                        sx={{
                          borderColor: isSelected ? '#2563eb' : '#d8e3f0',
                          boxShadow: isSelected ? '0 0 0 1px #2563eb' : '0 8px 22px rgba(15, 23, 42, 0.04)',
                          cursor: 'pointer',
                          height: '100%',
                          overflow: 'hidden',
                          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                          '&:hover': {
                            borderColor: isSelected ? '#2563eb' : '#93c5fd',
                            boxShadow: '0 12px 28px rgba(37, 99, 235, 0.12)',
                            transform: 'translateY(-1px)',
                          },
                        }}
                        onClick={() => handleToggleItem(product)}
                      >
                        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                          <Box
                            sx={{
                              alignItems: 'center',
                              bgcolor: '#eef4fb',
                              borderRadius: 1.5,
                              display: 'flex',
                              height: 132,
                              justifyContent: 'center',
                              mb: 1.25,
                              overflow: 'hidden',
                            }}
                          >
                            {imageUrl ? (
                              <Box
                                alt={product.productName}
                                component="img"
                                src={imageUrl}
                                sx={{
                                  height: '100%',
                                  objectFit: 'cover',
                                  width: '100%',
                                }}
                              />
                            ) : (
                              <Camera color="#94a3b8" size={30} />
                            )}
                          </Box>

                          <Stack
                            alignItems="flex-start"
                            direction="row"
                            justifyContent="space-between"
                            sx={{
                              gap: 1,
                              minHeight: 38,
                            }}
                          >
                            <Typography
                              title={product.productName}
                              sx={{
                                fontSize: 14,
                                fontWeight: 900,
                                lineHeight: 1.35,
                              }}
                            >
                              {product.productName}
                            </Typography>
                            <Checkbox
                              checked={isSelected}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleToggleItem(product)
                              }}
                              size="small"
                              sx={{
                                mt: -0.5,
                                p: 0.25,
                              }}
                              tabIndex={-1}
                            />
                          </Stack>
                          <Typography sx={{ color: '#64748b', fontSize: 12, mb: 1 }}>
                            {product.productId}
                          </Typography>

                          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1 }}>
                            <Chip label={product.category} size="small" />
                            <Chip color={stockStatus.color} label={stockStatus.label} size="small" />
                          </Stack>

                          <Typography sx={{ color: '#334155', fontSize: 12, mb: 1.25 }}>
                            คงเหลือ {product.stockQty.toLocaleString('th-TH')} {product.issueUnit}
                          </Typography>

                          <Button
                            fullWidth
                            size="small"
                            startIcon={isSelected ? <CheckCircle2 size={16} /> : null}
                            sx={{ mt: 0.5 }}
                            variant={isSelected ? 'outlined' : 'contained'}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleToggleItem(product)
                            }}
                          >
                            {isSelected ? 'เลือกแล้ว' : 'เลือกสินค้า'}
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </Box>
              ) : (
                <Alert severity="info">ไม่พบสินค้า</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid
          size={{ xs: 12, lg: 5 }}
          sx={{
            alignSelf: { lg: 'flex-start' },
            position: { lg: 'sticky' },
            top: { lg: 92 },
          }}
        >
          <Card
            sx={{
              maxHeight: { lg: 'calc(100vh - 100px)' },
              overflowY: { lg: 'auto' },
            }}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1}>
                  <PackageCheck size={20} />
                  <Typography sx={{ fontWeight: 900 }}>รายการที่ขอเบิก</Typography>
                </Stack>
                <Chip label={`${selectedItems.length}/${MAX_ITEMS_PER_REQUEST} รายการ`} size="small" />
              </Stack>
              <Stack divider={<Divider />} spacing={1.5}>
                {selectedItems.map((item) => (
                  <Box key={item.productId}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>{item.productName}</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 13 }}>{item.productId}</Typography>
                      </Box>
                      <Button
                        color="error"
                        size="small"
                        startIcon={<Trash2 size={16} />}
                        onClick={() => handleRemoveItem(item.productId)}
                      >
                        ลบ
                      </Button>
                    </Stack>
                    <Grid container spacing={1.5} sx={{ mt: 1 }}>
                      <Grid size={{ xs: 7 }}>
                        <TextField
                          error={!String(item.quantity ?? '').trim() || Number(item.quantity) <= 0}
                          fullWidth
                          helperText={!String(item.quantity ?? '').trim() || Number(item.quantity) <= 0 ? 'กรอกจำนวนมากกว่า 0' : ''}
                          label="จำนวนที่ขอเบิก"
                          size="small"
                          type="number"
                          value={item.quantity}
                          onChange={(event) => handleQtyChange(item.productId, event.target.value)}
                          slotProps={{
                            htmlInput: {
                              min: 1,
                              step: 1,
                            },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 5 }}>
                        <TextField disabled fullWidth label="หน่วย" size="small" value={item.issueUnit} />
                      </Grid>
                    </Grid>
                    <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.75 }}>
                      คงเหลือ {item.stockQty.toLocaleString('th-TH')} {item.issueUnit}
                    </Typography>
                  </Box>
                ))}
                {selectedItems.length === 0 ? (
                  <Alert severity="info">ยังไม่มีรายการ กรุณาเลือกสินค้าจากตารางด้านซ้าย</Alert>
                ) : null}
              </Stack>
              <Box
                sx={{
                  bgcolor: isUrgent ? '#fff7ed' : '#ffffff',
                  border: `1px solid ${isUrgent ? '#fed7aa' : '#e2e8f0'}`,
                  borderRadius: 2,
                  mt: 2,
                  p: 1.5,
                }}
              >
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={isUrgent}
                      onChange={(event) => {
                        setIsUrgent(event.target.checked)
                        setUrgentTouched(false)

                        if (!event.target.checked) {
                          setUrgentRemark('')
                        }
                      }}
                    />
                  )}
                  label={<Typography sx={{ fontWeight: 900 }}>เบิกด่วน</Typography>}
                />
                <Typography sx={{ color: '#64748b', fontSize: 12, mb: isUrgent ? 1 : 0 }}>
                  ใช้เฉพาะกรณีต้องการให้ HR เห็นและจัดของก่อนรายการทั่วไป
                </Typography>
                {isUrgent ? (
                  <TextField
                    error={urgentTouched && !urgentRemark.trim()}
                    fullWidth
                    helperText={urgentTouched && !urgentRemark.trim() ? 'กรุณาระบุเหตุผลเบิกด่วน' : 'เหตุผลนี้จะแสดงให้ HR เห็นในรายการขอเบิก'}
                    label="เหตุผลเบิกด่วน *"
                    multiline
                    minRows={2}
                    value={urgentRemark}
                    onBlur={() => setUrgentTouched(true)}
                    onChange={(event) => setUrgentRemark(event.target.value)}
                  />
                ) : null}
              </Box>
              <Button
                disabled={selectedItems.length === 0 || hasInvalidRequestQuantity}
                fullWidth
                size="large"
                startIcon={<Send size={18} />}
                sx={{ mt: 2 }}
                variant="contained"
                onClick={handleSubmit}
              >
                ส่งคำขอเบิก
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default RequestPage

