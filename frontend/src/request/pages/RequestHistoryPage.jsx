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
  Typography,
} from '@mui/material'
import { ClipboardList, FileDown, Printer, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getRequisitions } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { useRequestAuthStore } from '../../store/requestAuthStore'
import { formatDisplayDateTime, getThailandDateParts } from '../../utils/dateUtils'

function normalizeRequisition(row) {
  const items = (row.items ?? row.Items ?? []).map((item, index) => {
    const quantity = Number(item.quantity ?? item.Quantity ?? 0)
    const fulfilledQty = Number(item.fulfilledQty ?? item.FulfilledQty ?? 0)

    return {
      availableQty: Number(item.availableQty ?? item.AvailableQty ?? 0),
      backlogQty: Number(item.backlogQty ?? item.BacklogQty ?? Math.max(0, quantity - fulfilledQty)),
      barcode: item.barcode ?? item.Barcode ?? '',
      category: item.category ?? item.Category ?? '',
      code: item.code ?? item.Code ?? '',
      detailId: item.detailId ?? item.DetailId ?? index + 1,
      fulfilledQty,
      lineNo: item.lineNo ?? item.LineNo ?? index + 1,
      productName: item.productName ?? item.ProductName ?? '',
      quantity,
      unit: item.unit ?? item.Unit ?? '',
    }
  })
  const requestedQty = items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    createdAt: row.createdAt ?? row.CreatedAt ?? '',
    department: row.department ?? row.Department ?? '',
    employeeId: Number(row.employeeId ?? row.EmployeeId ?? 0),
    employeeName: row.employeeName ?? row.EmployeeName ?? '',
    headerId: row.headerId ?? row.HeaderId ?? '',
    isUrgent: Boolean(row.isUrgent ?? row.IsUrgent ?? false),
    items,
    remark: row.remark ?? row.Remark ?? '',
    requestNo: row.requestNo ?? row.RequestNo ?? '',
    status: row.status ?? row.Status ?? '',
    statusId: Number(row.statusId ?? row.StatusId ?? 0),
    totalItems: Number(row.totalItems ?? row.TotalItems ?? items.length),
    totalQty: requestedQty || Number(row.totalQty ?? row.TotalQty ?? 0),
    urgentRemark: row.urgentRemark ?? row.UrgentRemark ?? '',
    userRemark: row.userRemark ?? row.UserRemark ?? '',
  }
}

function getRequestSlipRemark(row) {
  return (row.userRemark || row.urgentRemark || '').trim()
}

function getSlipQtyValue(item, key, fallback = 0) {
  const value = item?.[key] ?? item?.[key.charAt(0).toUpperCase() + key.slice(1)] ?? fallback

  return Number(value || 0)
}

function getHistorySlipRows(row) {
  const rawItems = row?.items ?? []
  const hasBacklog =
    Number(row?.statusId ?? row?.StatusId ?? 0) === 8 ||
    rawItems.some((item) => {
      const requestedQty = getSlipQtyValue(item, 'quantity')
      const fulfilledQty = getSlipQtyValue(item, 'fulfilledQty')
      const backlogQty = getSlipQtyValue(item, 'backlogQty', Math.max(0, requestedQty - fulfilledQty))

      return backlogQty > 0 && fulfilledQty > 0
    })

  const rows = rawItems
    .map((item) => {
      const requestedQty = getSlipQtyValue(item, 'quantity')
      const fulfilledQty = getSlipQtyValue(item, 'fulfilledQty')
      const backlogQty = getSlipQtyValue(item, 'backlogQty', Math.max(0, requestedQty - fulfilledQty))
      return {
        backlogQty,
        category: item.category ?? item.Category ?? '',
        fulfilledQty,
        isCarryOverBacklog: Boolean(item.isCarryOverBacklog ?? item.IsCarryOverBacklog),
        productName: item.productName ?? item.ProductName ?? '',
        requestedQty,
        remark: item.remark ?? item.Remark ?? '',
        unit: item.unit ?? item.Unit ?? '',
      }
    })
    .filter((item) => item.requestedQty > 0)

  return { hasBacklog, rows }
}

function getSlipModeConfig() {
  return {
    isPaidSlip: false,
    noteHeader: 'หมายเหตุ',
    qtyHeader: 'จำนวน',
    showBacklog: true,
    stampFallback: '',
  }
}

function getSlipRowsForMode(rows) {
  return rows
    .map((item) => ({
      ...item,
      displayQty: Number(item.requestedQty || 0),
      displayRemark: item.remark,
    }))
}

export function buildPrintableRowWithBacklog(row, requestRows) {
  if (!row) {
    return row
  }

  const currentRequestNo = String(row.requestNo ?? '')
  const currentItems = row.items ?? []
  const carryOverItems = (requestRows ?? [])
    .filter((request) => String(request.requestNo ?? '') !== currentRequestNo)
    .filter((request) => request.statusId === 8)
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

const REQUEST_STATUS_META = {
  6: {
    background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
    border: '#bfdbfe',
    chip: '#2563eb',
    label: 'รอจัดของ',
  },
  7: {
    background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
    border: '#bbf7d0',
    chip: '#15803d',
    label: 'ได้ของครบ',
  },
  8: {
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)',
    border: '#fed7aa',
    chip: '#ea580c',
    label: 'ค้าง',
  },
  9: {
    background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
    border: '#fecaca',
    chip: '#dc2626',
    label: 'ไม่ให้เบิก',
  },
}

function getRequestStatusMeta(row) {
  return REQUEST_STATUS_META[row.statusId] ?? {
    background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
    border: '#cbd5e1',
    chip: '#64748b',
    label: row.status || 'รอจัดของ',
  }
}

function getRequestSlipStamp(row, hasBacklog) {
  const statusText = String(row.status ?? row.Status ?? '').replace(/\s/g, '')
  const isUrgent = Boolean(row.isUrgent ?? row.IsUrgent)
  const items = row.items ?? row.Items ?? []
  const hasCarryOverBacklog =
    Boolean(row.hasCarryOverBacklog ?? row.HasCarryOverBacklog) ||
    items.some((item) => Boolean(item.isCarryOverBacklog ?? item.IsCarryOverBacklog))
  const hasNewItems = items.some((item) => {
    const isCarryOver = Boolean(item.isCarryOverBacklog ?? item.IsCarryOverBacklog)
    const quantity = Number(item.quantity ?? item.Quantity ?? 0)

    return !isCarryOver && quantity > 0
  })
  const isBacklog = hasBacklog || statusText.includes('ค้าง')
  const isComplete = statusText.includes('ได้ของครบ') || statusText.includes('ครบ') || statusText.includes('งานจบ')
  const parts = []

  if (isUrgent) {
    parts.push('ด่วน')
  }

  if (hasCarryOverBacklog && hasNewItems) {
    parts.push('เบิกใหม่')
  }

  if (isBacklog || hasCarryOverBacklog) {
    parts.push('ค้าง')
  } else if (isComplete) {
    parts.push('ได้ของครบ')
  }

  return parts.join(' / ')
}

function getRequestSlipStampColor(slipStamp) {
  return slipStamp.includes('ได้ของครบ') && !slipStamp.includes('ค้าง') && !slipStamp.includes('ด่วน')
    ? '#15803d'
    : '#dc2626'
}

function printHistorySlipOld(row) {
  const requestRemark = getRequestSlipRemark(row)
  const items = (row.items ?? []).map((item) => ({
    barcode: item.barcode ?? item.Barcode ?? '-',
    category: item.category ?? item.Category ?? '-',
    productId: item.code ?? item.Code ?? '-',
    productName: item.productName ?? item.ProductName ?? '-',
    quantity: Number(item.quantity ?? item.Quantity ?? 0),
    unit: item.unit ?? item.Unit ?? '',
  }))
  const printedAt = formatDisplayDateTime(new Date())
  const rows = items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.productId}</td>
      <td>${item.barcode}</td>
      <td>${item.productName}</td>
      <td>${item.category}</td>
      <td>${item.quantity.toLocaleString('th-TH')}</td>
      <td>${item.unit}</td>
    </tr>
  `).join('')
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
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
          <div class="status">${row.status || 'รอ HR จัดของ'}</div>
        </div>
        <div class="grid">
          <div><div class="label">เลขที่คำขอ</div><div class="value">${row.requestNo || '-'}</div></div>
          <div><div class="label">วันที่พิมพ์</div><div class="value">${printedAt}</div></div>
          <div><div class="label">ผู้ขอเบิก</div><div class="value">${row.employeeName || '-'}</div></div>
          <div><div class="label">แผนก</div><div class="value">${row.department || '-'}</div></div>
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
              <th>หน่วย</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="remark">
          <div class="label">หมายเหตุ</div>
          <div>${requestRemark || '-'}</div>
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

export function printHistorySlip(row) {
  if (!row) {
    return
  }

  const requestRemark = getRequestSlipRemark(row)
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
  } = getThailandDateParts(row.createdAt)
  const { hasBacklog, rows: slipRows } = getHistorySlipRows(row)
  const modeConfig = getSlipModeConfig()
  const displayRows = getSlipRowsForMode(slipRows)

  if (displayRows.length === 0) {
    window.alert('ไม่มีรายการสำหรับพิมพ์ใบนี้')
    return
  }

  const slipStamp = getRequestSlipStamp(row, hasBacklog) || modeConfig.stampFallback
  const slipStampColor = getRequestSlipStampColor(slipStamp)
  const rowsHtml = displayRows
    .map(
      (item, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="center">${escapeHtml(item.category)}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td class="center">${item.displayQty.toLocaleString('th-TH')}</td>
          ${modeConfig.showBacklog ? `<td class="center">${item.backlogQty > 0 ? item.backlogQty.toLocaleString('th-TH') : '-'}</td>` : ''}
          <td class="center">${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.displayRemark || '')}</td>
        </tr>
      `,
    )
    .join('')
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
          @page { size: A4 portrait; margin: 5mm; }
          * { box-sizing: border-box; }
          body { background: #fff; color: #000; font-family: Tahoma, Arial, sans-serif; font-size: 13px; margin: 0; }
          .sheet { border: 2px solid #111; padding: 5mm 1mm; position: relative; width: 100%; }
          .urgent-stamp {
            border: 2px solid ${slipStampColor};
            color: ${slipStampColor};
            display: ${slipStamp ? 'inline-flex' : 'none'};
            font-size: 22px;
            font-weight: 900;
            left: 5mm;
            letter-spacing: 1px;
            line-height: 1;
            padding: 6px 14px;
            position: absolute;
            top: 5mm;
          }
          .document-no { margin-bottom: 2px; text-align: right; }
          .title { font-size: 30px; font-weight: 900; line-height: 1.1; text-align: center; }
          .subtitle { margin-bottom: 8px; text-align: center; }
          .line { border-bottom: 1px solid #111; display: inline-block; min-height: 17px; padding: 0 5px 1px; vertical-align: bottom; }
          .line-xs { min-width: 36px; }
          .line-sm { min-width: 62px; }
          .line-md { min-width: 88px; }
          .line-xl { min-width: 270px; }
          .top-section { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) 280px; margin-top: 8px; }
          .field-row { margin-bottom: 8px; white-space: nowrap; }
          .approval-box { border: 1px solid #111; display: grid; grid-template-columns: 1fr 1fr; }
          .approval-cell { min-height: 82px; padding: 3px 6px; text-align: center; }
          .approval-cell + .approval-cell { border-left: 1px solid #111; }
          .approval-title { border-bottom: 1px solid #111; font-size: 11px; font-weight: 700; margin: -3px -6px 36px; padding: 3px 2px; white-space: nowrap; }
          .approval-sign-line { border-bottom: 1px solid #111; margin: 0 auto 6px; width: 82%; }
          .approval-date-line { font-size: 11px; line-height: 1; white-space: nowrap; }
          table { border-collapse: collapse; margin-top: 16px; page-break-inside: auto; width: 100%; }
          thead { display: table-header-group; }
          tr { page-break-after: auto; page-break-inside: avoid; }
          th, td { border: 1px solid #111; font-size: 12px; height: 29px; padding: 3px 5px; vertical-align: middle; word-break: break-word; }
          th { font-weight: 800; text-align: center; }
          .center { text-align: center; }
          .receive-section { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) 280px; margin-top: 20px; }
          .receiver-fields { padding-top: 18px; }
          .bottom-sign-box { border: 1px solid #111; display: grid; grid-template-columns: 1fr 1fr; min-height: 104px; }
          .bottom-sign-cell { padding: 0 8px 6px; text-align: center; }
          .bottom-sign-cell + .bottom-sign-cell { border-left: 1px solid #111; }
          .bottom-sign-title { align-items: center; border-bottom: 1px solid #111; box-sizing: border-box; display: flex; font-size: 11px; font-weight: 700; height: 28px; justify-content: center; margin: 0 -8px 42px; padding: 4px 2px; white-space: nowrap; }
          .remark-line { display: inline-block; margin-left: 6px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 300px; }
          .print-value { font-weight: 700; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .sheet { border: 2px solid #111; }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <div class="urgent-stamp">${escapeHtml(slipStamp)}</div>
          <div class="document-no">เลขที่เอกสาร <span class="line line-md">${escapeHtml(row.requestNo || '')}</span></div>
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
              <div class="field-row">ชื่อ-สกุล ผู้ขอเบิก <span class="line line-xl print-value">${escapeHtml(row.employeeName || '')}</span></div>
              <div class="field-row">
                ฝ่าย
                <span class="line line-md print-value">${escapeHtml(row.department || '')}</span>
                แผนก
                <span class="line line-md print-value">${escapeHtml(row.department || '')}</span>
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
                <th style="width: 70px;">หมวด</th>
                <th style="width: 135px;">รายการ</th>
                <th style="width: 68px;">${modeConfig.qtyHeader}</th>
                ${modeConfig.showBacklog ? '<th style="width: 58px;">ค้าง</th>' : ''}
                <th style="width: 72px;">หน่วยนับ</th>
                <th style="width: ${modeConfig.showBacklog ? 220 : 278}px;">${modeConfig.noteHeader}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
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
              <div class="field-row">ชื่อ-สกุล ผู้รับของ <span class="line line-xl"></span></div>
              <div class="field-row">หมายเหตุ <span class="line remark-line">${escapeHtml(requestRemark)}</span></div>
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

function buildRequestPdfHtml(row) {
  const requestRemark = getRequestSlipRemark(row)
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
  } = getThailandDateParts(row.createdAt)
  const { hasBacklog, rows: slipRows } = getHistorySlipRows(row)
  const modeConfig = getSlipModeConfig()
  const displayRows = getSlipRowsForMode(slipRows)

  if (displayRows.length === 0) {
    return ''
  }

  const slipStamp = getRequestSlipStamp(row, hasBacklog) || modeConfig.stampFallback
  const slipStampColor = getRequestSlipStampColor(slipStamp)
  const rowsHtml = displayRows
    .map(
      (item, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="center">${escapeHtml(item.category)}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td class="center">${item.displayQty.toLocaleString('th-TH')}</td>
          ${modeConfig.showBacklog ? `<td class="center">${item.backlogQty > 0 ? item.backlogQty.toLocaleString('th-TH') : '-'}</td>` : ''}
          <td class="center">${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.displayRemark || '')}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <style>
      .request-pdf-sheet {
        background: #fff;
        border: 2px solid #111;
        box-sizing: border-box;
        color: #000;
        font-family: Tahoma, Arial, sans-serif;
        font-size: 13px;
        padding: 22px 4px;
        position: relative;
        width: 794px;
      }
      .request-pdf-urgent {
        border: 2px solid ${slipStampColor};
        color: ${slipStampColor};
        display: ${slipStamp ? 'inline-flex' : 'none'};
        font-size: 22px;
        font-weight: 900;
        left: 22px;
        letter-spacing: 1px;
        line-height: 1;
        padding: 6px 14px;
        position: absolute;
        top: 22px;
      }
      .request-pdf-docno { margin-bottom: 2px; text-align: right; }
      .request-pdf-title { font-size: 30px; font-weight: 900; line-height: 1.1; text-align: center; }
      .request-pdf-subtitle { margin-bottom: 8px; text-align: center; }
      .request-pdf-line {
        border-bottom: 1px solid #111;
        display: inline-block;
        min-height: 17px;
        padding: 0 5px 1px;
        vertical-align: bottom;
      }
      .request-pdf-xs { min-width: 36px; }
      .request-pdf-sm { min-width: 62px; }
      .request-pdf-md { min-width: 88px; }
      .request-pdf-xl { min-width: 270px; }
      .request-pdf-top { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) 280px; margin-top: 8px; }
      .request-pdf-row { margin-bottom: 8px; white-space: nowrap; }
      .request-pdf-approval { border: 1px solid #111; display: grid; grid-template-columns: 1fr 1fr; }
      .request-pdf-approval-cell { min-height: 82px; padding: 3px 6px; text-align: center; }
      .request-pdf-approval-cell + .request-pdf-approval-cell { border-left: 1px solid #111; }
      .request-pdf-approval-title { border-bottom: 1px solid #111; font-size: 11px; font-weight: 700; margin: -3px -6px 36px; padding: 3px 2px; white-space: nowrap; }
      .request-pdf-sign-line { border-bottom: 1px solid #111; margin: 0 auto 6px; width: 82%; }
      .request-pdf-date-line { font-size: 11px; line-height: 1; white-space: nowrap; }
      .request-pdf-table { border-collapse: collapse; margin-top: 16px; width: 100%; }
      .request-pdf-table th,
      .request-pdf-table td { border: 1px solid #111; font-size: 12px; height: 29px; padding: 3px 5px; vertical-align: middle; word-break: break-word; }
      .request-pdf-table th { font-weight: 800; text-align: center; }
      .center { text-align: center; }
      .request-pdf-receive { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) 280px; margin-top: 20px; }
      .request-pdf-receiver-fields { padding-top: 18px; }
      .request-pdf-bottom-box { border: 1px solid #111; display: grid; grid-template-columns: 1fr 1fr; min-height: 104px; }
      .request-pdf-bottom-cell { padding: 0 8px 6px; text-align: center; }
      .request-pdf-bottom-cell + .request-pdf-bottom-cell { border-left: 1px solid #111; }
      .request-pdf-bottom-title { border-bottom: 1px solid #111; font-size: 11px; font-weight: 700; margin: 0 -8px 42px; padding: 4px 2px; white-space: nowrap; }
      .request-pdf-remark { display: inline-block; margin-left: 6px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 300px; }
      .request-pdf-value { font-weight: 700; }
    </style>
    <main class="request-pdf-sheet">
      <div class="request-pdf-urgent">${escapeHtml(slipStamp)}</div>
      <div class="request-pdf-docno">เลขที่เอกสาร <span class="request-pdf-line request-pdf-md">${escapeHtml(row.requestNo || '')}</span></div>
      <div class="request-pdf-title">ใบเบิกของ</div>
      <div class="request-pdf-subtitle">แผนกธุรการ ฝ่ายทรัพยากรบุคคล</div>

      <section class="request-pdf-top">
        <div>
          <div class="request-pdf-row">
            วันที่ส่งใบเบิก
            <span class="request-pdf-line request-pdf-xs request-pdf-value">${escapeHtml(requestDay)}</span>
            /
            <span class="request-pdf-line request-pdf-xs request-pdf-value">${escapeHtml(requestMonth)}</span>
            /
            <span class="request-pdf-line request-pdf-sm request-pdf-value">${escapeHtml(requestYear)}</span>
            เวลา
            <span class="request-pdf-line request-pdf-sm request-pdf-value">${escapeHtml(requestTime)}</span>
            น.
          </div>
          <div class="request-pdf-row">ชื่อ-สกุล ผู้ขอเบิก <span class="request-pdf-line request-pdf-xl request-pdf-value">${escapeHtml(row.employeeName || '')}</span></div>
          <div class="request-pdf-row">
            ฝ่าย
            <span class="request-pdf-line request-pdf-md request-pdf-value">${escapeHtml(row.department || '')}</span>
            แผนก
            <span class="request-pdf-line request-pdf-md request-pdf-value">${escapeHtml(row.department || '')}</span>
            หน่วย
            <span class="request-pdf-line request-pdf-md"></span>
          </div>
        </div>

        <div class="request-pdf-approval">
          <div class="request-pdf-approval-cell">
            <div class="request-pdf-approval-title">ผู้อนุมัติ (ผจก. แผนก)</div>
            <div class="request-pdf-sign-line"></div>
            <div class="request-pdf-date-line">____ / ____ / ____</div>
          </div>
          <div class="request-pdf-approval-cell">
            <div class="request-pdf-approval-title">ผู้อนุมัติ (รอง/ผจก.ฝ่าย)</div>
            <div class="request-pdf-sign-line"></div>
            <div class="request-pdf-date-line">____ / ____ / ____</div>
          </div>
        </div>
      </section>

      <table class="request-pdf-table">
        <thead>
          <tr>
            <th style="width: 58px;">ลำดับ</th>
            <th style="width: 70px;">หมวด</th>
            <th style="width: 135px;">รายการ</th>
            <th style="width: 68px;">${modeConfig.qtyHeader}</th>
            ${modeConfig.showBacklog ? '<th style="width: 58px;">ค้าง</th>' : ''}
            <th style="width: 72px;">หน่วยนับ</th>
            <th style="width: ${modeConfig.showBacklog ? 220 : 278}px;">${modeConfig.noteHeader}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <section class="request-pdf-receive">
        <div class="request-pdf-receiver-fields">
          <div class="request-pdf-row">
            วันที่รับของ
            <span class="request-pdf-line request-pdf-xs"></span>
            /
            <span class="request-pdf-line request-pdf-xs"></span>
            /
            <span class="request-pdf-line request-pdf-sm"></span>
            เวลา
            <span class="request-pdf-line request-pdf-sm"></span>
            น.
          </div>
          <div class="request-pdf-row">ชื่อ-สกุล ผู้รับของ <span class="request-pdf-line request-pdf-xl"></span></div>
          <div class="request-pdf-row">หมายเหตุ <span class="request-pdf-line request-pdf-remark">${escapeHtml(requestRemark)}</span></div>
        </div>
        <div class="request-pdf-bottom-box">
          <div class="request-pdf-bottom-cell">
            <div class="request-pdf-bottom-title">ผู้รับของ</div>
            <div class="request-pdf-sign-line"></div>
            <div class="request-pdf-date-line">____ / ____ / ____</div>
          </div>
          <div class="request-pdf-bottom-cell">
            <div class="request-pdf-bottom-title">ผู้จ่าย (เจ้าหน้าที่ธุรการ)</div>
            <div class="request-pdf-sign-line"></div>
            <div class="request-pdf-date-line">____ / ____ / ____</div>
          </div>
        </div>
      </section>
    </main>
  `
}

export async function downloadHistorySlipPdf(row) {
  if (!row) {
    return
  }

  const html = buildRequestPdfHtml(row)

  if (!html) {
    window.alert('ไม่มีรายการสำหรับดาวน์โหลด PDF ใบนี้')
    return
  }

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
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container.querySelector('.request-pdf-sheet'), {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })
    const imageData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const pdfMarginX = 8
    const pdfMarginY = 8
    const pdfWidth = pageWidth - pdfMarginX * 2
    const pdfHeight = pageHeight - pdfMarginY * 2
    const imageHeight = (canvas.height * pdfWidth) / canvas.width
    let heightLeft = imageHeight
    let position = pdfMarginY

    pdf.addImage(imageData, 'PNG', pdfMarginX, position, pdfWidth, imageHeight)
    heightLeft -= pdfHeight

    while (heightLeft > 0) {
      position = heightLeft - imageHeight + pdfMarginY
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', pdfMarginX, position, pdfWidth, imageHeight)
      heightLeft -= pdfHeight
    }

    pdf.save(`${row.requestNo || 'request-slip'}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

function RequestHistoryPage() {
  const employee = useRequestAuthStore((state) => state.employee)
  const [rows, setRows] = useState([])
  const [loadError, setLoadError] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [remarkRow, setRemarkRow] = useState(null)
  const employeeId = Number(employee?.employeeId ?? 0)
  const employeeName = employee?.employeeName ?? employee?.name ?? employee?.username ?? ''
  const department = employee?.department ?? ''

  const loadRows = useCallback(async () => {
    setLoadError('')

    try {
      const data = await getRequisitions()
      const normalizedRows = (data ?? []).map(normalizeRequisition)

      setRows(
        normalizedRows.filter((row) => {
          const sameEmployeeId = employeeId > 0 && row.employeeId === employeeId
          const sameName = employeeName && row.employeeName === employeeName
          const sameDepartment = department && row.department === department

          return sameEmployeeId || (sameName && sameDepartment)
        }),
      )
    } catch {
      setLoadError('โหลดประวัติคำขอเบิกไม่สำเร็จ กรุณาตรวจสอบ Backend API')
      setRows([])
    }
  }, [department, employeeId, employeeName])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const getStatusCount = (statusId) => rows.filter((row) => row.statusId === statusId).length

  const requestStatusStyle = (row) => {
    const meta = getRequestStatusMeta(row)

    return { backgroundColor: meta.chip, color: '#fff', label: meta.label }
  }

  const requestStatusCards = [
    {
      background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
      border: '#bfdbfe',
      count: rows.length,
      label: 'ทั้งหมด',
    },
    {
      ...REQUEST_STATUS_META[6],
      count: getStatusCount(6),
    },
    {
      ...REQUEST_STATUS_META[8],
      count: getStatusCount(8),
    },
    {
      ...REQUEST_STATUS_META[7],
      count: getStatusCount(7),
    },
    {
      ...REQUEST_STATUS_META[9],
      count: getStatusCount(9),
    },
  ]

  const columns = [
    {
      key: 'createdAt',
      label: 'วันที่ขอเบิก',
      width: 170,
      value: (row) => formatDisplayDateTime(row.createdAt),
      sortValue: (row) => Number(row.headerId ?? 0),
    },
    { key: 'requestNo', label: 'เลขที่คำขอ', width: 150 },
    {
      key: 'isUrgent',
      label: 'เบิกด่วน',
      width: 100,
      align: 'center',
      value: (row) => (row.isUrgent ? 'เบิกด่วน' : ''),
      render: (row) => (
        row.isUrgent ? (
          <Chip color="error" label="ด่วน" size="small" sx={{ fontWeight: 900 }} />
        ) : (
          <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>-</Typography>
        )
      ),
    },
    {
      key: 'status',
      label: 'สถานะ',
      width: 140,
      render: (row) => {
        const statusStyle = requestStatusStyle(row)

        return (
          <Chip
            label={statusStyle.label}
            size="small"
            sx={{
              backgroundColor: statusStyle.backgroundColor,
              color: statusStyle.color,
              fontWeight: 800,
            }}
          />
        )
      },
    },
    { key: 'totalItems', label: 'จำนวนรายการ', width: 130, align: 'center' },
    { key: 'totalQty', label: 'จำนวนรวม', width: 130, align: 'center' },
    {
      key: 'remark',
      label: 'หมายเหตุ',
      width: 150,
      value: (row) => row.remark || '',
      render: (row) =>
        row.remark ? (
          <Button size="small" variant="outlined" onClick={() => setRemarkRow(row)}>
            ดูหมายเหตุ
          </Button>
        ) : (
          <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>-</Typography>
        ),
    },
    {
      key: 'actions',
      label: 'รายการ',
      width: 120,
      searchable: false,
      sortable: false,
      render: (row) => (
          <Button size="small" variant="outlined" onClick={() => setSelectedRow(row)}>
            ดูรายการ
          </Button>
      ),
    },
  ]

  const detailColumns = [
    { key: 'lineNo', label: 'ลำดับ', width: 70 },
    { key: 'code', label: 'รหัสสินค้า', width: 150 },
    { key: 'productName', label: 'ชื่อสินค้า', width: 260 },
    { key: 'category', label: 'หมวดหมู่', width: 130 },
    { key: 'quantity', label: 'จำนวนที่ขอ', width: 100, align: 'center' },
    { key: 'fulfilledQty', label: 'จ่ายแล้ว', width: 90, align: 'center' },
    { key: 'backlogQty', label: 'ยังค้าง', width: 90, align: 'center' },
    { key: 'unit', label: 'หน่วย', width: 90, align: 'center' },
  ]

  return (
    <Box>
      <Stack alignItems="flex-start" direction="row" justifyContent="space-between" sx={{ mb: 2, width: '100%' }}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 900 }}>ประวัติของฉัน</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14 }}>
            ดูคำขอเบิกสินค้าและสถานะรายการของตัวเอง
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <Button startIcon={<RefreshCw size={18} />} variant="outlined" onClick={loadRows}>
            รีเฟรช
          </Button>
        </Box>
      </Stack>

      {loadError ? <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert> : null}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {requestStatusCards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, md: 2.4 }}>
            <Card sx={{ border: `1px solid ${card.border}`, background: card.background }}>
              <CardContent>
                <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 800 }}>{card.label}</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{card.count.toLocaleString('th-TH')}</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12 }}>จำนวนคำขอ</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent>
          <AppTable
            columns={columns}
            defaultSortField="createdAt"
            defaultSortDirection="desc"
            fitToWidth
            maxHeight="calc(100vh - 390px)"
            noDataText="ยังไม่มีประวัติคำขอเบิก"
            rows={rows}
            showGlobalSearch
          />
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="lg" open={Boolean(selectedRow)} onClose={() => setSelectedRow(null)}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <ClipboardList size={22} />
          รายละเอียดคำขอเบิก
        </DialogTitle>
        <DialogContent>
          {selectedRow ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>เลขที่คำขอ</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{selectedRow.requestNo || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>วันที่ขอเบิก</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{formatDisplayDateTime(selectedRow.createdAt)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>แผนก</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{selectedRow.department || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>สถานะ</Typography>
                  <Chip
                    label={getRequestStatusMeta(selectedRow).label}
                    size="small"
                    sx={{
                      backgroundColor: getRequestStatusMeta(selectedRow).chip,
                      color: '#fff',
                      fontWeight: 800,
                    }}
                  />
                </Grid>
              </Grid>
              {selectedRow.isUrgent ? (
                <Alert severity="warning">
                  <Typography sx={{ fontWeight: 900 }}>เบิกด่วน</Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {selectedRow.urgentRemark || 'ไม่ระบุเหตุผล'}
                  </Typography>
                </Alert>
              ) : null}
              {selectedRow.remark ? <Alert severity="info">{selectedRow.remark}</Alert> : null}
              <AppTable
                columns={detailColumns}
                fitToWidth
                maxHeight={360}
                noDataText="ไม่มีรายการสินค้า"
                rows={(selectedRow.items ?? []).map((item) => ({
                  category: item.category ?? item.Category ?? '',
                  code: item.code ?? item.Code ?? '',
                  detailId: item.detailId ?? item.DetailId ?? '',
                  lineNo: item.lineNo ?? item.LineNo ?? '',
                  productName: item.productName ?? item.ProductName ?? '',
                  quantity: item.quantity ?? item.Quantity ?? '',
                  fulfilledQty: item.fulfilledQty ?? item.FulfilledQty ?? 0,
                  backlogQty: item.backlogQty ?? item.BacklogQty ?? 0,
                  unit: item.unit ?? item.Unit ?? '',
                }))}
                rowKey="detailId"
                showGlobalSearch={false}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            startIcon={<Printer size={18} />}
            variant="outlined"
            onClick={() => printHistorySlip(buildPrintableRowWithBacklog(selectedRow, rows))}
          >
            พิมพ์ใบคำขอ
          </Button>
          <Button
            startIcon={<FileDown size={18} />}
            variant="outlined"
            onClick={() => downloadHistorySlipPdf(buildPrintableRowWithBacklog(selectedRow, rows))}
          >
            ดาวน์โหลด PDF
          </Button>
          <Button variant="contained" onClick={() => setSelectedRow(null)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="sm" open={Boolean(remarkRow)} onClose={() => setRemarkRow(null)}>
        <DialogTitle>หมายเหตุ</DialogTitle>
        <DialogContent>
          {remarkRow ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>เลขที่คำขอ</Typography>
                <Typography sx={{ fontWeight: 900 }}>{remarkRow.requestNo || '-'}</Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 1.5,
                  color: '#0f172a',
                  lineHeight: 1.8,
                  minHeight: 120,
                  p: 2,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {remarkRow.remark}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={() => setRemarkRow(null)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RequestHistoryPage

