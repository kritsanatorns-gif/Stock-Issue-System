import { addReportCanvas, clampReportTableCells, stampReportFooters } from './reportPagination'
function escapeHtml(value) {
  return String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatThaiDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH')
}

// Renders a small, print-only HTML table before capturing it.  This keeps Thai
// text intact because the browser renders the font before it becomes a PDF image.
export async function exportTableToPdf({ columns, fileName, periodLabel, rows, title }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])
  const html2canvas = html2canvasModule.default
  const container = document.createElement('section')
  const tableHeaders = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('')
  const tableRows = rows.map((row) => (
    `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`
  )).join('') || `<tr><td colspan="${columns.length}" class="empty">ไม่พบข้อมูล</td></tr>`

  container.style.cssText = 'background:#fff;color:#000;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:1120px;padding:32px;z-index:-1;'
  container.innerHTML = `
    <style>
      .report-pdf__title { font-size:16px; font-weight:700; margin:0; text-align:left; }
      .report-pdf__period { color:#000; font-size:12px; margin:4px 0 18px; text-align:left; }
      .report-pdf__generated { color:#000; font-size:12px; margin-bottom:16px; }
      .report-pdf__table { border-collapse:collapse; font-size:12px; width:100%; }
      .report-pdf__table th { background:#fff; color:#000; font-weight:700; }
      .report-pdf__table th, .report-pdf__table td { background:#fff; border:1px solid #000; color:#000; padding:8px 9px; text-align:center; vertical-align:middle; }
      .report-pdf__table .empty { color:#000; text-align:center; }
    </style>
    <h1 class="report-pdf__title">${escapeHtml(title)}</h1>
    <p class="report-pdf__period">${escapeHtml(periodLabel)}</p>
    <div class="report-pdf__generated">สร้างเมื่อ ${new Date().toLocaleString('th-TH')}</div>
    <table class="report-pdf__table"><thead><tr>${tableHeaders}</tr></thead><tbody>${tableRows}</tbody></table>
  `
  document.body.appendChild(container)

  try {
    clampReportTableCells(container)
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    addReportCanvas(pdf, canvas, { landscape: false })
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportProductIssueHistoryToPdf({ fileName, groups, periodLabel, title = 'ประวัติการเบิก แยกตามสินค้า', vatRate = 0 }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const renderGroups = (groupsForPage) => groupsForPage.map((product) => {
    const totalQty = product.rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
    const totalCost = product.rows.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0)
    const totalVat = totalCost * Number(vatRate || 0) / 100
    return `<section class="product">
      <div class="product-title">${escapeHtml(product.productName)}${product.productCode ? ` / ${escapeHtml(product.productCode)}` : ''}</div>
      ${product.rows.map((row) => {
        const quantity = Number(row.quantity ?? 0)
        const total = Number(row.totalCost ?? 0)
        const vat = total * Number(vatRate || 0) / 100
        return `<div class="line"><span>${escapeHtml(formatThaiDate(row.createdAt))}</span><span>${escapeHtml(row.documentNo)}</span><span>${escapeHtml(row.department)}</span><span class="num">${quantity.toLocaleString('th-TH')}</span><span>${escapeHtml(row.unit || '-')}</span><span class="num">${(quantity ? total / quantity : 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="num">${(quantity ? vat / quantity : 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="num">${(total + vat).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`
      }).join('')}
      <div class="subtotal"><span>รวมตามสินค้า</span><span></span><span></span><span>${totalQty.toLocaleString('th-TH')}</span><span></span><span></span><span>${totalVat.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span>${(totalCost + totalVat).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
    </section>`
  }).join('') || '<p>ไม่พบประวัติการเบิกในช่วงที่เลือก</p>'
  const pages = []
  let pageGroups = []
  let pageWeight = 0
  groups.forEach((product) => {
    const weight = Math.max(3, product.rows.length + 3)
    if (pageGroups.length && pageWeight + weight > 58) {
      pages.push(pageGroups)
      pageGroups = []
      pageWeight = 0
    }
    pageGroups.push(product)
    pageWeight += weight
  })
  if (pageGroups.length || !pages.length) pages.push(pageGroups)
  const createPageHtml = (body) => `<style>
    h1 { font-size:16px; letter-spacing:.1px; margin:0; text-align:left; } .period { font-size:12px; margin:4px 0 18px; text-align:left; }
    .head,.line,.subtotal { display:grid; grid-template-columns:76px 112px 260px 62px 60px 96px 100px 105px; column-gap:12px; font-size:12px; line-height:1.8; }
    .head { border-bottom:1px dashed #475569; border-top:1px dashed #475569; font-weight:700; padding:4px 0; } .line { padding-left:8px; } .num { text-align:right; }
    .product { break-inside:avoid; margin:12px 0 15px; } .product-title { color:#1d4ed8; font-size:12px; font-weight:700; margin:0 0 3px 8px; }
    .subtotal { border-bottom:1px dashed #334155; border-top:1px dashed #334155; color:#1d4ed8; font-weight:700; margin-top:4px; padding:3px 0 3px 8px; } .subtotal span:nth-child(4),.subtotal span:last-child { text-align:right; }
  </style><h1>${escapeHtml(title)}</h1><p class="period">ประจำเดือน ${escapeHtml(periodLabel)} · VAT ${Number(vatRate || 0).toLocaleString('th-TH')}%</p><div class="head"><span>วันที่</span><span>เลขที่เอกสาร</span><span>แผนก</span><span>จำนวน</span><span>หน่วย</span><span class="num">ราคา/หน่วย</span><span class="num">ราคา VAT/หน่วย</span><span class="num">รวมเงิน</span></div>${body}`
  const pdf = new jsPDF('p', 'mm', 'a4')
  for (let index = 0; index < pages.length; index += 1) {
    const container = document.createElement('section')
    container.style.cssText = 'background:#fff;color:#111827;font-family:Tahoma,Arial,sans-serif;left:-10000px;position:fixed;top:0;width:1050px;padding:28px 34px;z-index:-1;'
    container.innerHTML = createPageHtml(renderGroups(pages[index]))
    document.body.appendChild(container)
    try {
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
      if (index > 0) pdf.addPage()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const contentWidth = pageWidth - 10
      const contentHeight = canvas.height * contentWidth / canvas.width
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, contentWidth, contentHeight)
    } finally {
      document.body.removeChild(container)
    }
  }
  stampReportFooters(pdf)
  pdf.save(fileName)
}

export async function exportPurchaseHistoryBySupplierToPdf({ fileName, groups, periodLabel, title = 'ประวัติยอดซื้อแยกตามผู้ขาย', vatRate = 0 }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const formatMoney = (value) => Number(value ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const renderGroups = (groupsForPage) => groupsForPage.map((supplier) => {
    const totalQty = supplier.rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
    const totalPurchase = supplier.rows.reduce((sum, row) => sum + Number(row.totalPurchase ?? 0), 0)
    return `<section class="supplier">
      <div class="supplier-title">${escapeHtml(supplier.supplierName || 'ไม่ระบุผู้ขาย')}</div>
      ${supplier.rows.map((row) => `<div class="line"><span>${escapeHtml(formatThaiDate(row.receivedAt))}</span><span>${escapeHtml(row.poInvoiceNo || '-')}</span><span>${escapeHtml(row.productCode || '-')}</span><span>${escapeHtml(row.productName || '-')}</span><span class="num">${Number(row.quantity ?? 0).toLocaleString('th-TH')}</span><span>${escapeHtml(row.unit || '-')}</span><span class="num">${formatMoney(row.unitCost)}</span><span class="num">${formatMoney(Number(row.unitCost ?? 0) * Number(vatRate || 0) / 100)}</span><span class="num">${formatMoney(row.totalPurchase)}</span></div>`).join('')}
      <div class="subtotal"><span>รวมตามผู้ขาย</span><span></span><span></span><span></span><span>${totalQty.toLocaleString('th-TH')}</span><span></span><span></span><span></span><span>${formatMoney(totalPurchase)}</span></div>
    </section>`
  }).join('') || '<p>ไม่พบประวัติยอดซื้อในช่วงที่เลือก</p>'
  const pages = []
  let pageGroups = []
  let pageWeight = 0
  groups.forEach((supplier) => {
    const weight = Math.max(3, supplier.rows.length + 3)
    if (pageGroups.length && pageWeight + weight > 58) {
      pages.push(pageGroups)
      pageGroups = []
      pageWeight = 0
    }
    pageGroups.push(supplier)
    pageWeight += weight
  })
  if (pageGroups.length || !pages.length) pages.push(pageGroups)
  const createPageHtml = (body) => `<style>
    h1 { font-size:16px; letter-spacing:.1px; margin:0; text-align:left; } .period { font-size:12px; margin:4px 0 18px; text-align:left; }
    .head,.line,.subtotal { display:grid; grid-template-columns:70px 98px 112px 204px 56px 46px 82px 92px 94px; column-gap:8px; font-size:12px; line-height:1.8; }
    .head { border-bottom:1px dashed #475569; border-top:1px dashed #475569; font-weight:700; padding:4px 0; } .line { padding-left:8px; } .num { text-align:right; }
    .supplier { break-inside:avoid; margin:12px 0 15px; } .supplier-title { color:#1d4ed8; font-size:12px; font-weight:700; margin:0 0 3px 8px; }
    .subtotal { border-bottom:1px dashed #334155; border-top:1px dashed #334155; color:#1d4ed8; font-weight:700; margin-top:4px; padding:3px 0 3px 8px; } .subtotal span:nth-child(5),.subtotal span:last-child { text-align:right; }
  </style><h1>${escapeHtml(title)}</h1><p class="period">ประจำเดือน ${escapeHtml(periodLabel)} · VAT ${Number(vatRate || 0).toLocaleString('th-TH')}%</p><div class="head"><span>วันที่รับเข้า</span><span>เลขที่ Invoice</span><span>รหัสสินค้า</span><span>สินค้า</span><span class="num">จำนวน</span><span>หน่วย</span><span class="num">ต้นทุน/หน่วย</span><span class="num">ราคา VAT/หน่วย</span><span class="num">ยอดซื้อรวม</span></div>${body}`
  const pdf = new jsPDF('p', 'mm', 'a4')
  for (let index = 0; index < pages.length; index += 1) {
    const container = document.createElement('section')
    container.style.cssText = 'background:#fff;color:#111827;font-family:Tahoma,Arial,sans-serif;left:-10000px;position:fixed;top:0;width:1050px;padding:28px 34px;z-index:-1;'
    container.innerHTML = createPageHtml(renderGroups(pages[index]))
    document.body.appendChild(container)
    try {
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
      if (index > 0) pdf.addPage()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const contentWidth = pageWidth - 10
      const contentHeight = canvas.height * contentWidth / canvas.width
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, contentWidth, contentHeight)
    } finally {
      document.body.removeChild(container)
    }
  }
  stampReportFooters(pdf)
  pdf.save(fileName)
}

export async function exportProductPurchaseIssueToPdf({ fileName, periodLabel, rows }) {
  const columns = [
    { header: 'ลำดับ', value: (row) => row.index },
    { header: 'รายการสินค้า / รหัส', value: (row) => `${row.productName || row.productCode} / ${row.productCode}` },
    { header: 'หน่วย', value: (row) => row.unit || '-' },
    { header: 'จำนวนรับเข้า', value: (row) => Number(row.purchaseQty ?? 0).toLocaleString('th-TH') },
    { header: 'ยอดซื้อ', value: (row) => Number(row.purchaseAmount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { header: 'จำนวนเบิก', value: (row) => Number(row.issueQty ?? 0).toLocaleString('th-TH') },
    { header: 'ต้นทุน FIFO ที่เบิก', value: (row) => Number(row.issueAmount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  ]
  await exportTableToPdf({ columns, fileName, periodLabel: `ช่วงเวลา: ${periodLabel}`, rows: rows.map((row, index) => ({ ...row, index: index + 1 })), title: 'รายงานสรุปสินค้า แยกตามรายการซื้อและเบิก' })
}

export async function exportPurchaseSummaryToPdf({ fileName, periodLabel, rows }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const total = rows.reduce((sum, row) => sum + Number(row.totalPurchase ?? 0), 0)
  const body = rows.map((row, index) => `<tr><td>${index + 1}</td><td class="supplier">${escapeHtml(row.supplierName)}</td><td class="amount">${Number(row.totalPurchase ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join('') || '<tr><td colspan="3">ไม่พบข้อมูลยอดซื้อ</td></tr>'
  const container = document.createElement('section')
  container.style.cssText = 'background:#fff;color:#000;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:900px;padding:32px;z-index:-1;'
  container.innerHTML = `<style>h1{text-align:center;font-size:16px;margin:0 0 24px}table{border-collapse:collapse;font-size:12px;width:100%}th{background:#fffec8}th,td{border:1px solid #000;padding:8px;text-align:center}.supplier{text-align:left}.amount{text-align:right}tfoot td{font-weight:700}tfoot td:last-child{background:#c8facc}</style><h1>รายงานการซื้อวัสดุอุปกรณ์ ประจำเดือน ${escapeHtml(periodLabel)}</h1><table><thead><tr><th>ลำดับ</th><th>ร้าน</th><th>จำนวนเงิน/หน่วย</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="2" class="amount">ยอดรวม</td><td class="amount">${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot></table>`
  document.body.appendChild(container)
  try {
    clampReportTableCells(container)
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    addReportCanvas(pdf, canvas, { landscape: false })
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportProductIssueByCategoryToPdf({ fileName, groups, periodLabel, title = 'รายงานสินค้าที่เบิก แยกตามหมวดหมู่' }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const body = groups.map((group) => `
    <section class="category">
      <div class="category-title">หมวด : ${escapeHtml(group.category)}</div>
      <div class="head"><span>รายการสินค้า / รหัส</span><span>จำนวน</span><span>หน่วย</span><span>ต้นทุน/หน่วย</span><span>ยอดเบิก</span></div>
      ${group.products.map((product) => { const qty = Number(product.totalQty ?? 0); const total = Number(product.totalCost ?? 0); return `<div class="item"><span class="item-name">${escapeHtml(product.productName)} / ${escapeHtml(product.productCode)}</span><span class="item-qty">${qty.toLocaleString('th-TH')}</span><span class="item-unit">${escapeHtml(product.unit || '-')}</span><span class="item-cost">${(qty ? total / qty : 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="item-cost">${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` }).join('')}
      <div class="total"><span>รวมหมวด</span><span>${group.products.reduce((sum, product) => sum + Number(product.totalQty ?? 0), 0).toLocaleString('th-TH')}</span><span></span><span></span><span>${group.products.reduce((sum, product) => sum + Number(product.totalCost ?? 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
    </section>`).join('') || '<p>ไม่พบรายการเบิกในช่วงเวลาที่เลือก</p>'
  const container = document.createElement('section')
  container.style.cssText = 'background:#fff;color:#111827;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:900px;padding:32px;z-index:-1;'
  container.innerHTML = `
    <style>
      h1 { font-size:16px; margin:0; text-align:left; } .period { font-size:12px; margin:4px 0 18px; text-align:left; }
      .category { break-inside:avoid; margin:0 0 14px; } .category-title { color:#1d4ed8; font-size:12px; font-weight:700; margin-bottom:5px; }
      .head,.item { display:grid; font-size:12px; grid-template-columns:minmax(0,1fr) 68px 55px 100px 100px; gap:8px; line-height:1.75; padding-left:20px; } .head { font-weight:700; border-bottom:1px solid #94a3b8; } .item-name { min-width:0; } .item-qty,.item-cost { text-align:right; } .item-unit { text-align:center; }
      .total { background:#e0f2fe; display:grid; font-size:12px; font-weight:700; grid-template-columns:minmax(0,1fr) 68px 55px 100px 100px; gap:8px; line-height:1.9; margin-top:3px; padding:2px 0 2px 20px; } .total span:nth-child(2),.total span:last-child { text-align:right; }
    </style>
    <h1>${escapeHtml(title)}</h1><p class="period">ประจำเดือน ${escapeHtml(periodLabel)}</p>${body}`
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    addReportCanvas(pdf, canvas, { landscape: false })
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportDepartmentIssueToPdf({ fileName, groups, periodLabel, vatRate = 0, title = 'รายงานสรุปแยกตามลูกค้า (แผนก)', groupLabel = 'แผนก' }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const body = groups.map((group) => `
    <section class="department">
      <div class="department-title">${escapeHtml(groupLabel)} : ${escapeHtml(group.department)}</div>
      <div class="head"><span>รายการสินค้า / รหัส</span><span>จำนวน</span><span>หน่วย</span><span>ต้นทุน/หน่วย</span><span>ยอดเบิก</span></div>
      ${group.products.map((product) => { const qty = Number(product.totalQty ?? 0); const total = Number(product.totalCost ?? 0); return `<div class="item"><span class="item-name">${escapeHtml(product.productName)} / ${escapeHtml(product.productCode)}</span><span class="item-qty">${qty.toLocaleString('th-TH')}</span><span class="item-unit">${escapeHtml(product.unit || '-')}</span><span class="item-cost">${(qty ? total / qty : 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="item-cost">${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` }).join('')}
      ${(() => { const subtotal = group.products.reduce((sum, product) => sum + Number(product.totalCost ?? 0), 0); const quantity = group.products.reduce((sum, product) => sum + Number(product.totalQty ?? 0), 0).toLocaleString('th-TH'); const subtotalRow = `<div class="total"><span>รวมแผนก</span><span>${quantity}</span><span></span><span></span><span>${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`; if (vatRate === null || vatRate === undefined) return subtotalRow; const totalWithVat = subtotal + (subtotal * Number(vatRate || 0) / 100); return `${subtotalRow}<div class="total total-vat"><span>รวมแผนก (รวม VAT ${vatRate}%)</span><span></span><span></span><span></span><span>${totalWithVat.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` })()}
    </section>`).join('') || '<p>ไม่พบรายการเบิกในช่วงเวลาที่เลือก</p>'
  const container = document.createElement('section')
  container.style.cssText = 'background:#fff;color:#111827;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:900px;padding:32px;z-index:-1;'
  container.innerHTML = `
    <style>
      h1 { font-size:16px; margin:0; text-align:left; } .period { font-size:12px; margin:4px 0 18px; text-align:left; }
      .department { break-inside:avoid; margin:0 0 14px; } .department-title { color:#1d4ed8; font-size:12px; font-weight:700; margin-bottom:5px; }
      .head,.item { display:grid; font-size:12px; grid-template-columns:minmax(0,1fr) 68px 55px 100px 100px; gap:8px; line-height:1.75; padding-left:20px; } .head { font-weight:700; border-bottom:1px solid #94a3b8; } .item-name { min-width:0; } .item-qty,.item-cost { text-align:right; } .item-unit { text-align:center; } .total { background:#e0f2fe; display:grid; font-size:12px; font-weight:700; grid-template-columns:minmax(0,1fr) 68px 55px 100px 100px; gap:8px; line-height:1.9; margin-top:3px; padding:2px 0 2px 20px; } .total-vat { margin-top:0; } .total span:nth-child(2),.total span:last-child { text-align:right; }
    </style>
    <h1>${escapeHtml(title)}</h1><p class="period">ประจำเดือน ${escapeHtml(periodLabel)}</p>${body}`
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    addReportCanvas(pdf, canvas, { landscape: false })
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportDepartmentCostSummaryToPdf({ fileName, periodLabel, rows }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const total = rows.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0)
  const body = rows.map((row) => `
    <div class="line"><span class="name">${escapeHtml(row.label || '-')}</span><span>${Number(row.totalQty ?? 0).toLocaleString('th-TH')}</span><span>${Number(row.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
  `).join('') || '<p>ไม่พบรายการจ่ายออกในช่วงที่เลือก</p>'
  const container = document.createElement('section')
  container.style.cssText = 'background:#fff;color:#111827;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:900px;padding:32px;z-index:-1;'
  container.innerHTML = `<style>h1{text-align:center;font-size:16px;margin:0}.period{text-align:center;font-size:12px;margin:6px 0 24px}.head,.line{display:grid;grid-template-columns:minmax(0,1fr) 110px 160px;gap:12px;font-size:12px;line-height:1.9;padding:0 10px}.head{border-top:2px solid #cbd5e1;border-bottom:1px solid #94a3b8;font-weight:700}.line span:not(.name),.total span:last-child{text-align:right}.total{background:#e0f2fe;border-top:1px solid #bae6fd;display:grid;grid-template-columns:minmax(0,1fr) 110px 160px;gap:12px;font-size:12px;font-weight:700;margin-top:5px;padding:4px 10px}.total span:last-child{text-align:right}</style><h1>รายงานสรุปค่าใช้จ่ายแยกตามแผนก</h1><p class="period">ประจำเดือน ${escapeHtml(periodLabel)}</p><div class="head"><span>แผนก</span><span style="text-align:right">จำนวนเบิก</span><span style="text-align:right">ยอดรวม</span></div>${body}<div class="total"><span>รวมทั้งสิ้น ${rows.length} แผนก</span><span></span><span>${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    addReportCanvas(pdf, canvas, { landscape: false })
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportDivisionCostToPdf({ fileName, groups, periodLabel }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const container = document.createElement('section')
  const total = groups.reduce((sum, group) => sum + Number(group.totalCost ?? 0), 0)
  const body = groups.flatMap((group, groupIndex) => group.departments.map((department, departmentIndex) => `
    <tr>
      ${departmentIndex === 0 ? `<td rowspan="${group.departments.length}">${groupIndex + 1}</td><td rowspan="${group.departments.length}">${escapeHtml(group.division)}</td>` : ''}
      <td>${escapeHtml(department.department)}</td>
      <td class="amount">${Number(department.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      ${departmentIndex === 0 ? `<td class="amount total" rowspan="${group.departments.length}">${Number(group.totalCost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
    </tr>`)).join('') || '<tr><td colspan="5">ไม่พบรายการจ่ายออกในช่วงที่เลือก</td></tr>'

  container.style.cssText = 'background:#fff;color:#000;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:1120px;padding:32px;z-index:-1;'
  container.innerHTML = `
    <style>
      h1 { font-size:16px; margin:0; text-align:left; } p { font-size:12px; margin:4px 0 18px; text-align:left; }
      table { border-collapse:collapse; font-size:12px; width:100%; } th { background:#fffec8; }
      th,td { border:1px solid #000; padding:8px 9px; text-align:center; vertical-align:middle; }
      .amount { text-align:right; } .total { color:#f00; vertical-align:bottom; font-weight:700; }
      tfoot td { font-weight:700; } tfoot td:last-child { background:#bae6fd; }
    </style>
    <h1>รายงานค่าใช้จ่ายตามฝ่ายและแผนก</h1><p>ช่วงเวลา: ${escapeHtml(periodLabel)}</p>
    <table><thead><tr><th>ลำดับ</th><th>ฝ่าย</th><th>แผนก</th><th>จำนวนเงิน/แผนก</th><th>จำนวนเงิน/ฝ่าย</th></tr></thead>
    <tbody>${body}</tbody><tfoot><tr><td colspan="4" class="amount">รวมทั้งหมด</td><td class="amount">${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot></table>`
  document.body.appendChild(container)
  try {
    clampReportTableCells(container)
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    addReportCanvas(pdf, canvas, { landscape: false })
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}
