function escapeHtml(value) {
  return String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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
      .report-pdf__title { font-size:25px; font-weight:700; margin:0; }
      .report-pdf__period { color:#000; font-size:14px; margin:6px 0 24px; }
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
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pageWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')
    let heightLeft = imageHeight
    let position = 0

    pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
      heightLeft -= pageHeight
    }
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportPurchaseSummaryToPdf({ fileName, periodLabel, rows }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const total = rows.reduce((sum, row) => sum + Number(row.totalPurchase ?? 0), 0)
  const body = rows.map((row, index) => `<tr><td>${index + 1}</td><td class="supplier">${escapeHtml(row.supplierName)}</td><td class="amount">${Number(row.totalPurchase ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join('') || '<tr><td colspan="3">ไม่พบข้อมูลยอดซื้อ</td></tr>'
  const container = document.createElement('section')
  container.style.cssText = 'background:#fff;color:#000;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:900px;padding:32px;z-index:-1;'
  container.innerHTML = `<style>h1{text-align:center;font-size:24px;margin:0 0 24px}table{border-collapse:collapse;font-size:13px;width:100%}th{background:#fffec8}th,td{border:1px solid #000;padding:8px;text-align:center}.supplier{text-align:left}.amount{text-align:right}tfoot td{font-weight:700}tfoot td:last-child{background:#c8facc}</style><h1>รายงานการซื้อวัสดุอุปกรณ์ ประจำเดือน ${escapeHtml(periodLabel)}</h1><table><thead><tr><th>ลำดับ</th><th>ร้าน</th><th>จำนวนเงิน/หน่วย</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="2" class="amount">ยอดรวม</td><td class="amount">${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot></table>`
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pageWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')
    let heightLeft = imageHeight
    let position = 0
    pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
      heightLeft -= pageHeight
    }
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportProductIssueByCategoryToPdf({ fileName, groups, periodLabel }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const body = groups.map((group) => `
    <section class="category">
      <div class="category-title">หมวด : ${escapeHtml(group.category)}</div>
      ${group.products.map((product) => `<div class="item"><span class="item-name">${escapeHtml(product.productName)} / ${escapeHtml(product.productCode)}</span><span class="item-qty">${Number(product.totalQty ?? 0).toLocaleString('th-TH')}${product.unit ? ` ${escapeHtml(product.unit)}` : ''}</span></div>`).join('')}
    </section>`).join('') || '<p>ไม่พบรายการเบิกในช่วงเวลาที่เลือก</p>'
  const container = document.createElement('section')
  container.style.cssText = 'background:#fff;color:#111827;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:900px;padding:32px;z-index:-1;'
  container.innerHTML = `
    <style>
      h1 { font-size:23px; margin:0; text-align:center; } .period { font-size:14px; margin:6px 0 22px; text-align:center; }
      .category { break-inside:avoid; margin:0 0 14px; } .category-title { color:#1d4ed8; font-size:15px; font-weight:700; margin-bottom:5px; }
      .item { display:flex; font-size:13px; gap:16px; line-height:1.75; padding-left:28px; } .item-name { flex:1; } .item-qty { min-width:90px; text-align:right; }
    </style>
    <h1>รายงานสินค้าที่เบิก แยกตามหมวดหมู่</h1><p class="period">ประจำเดือน ${escapeHtml(periodLabel)}</p>${body}`
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pageWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')
    let heightLeft = imageHeight
    let position = 0
    pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
      heightLeft -= pageHeight
    }
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportDepartmentIssueToPdf({ fileName, groups, periodLabel }) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')])
  const html2canvas = html2canvasModule.default
  const body = groups.map((group) => `
    <section class="department">
      <div class="department-title">แผนก : ${escapeHtml(group.department)}</div>
      ${group.products.map((product) => `<div class="item"><span class="item-name">${escapeHtml(product.productName)} / ${escapeHtml(product.productCode)}</span><span class="item-qty">${Number(product.totalQty ?? 0).toLocaleString('th-TH')}${product.unit ? ` ${escapeHtml(product.unit)}` : ''}</span></div>`).join('')}
    </section>`).join('') || '<p>ไม่พบรายการเบิกในช่วงเวลาที่เลือก</p>'
  const container = document.createElement('section')
  container.style.cssText = 'background:#fff;color:#111827;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;left:-10000px;position:fixed;top:0;width:900px;padding:32px;z-index:-1;'
  container.innerHTML = `
    <style>
      h1 { font-size:23px; margin:0; text-align:center; } .period { font-size:14px; margin:6px 0 22px; text-align:center; }
      .department { break-inside:avoid; margin:0 0 14px; } .department-title { color:#1d4ed8; font-size:15px; font-weight:700; margin-bottom:5px; }
      .item { display:flex; font-size:13px; gap:16px; line-height:1.75; padding-left:28px; } .item-name { flex:1; } .item-qty { min-width:90px; text-align:right; }
    </style>
    <h1>รายงานการเบิก แยกตามแผนก</h1><p class="period">ประจำเดือน ${escapeHtml(periodLabel)}</p>${body}`
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pageWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')
    let heightLeft = imageHeight
    let position = 0
    pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
      heightLeft -= pageHeight
    }
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
      h1 { font-size:25px; margin:0; } p { font-size:14px; margin:6px 0 24px; }
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
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pageWidth) / canvas.width
    const imageData = canvas.toDataURL('image/png')
    let heightLeft = imageHeight
    let position = 0
    pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight)
      heightLeft -= pageHeight
    }
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}
