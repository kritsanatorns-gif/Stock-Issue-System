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

function findSafeSliceHeight(canvas, sourceY, proposedHeight, scale) {
  const targetY = sourceY + proposedHeight
  if (targetY >= canvas.height) return proposedHeight

  const context = canvas.getContext('2d', { willReadFrequently: true })
  const searchDistance = Math.max(24, Math.round(scale * 18))
  const minimumY = Math.max(sourceY + Math.round(scale * 24), targetY - searchDistance)
  const requiredBlankRows = Math.max(2, Math.round(scale / 3))
  const isBlankRow = (y) => {
    const pixels = context.getImageData(0, y, canvas.width, 1).data
    let ink = 0
    for (let offset = 0; offset < pixels.length; offset += 16) {
      if (pixels[offset] < 235 || pixels[offset + 1] < 235 || pixels[offset + 2] < 235) ink += 1
    }
    return ink <= Math.max(2, canvas.width / 800)
  }

  for (let y = targetY; y >= minimumY; y -= 1) {
    let blank = true
    for (let row = 0; row < requiredBlankRows; row += 1) {
      if (!isBlankRow(y - row)) {
        blank = false
        break
      }
    }
    if (blank) return y - sourceY
  }

  return proposedHeight
}

export function paginateReportCanvas(canvas, { landscape = false, margin = 5, repeatHeaderHeight = 280 } = {}) {
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
  const headerHeight = Math.min(Math.max(0, repeatHeaderHeight), Math.floor(contentHeight * 0.35), canvas.height)
  const slices = []
  let sourceY = 0
  while (sourceY < canvas.height || !slices.length) {
    const repeatHeader = slices.length > 0 && headerHeight > 0
    const availableSliceHeight = Math.max(1, contentHeight - (repeatHeader ? headerHeight : 0))
    const proposedHeight = Math.min(availableSliceHeight, canvas.height - sourceY)
    const sliceHeight = findSafeSliceHeight(canvas, sourceY, proposedHeight, scale)
    slices.push({ repeatHeader, sliceHeight, sourceY })
    sourceY += sliceHeight
  }
  const count = slices.length
  return slices.map(({ repeatHeader, sliceHeight, sourceY }, index) => {
    const page = document.createElement('canvas')
    page.width = Math.round(width * scale)
    page.height = Math.round(height * scale)
    const ctx = page.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, page.width, page.height)
    const left = (page.width - canvas.width) / 2
    if (repeatHeader) {
      ctx.drawImage(canvas, 0, 0, canvas.width, headerHeight,
        left, margin * scale, canvas.width, headerHeight)
    }
    ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight,
      left, (margin + (repeatHeader ? headerHeight / scale : 0)) * scale, canvas.width, sliceHeight)
    ctx.fillStyle = '#000'
    ctx.font = `${3.5 * scale}px "IBM Plex Sans Thai", Tahoma, sans-serif`
    ctx.textAlign = 'right'
    const footerRight = page.width - margin * scale
    ctx.fillText(`${index + 1}/${count}`, footerRight, (height - 10) * scale)
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

// Paginate grouped reports using measured DOM rows, repeating the active group's
// complete heading instead of copying a fixed-height fragment of the first page.
export async function addGroupedReportPages(pdf, container, html2canvas, groupSelector) {
  await document.fonts.ready
  const groups = [...container.querySelectorAll(groupSelector)]
  if (!groups.length) {
    const canvas = await html2canvas(container, { backgroundColor: '#fff', scale: 2, useCORS: true })
    addReportCanvas(pdf, canvas, { repeatHeaderHeight: 0 })
    return
  }
  const template = container.cloneNode(true)
  template.querySelectorAll(groupSelector).forEach((group) => group.remove())
  const page = template.cloneNode(true)
  container.after(page)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const maxHeight = container.getBoundingClientRect().width * (pageHeight - 10) / (pageWidth - 10)
  let pageCount = 0
  let hasRows = false
  const capture = async () => {
    const canvas = await html2canvas(page, { backgroundColor: '#fff', scale: 2, useCORS: true })
    if (pageCount++) pdf.addPage()
    const width = Math.min(pageWidth - 10, (pageHeight - 10) * canvas.width / canvas.height)
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, width, canvas.height * width / canvas.width)
  }
  try {
    for (const source of groups) {
      const rows = [...source.children].filter((node) => node.matches('.item, .line, .total, .subtotal'))
      const makeGroup = () => {
        const group = source.cloneNode(true)
        group.querySelectorAll('.item, .line, .total, .subtotal').forEach((node) => node.remove())
        page.appendChild(group)
        return group
      }
      let group = makeGroup()
      // Keep the final item and its totals together when possible.
      const lastItem = rows.findLastIndex((node) => node.matches('.item, .line'))
      const chunks = rows.slice(0, Math.max(0, lastItem)).map((row) => [row])
      chunks.push(rows.slice(Math.max(0, lastItem)))
      for (const chunk of chunks) {
        const nodes = chunk.map((row) => row.cloneNode(true))
        nodes.forEach((node) => group.appendChild(node))
        if (page.getBoundingClientRect().height > maxHeight && hasRows) {
          nodes.forEach((node) => node.remove())
          if (!group.querySelector('.item, .line, .total, .subtotal')) group.remove()
          await capture()
          page.replaceChildren(...[...template.childNodes].map((node) => node.cloneNode(true)))
          hasRows = false
          group = makeGroup()
          nodes.forEach((node) => group.appendChild(node))
        }
        hasRows = true
      }
    }
    if (hasRows) await capture()
    stampReportFooters(pdf)
  } finally {
    page.remove()
  }
}

export async function addReportDocumentPages(pdf, container, html2canvas) {
  const grouped = container.querySelector('.product, .supplier, .category, .department')
  if (grouped && grouped.tagName === 'SECTION') {
    return addGroupedReportPages(pdf, container, html2canvas, 'section.product, section.supplier, section.category, section.department')
  }
  const table = container.querySelector('table')
  if (!table) {
    const group = document.createElement('section')
    group.className = 'report-page-group'
    const rows = [...container.children].filter((node) => node.matches('.line, .total, .subtotal'))
    container.appendChild(group)
    rows.forEach((row) => group.appendChild(row))
    return addGroupedReportPages(pdf, container, html2canvas, '.report-page-group')
  }
  await document.fonts.ready
  // Preserve the widths measured with the full dataset on every page.
  const widths = [...table.querySelectorAll('thead tr:first-child th')].map((cell) => cell.getBoundingClientRect().width)
  const chunks = []
  let pending = []
  let spanRemaining = 0
  for (const row of table.querySelectorAll('tbody > tr')) {
    pending.push(row)
    spanRemaining = Math.max(spanRemaining, ...[...row.cells].map((cell) => cell.rowSpan), 1) - 1
    if (spanRemaining === 0 && !row.matches('.report-pdf__group')) {
      chunks.push(pending)
      pending = []
    }
  }
  if (pending.length) chunks.push(pending)
  const footers = [...table.querySelectorAll('tfoot > tr')]
  if (footers.length) {
    if (chunks.length) chunks[chunks.length - 1].push(...footers)
    else chunks.push(footers)
  }
  const template = container.cloneNode(true)
  template.querySelectorAll('tbody, tfoot').forEach((body) => body.replaceChildren())
  const page = template.cloneNode(true)
  container.after(page)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - 10
  const contentHeight = pageHeight - 10
  const maxHeight = container.getBoundingClientRect().width * contentHeight / contentWidth
  let count = 0
  let hasRows = false
  let activeCategory = null
  const configure = () => {
    const pageTable = page.querySelector('table')
    pageTable.style.tableLayout = 'fixed'
    if (widths.length) {
      const cols = document.createElement('colgroup')
      widths.forEach((width) => {
        const col = document.createElement('col')
        col.style.width = `${width}px`
        cols.appendChild(col)
      })
      pageTable.prepend(cols)
    }
  }
  const capture = async () => {
    const canvas = await html2canvas(page, { backgroundColor: '#fff', scale: 2, useCORS: true })
    if (count++) pdf.addPage()
    const width = Math.min(contentWidth, contentHeight * canvas.width / canvas.height)
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, width, canvas.height * width / canvas.width)
  }
  try {
    configure()
    for (const chunk of chunks) {
      const nodes = chunk.map((row) => row.cloneNode(true))
      const append = () => nodes.forEach((node, index) => page.querySelector(chunk[index].parentElement.tagName === 'TFOOT' ? 'tfoot' : 'tbody').appendChild(node))
      append()
      if (page.getBoundingClientRect().height > maxHeight && (hasRows || page.querySelector('.stock-category-charts'))) {
        nodes.forEach((node) => node.remove())
        await capture()
        page.replaceChildren(...[...template.childNodes].map((node) => node.cloneNode(true)))
        page.querySelectorAll('.stock-category-charts').forEach((node) => node.remove())
        configure()
        if (activeCategory && !chunk[0].matches('.report-pdf__group')) page.querySelector('tbody').appendChild(activeCategory.cloneNode(true))
        append()
      }
      if (chunk[0].matches('.report-pdf__group')) activeCategory = chunk[0]
      hasRows = true
    }
    await capture()
    stampReportFooters(pdf)
  } finally {
    page.remove()
  }
}

export function stampReportFooters(pdf) {
  const count = pdf.getNumberOfPages()
  for (let index = 1; index <= count; index += 1) {
    pdf.setPage(index)
    const footer = document.createElement('canvas')
    footer.width = 600
    footer.height = 120
    const ctx = footer.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, footer.width, footer.height)
    ctx.fillStyle = '#000'
    ctx.font = 'bold 42px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${index}/${count}`, 570, 58)
    pdf.addImage(footer.toDataURL('image/png'), 'PNG', pdf.internal.pageSize.getWidth() - 45,
      pdf.internal.pageSize.getHeight() - 13, 40, 10)
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
