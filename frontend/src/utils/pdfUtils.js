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
