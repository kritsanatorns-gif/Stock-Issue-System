// Reserve a footer on every page; render Thai with browser fonts for PDF compatibility.
export function clampReportTableCells(root) {
  if (!root) return

  root.querySelectorAll('td').forEach((cell) => {
    if (cell.dataset.reportClampApplied || cell.querySelector('img, input, button, canvas, svg')) return

    const content = cell.ownerDocument.createElement('div')
    content.className = 'report-cell-clamp'
    while (cell.firstChild) content.appendChild(cell.firstChild)
    cell.appendChild(content)
    cell.dataset.reportClampApplied = 'true'
  })

  const documentRef = root.ownerDocument ?? document
  if (documentRef.getElementById('report-cell-clamp-style')) return

  const style = documentRef.createElement('style')
  style.id = 'report-cell-clamp-style'
  style.textContent = '.report-cell-clamp{display:-webkit-box;line-height:1.25;max-height:3.75em;overflow:hidden;text-overflow:ellipsis;-webkit-box-orient:vertical;-webkit-line-clamp:3}'
  documentRef.head.appendChild(style)
}

export function paginateReportCanvas(canvas, { landscape = false, margin = 5 } = {}) {
  const width = landscape ? 297 : 210
  const height = landscape ? 210 : 297
  let scale = canvas.width / (width - margin * 2)
  const availableHeight = height - margin * 2 - 12
  // Existing A4 forms include a full-page minimum height. Fit those forms with
  // their footer instead of producing an almost-empty second page.
  if (canvas.height / scale <= height - margin * 2) {
    scale = Math.max(scale, canvas.height / availableHeight)
  }
  const contentHeight = Math.max(1, Math.round(availableHeight * scale))
  const count = Math.max(1, Math.ceil(canvas.height / contentHeight))
  return Array.from({ length: count }, (_, index) => {
    const page = document.createElement('canvas')
    page.width = Math.round(width * scale)
    page.height = Math.round(height * scale)
    const ctx = page.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, page.width, page.height)
    const sliceHeight = Math.min(contentHeight, canvas.height - index * contentHeight)
    ctx.drawImage(canvas, 0, index * contentHeight, canvas.width, sliceHeight,
      (page.width - canvas.width) / 2, margin * scale, canvas.width, sliceHeight)
    ctx.fillStyle = '#000'
    ctx.font = `${3.5 * scale}px "IBM Plex Sans Thai", Tahoma, sans-serif`
    ctx.textAlign = 'right'
    const footerRight = page.width - margin * scale
    ctx.fillText(`${index + 1}/${count}`, footerRight, (height - 10) * scale)
    if (index === count - 1) ctx.fillText('จบรายงาน', footerRight, (height - 5) * scale)
    return page
  })
}

export function addReportCanvas(pdf, canvas, options = {}) {
  const pages = paginateReportCanvas(canvas, options)
  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage()
    pdf.addImage(page.toDataURL('image/png'), 'PNG', 0, 0,
      pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
  })
}

export function stampReportFooters(pdf) {
  const count = pdf.getNumberOfPages()
  for (let index = 1; index <= count; index += 1) {
    pdf.setPage(index)
    const footer = document.createElement('canvas')
    footer.width = 1000
    footer.height = 120
    const ctx = footer.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, footer.width, footer.height)
    ctx.fillStyle = '#000'
    ctx.font = '30px "IBM Plex Sans Thai", Tahoma, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${index}/${count}`, 950, 42)
    if (index === count) ctx.fillText('จบรายงาน', 950, 100)
    pdf.addImage(footer.toDataURL('image/png'), 'PNG', pdf.internal.pageSize.getWidth() - 55,
      pdf.internal.pageSize.getHeight() - 13, 50, 12)
  }
}

// Install before document.close so existing onload print actions use numbered sheets.
export function installReportPrinting(reportWindow) {
  const nativePrint = reportWindow.print.bind(reportWindow)
  let printing = false
  reportWindow.print = async () => {
    if (printing) return
    printing = true
    try {
      await reportWindow.document.fonts.ready
      const { default: html2canvas } = await import('html2canvas')
      const doc = reportWindow.document
      const landscape = [...doc.querySelectorAll('style')].some((style) => /size:\s*A4\s+landscape/i.test(style.textContent))
      const source = doc.querySelector('.request-pdf-sheet, .issue-slip, .receive-summary') || doc.body
      clampReportTableCells(source)
      const canvas = await html2canvas(source, { backgroundColor: '#fff', scale: 2, useCORS: true })
      const pages = paginateReportCanvas(canvas, { landscape })
      const style = doc.createElement('style')
      style.textContent = `@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:0}html,body{margin:0!important;padding:0!important;width:auto!important} .numbered-report-page{display:block!important;width:${landscape ? 297 : 210}mm!important;height:${landscape ? 210 : 297}mm!important;break-after:page;page-break-after:always}.numbered-report-page:last-child{break-after:auto;page-break-after:auto}`
      doc.head.replaceChildren(style)
      const images = pages.map((page) => {
        const img = doc.createElement('img')
        img.className = 'numbered-report-page'
        img.src = page.toDataURL('image/png')
        return img
      })
      doc.body.replaceChildren(...images)
      await Promise.all(images.map((img) => img.decode()))
      reportWindow.print = nativePrint
      nativePrint()
    } catch (error) {
      printing = false
      reportWindow.alert('เตรียมรายงานสำหรับพิมพ์ไม่สำเร็จ กรุณาลองอีกครั้ง')
      console.error(error)
    }
  }
}
