import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx-js-style'

export function exportRowsToExcel(rows, columns, fileName, options = {}) {
  const exportData = rows.map((row) =>
    columns.reduce((record, column) => {
      record[column.header] = column.value(row)
      return record
    }, {}),
  )

  const { reportContext } = options
  const contextSplitAt = Math.max(1, Math.ceil(columns.length / 2))
  const contextRow = Array(Math.max(columns.length, 1)).fill('')
  contextRow[0] = reportContext?.period
  contextRow[contextSplitAt] = reportContext?.type
  const worksheet = reportContext
    ? XLSX.utils.aoa_to_sheet([contextRow, []])
    : XLSX.utils.json_to_sheet(exportData)

  if (reportContext) {
    XLSX.utils.sheet_add_json(worksheet, exportData, {
      origin: 'A3',
      skipHeader: false,
    })

    if (columns.length > 1) {
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: contextSplitAt - 1 } },
        { s: { r: 0, c: contextSplitAt }, e: { r: 0, c: columns.length - 1 } },
      ]
    }
  }
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  })
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  saveAs(blob, fileName)
}

export function exportPurchaseSummaryToExcel(rows, fileName, periodLabel) {
  const data = [[`รายงานการซื้อวัสดุอุปกรณ์ ประจำเดือน ${periodLabel}`], [], ['ลำดับ', 'ร้าน', 'จำนวนเงิน/หน่วย']]
  rows.forEach((row, index) => data.push([index + 1, row.supplierName, Number(row.totalPurchase ?? 0)]))
  data.push(['', 'ยอดรวม', rows.reduce((sum, row) => sum + Number(row.totalPurchase ?? 0), 0)])

  const worksheet = XLSX.utils.aoa_to_sheet(data)
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
  worksheet['!cols'] = [{ wch: 10 }, { wch: 50 }, { wch: 22 }]
  const border = { bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } }, top: { style: 'thin', color: { rgb: '000000' } } }
  const totalRow = data.length - 1
  data.forEach((row, rowIndex) => row.forEach((_, columnIndex) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
    if (!cell) return
    cell.s = { alignment: { horizontal: columnIndex === 2 ? 'right' : 'center', vertical: 'center' }, border, font: { name: 'Tahoma', sz: 11 } }
    if (rowIndex === 0) cell.s = { ...cell.s, alignment: { horizontal: 'center', vertical: 'center' }, font: { bold: true, name: 'Tahoma', sz: 14 } }
    if (rowIndex === 2) cell.s = { ...cell.s, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'FFFEC8' } }, font: { bold: true, name: 'Tahoma', sz: 11 } }
    if (rowIndex === totalRow) cell.s = { ...cell.s, fill: { fgColor: { rgb: columnIndex === 2 ? 'C8FACC' : 'FFFFFF' } }, font: { bold: true, name: 'Tahoma', sz: 11 } }
    if (rowIndex >= 3 && columnIndex === 2) cell.z = '#,##0.00'
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานยอดซื้อ')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName)
}

// รายงานนี้ต้องรักษาการจัดกลุ่มฝ่ายเหมือนตารางบนหน้าจอ จึงสร้าง sheet แบบ AOA
// เพื่อ merge ช่องของฝ่ายและยอดรวมฝ่ายได้จริง.
export function exportProductIssueByCategoryToExcel(groups, fileName, periodLabel) {
  const rows = [[`รายงานสินค้าที่เบิก แยกตามหมวดหมู่ ประจำเดือน ${periodLabel}`], []]
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]

  groups.forEach((group) => {
    const categoryRow = rows.length
    rows.push([`หมวด : ${group.category}`, '', ''])
    merges.push({ s: { r: categoryRow, c: 0 }, e: { r: categoryRow, c: 2 } })
    group.products.forEach((product) => rows.push(['', `${product.productName} / ${product.productCode}`, Number(product.totalQty ?? 0)]))
    rows.push(['', '', ''])
  })

  if (!groups.length) rows.push(['ไม่พบรายการเบิกในช่วงเวลาที่เลือก', '', ''])

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!merges'] = merges
  worksheet['!cols'] = [{ wch: 6 }, { wch: 68 }, { wch: 16 }]
  rows.forEach((row, rowIndex) => row.forEach((_, columnIndex) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
    if (!cell) return
    const isTitle = rowIndex === 0
    const isCategory = rowIndex > 1 && String(row[0] ?? '').startsWith('หมวด :')
    cell.s = {
      alignment: { horizontal: columnIndex === 2 ? 'right' : 'left', vertical: 'center' },
      font: { name: 'Tahoma', sz: isTitle ? 14 : 11, bold: isTitle || isCategory, color: isCategory ? { rgb: '1D4ED8' } : undefined },
    }
    if (isTitle) cell.s.alignment = { horizontal: 'center', vertical: 'center' }
    if (isCategory) cell.s.fill = { fgColor: { rgb: 'EFF6FF' } }
    if (rowIndex > 1 && columnIndex === 2 && !isCategory) cell.z = '#,##0'
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานสินค้า')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName)
}

export function exportDepartmentIssueToExcel(groups, fileName, periodLabel) {
  const rows = [[`รายงานการเบิก แยกตามแผนก ประจำเดือน ${periodLabel}`], []]
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]

  groups.forEach((group) => {
    const departmentRow = rows.length
    rows.push([`แผนก : ${group.department}`, '', ''])
    merges.push({ s: { r: departmentRow, c: 0 }, e: { r: departmentRow, c: 2 } })
    group.products.forEach((product) => rows.push(['', `${product.productName} / ${product.productCode}`, Number(product.totalQty ?? 0)]))
    rows.push(['', '', ''])
  })

  if (!groups.length) rows.push(['ไม่พบรายการเบิกในช่วงเวลาที่เลือก', '', ''])

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!merges'] = merges
  worksheet['!cols'] = [{ wch: 6 }, { wch: 68 }, { wch: 16 }]
  rows.forEach((row, rowIndex) => row.forEach((_, columnIndex) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
    if (!cell) return
    const isTitle = rowIndex === 0
    const isDepartment = rowIndex > 1 && String(row[0] ?? '').startsWith('แผนก :')
    cell.s = {
      alignment: { horizontal: columnIndex === 2 ? 'right' : 'left', vertical: 'center' },
      font: { name: 'Tahoma', sz: isTitle ? 14 : 11, bold: isTitle || isDepartment, color: isDepartment ? { rgb: '1D4ED8' } : undefined },
    }
    if (isTitle) cell.s.alignment = { horizontal: 'center', vertical: 'center' }
    if (isDepartment) cell.s.fill = { fgColor: { rgb: 'EFF6FF' } }
    if (rowIndex > 1 && columnIndex === 2 && !isDepartment) cell.z = '#,##0'
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานการเบิก')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName)
}

export function exportDivisionCostToExcel(groups, fileName, periodLabel) {
  const headers = ['ลำดับ', 'ฝ่าย', 'แผนก', 'จำนวนเงิน/แผนก', 'จำนวนเงิน/ฝ่าย']
  const rows = [[`รายงานค่าใช้จ่ายตามฝ่ายและแผนก ${periodLabel}`], [], headers]
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]
  let sheetRow = 3

  groups.forEach((group, groupIndex) => {
    const departments = group.departments.length ? group.departments : [{ department: '-', totalCost: 0 }]
    departments.forEach((department, departmentIndex) => {
      rows.push([
        departmentIndex === 0 ? groupIndex + 1 : '',
        departmentIndex === 0 ? group.division : '',
        department.department,
        Number(department.totalCost ?? 0),
        departmentIndex === 0 ? Number(group.totalCost ?? 0) : '',
      ])
    })
    if (departments.length > 1) {
      const endRow = sheetRow + departments.length - 1
      ;[0, 1, 4].forEach((column) => merges.push({ s: { r: sheetRow, c: column }, e: { r: endRow, c: column } }))
    }
    sheetRow += departments.length
  })

  const totalCost = groups.reduce((sum, group) => sum + Number(group.totalCost ?? 0), 0)
  rows.push(['', '', '', 'รวมทั้งหมด', totalCost])

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!merges'] = merges
  worksheet['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 34 }, { wch: 22 }, { wch: 22 }]
  const border = { bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } }, top: { style: 'thin', color: { rgb: '000000' } } }
  const center = { horizontal: 'center', vertical: 'center' }
  const right = { horizontal: 'right', vertical: 'center' }
  const totalRow = rows.length - 1

  rows.forEach((row, rowIndex) => row.forEach((_, columnIndex) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
    if (!cell) return
    cell.s = { alignment: columnIndex >= 3 ? right : center, border, font: { name: 'Tahoma', sz: 11 } }
    if (rowIndex === 0) {
      cell.s = { ...cell.s, alignment: center, font: { bold: true, name: 'Tahoma', sz: 14 } }
    } else if (rowIndex === 2) {
      cell.s = { ...cell.s, fill: { fgColor: { rgb: 'FFFEC8' } }, font: { bold: true, name: 'Tahoma', sz: 11 } }
    } else if (rowIndex === totalRow) {
      cell.s = { ...cell.s, fill: { fgColor: { rgb: columnIndex === 4 ? 'BAE6FD' : 'FFFFFF' } }, font: { bold: true, name: 'Tahoma', sz: 11 } }
    } else if (columnIndex === 4 && cell.v !== '') {
      cell.s = { ...cell.s, font: { bold: true, color: { rgb: 'FF0000' }, name: 'Tahoma', sz: 11 } }
    }
    if (rowIndex >= 3 && columnIndex >= 3) cell.z = '#,##0.00'
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ค่าใช้จ่ายตามฝ่าย')
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName)
}

export async function exportDivisionCostToExcelWithChart(groups, fileName, periodLabel) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const summary = workbook.addWorksheet('ค่าใช้จ่ายตามฝ่าย')
  summary.columns = [{ width: 10 }, { width: 20 }, { width: 34 }, { width: 22 }, { width: 22 }]
  summary.mergeCells('A1:E1')
  summary.getCell('A1').value = `รายงานค่าใช้จ่ายตามฝ่ายและแผนก ${periodLabel}`
  summary.getCell('A1').font = { bold: true, size: 14 }
  summary.getCell('A1').alignment = { horizontal: 'center' }
  summary.addRow([])
  const header = summary.addRow(['ลำดับ', 'ฝ่าย', 'แผนก', 'จำนวนเงิน/แผนก', 'จำนวนเงิน/ฝ่าย'])
  header.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFEC8' } }
    cell.alignment = { horizontal: 'center' }
  })
  groups.forEach((group, groupIndex) => {
    const startRow = summary.rowCount + 1
    group.departments.forEach((department, departmentIndex) => summary.addRow([
      departmentIndex === 0 ? groupIndex + 1 : '', departmentIndex === 0 ? group.division : '', department.department,
      Number(department.totalCost ?? 0), departmentIndex === 0 ? Number(group.totalCost ?? 0) : '',
    ]))
    const endRow = summary.rowCount
    if (endRow > startRow) ['A', 'B', 'E'].forEach((column) => summary.mergeCells(`${column}${startRow}:${column}${endRow}`))
    summary.getCell(`E${startRow}`).font = { bold: true, color: { argb: 'FFFF0000' } }
  })
  const grandTotal = groups.reduce((sum, group) => sum + Number(group.totalCost ?? 0), 0)
  const totalRow = summary.addRow(['', '', '', 'รวมทั้งหมด', grandTotal])
  totalRow.font = { bold: true }
  totalRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBAE6FD' } }
  summary.eachRow((row, rowNumber) => row.eachCell((cell) => {
    cell.alignment = { horizontal: cell.col >= 4 ? 'right' : 'center', vertical: 'middle' }
    if (rowNumber >= 3 && cell.col >= 4) cell.numFmt = '#,##0.00'
  }))

  // ExcelJS allows an image to be embedded in a worksheet, so the graph opens with
  // the file even though browser-side exports cannot create a native Excel chart.
  const sheet = workbook.addWorksheet('กราฟค่าใช้จ่าย')
  sheet.columns = [{ width: 32 }, { width: 18 }]
  sheet.mergeCells('A1:B1')
  sheet.getCell('A1').value = `กราฟค่าใช้จ่ายตามแผนก ${periodLabel}`
  sheet.getCell('A1').font = { bold: true, size: 14 }
  sheet.getCell('A1').alignment = { horizontal: 'center' }
  sheet.addRow([])
  sheet.addRow(['แผนก', 'จำนวนเงิน/แผนก'])

  const chartRows = groups.flatMap((group) => group.departments.map((department) => ({
    label: department.department,
    value: Number(department.totalCost ?? 0),
  }))).sort((left, right) => right.value - left.value)
  chartRows.forEach((row) => sheet.addRow([row.label, row.value]))
  sheet.getRow(3).font = { bold: true }
  sheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFEC8' } }
  sheet.getColumn(2).numFmt = '#,##0.00'

  const canvas = document.createElement('canvas')
  const rowHeight = 30
  canvas.width = 980
  canvas.height = Math.max(320, chartRows.length * rowHeight + 100)
  const context = canvas.getContext('2d')
  const maxValue = Math.max(...chartRows.map((row) => row.value), 1)
  const labelWidth = 270
  const chartWidth = 620
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#1f2937'
  context.font = 'bold 22px Tahoma'
  context.fillText('จำนวนเงิน/แผนก', labelWidth, 34)
  chartRows.forEach((row, index) => {
    const y = 62 + index * rowHeight
    const width = Math.max(2, (row.value / maxValue) * chartWidth)
    context.fillStyle = '#1f2937'
    context.font = '14px Tahoma'
    context.textAlign = 'right'
    context.fillText(row.label, labelWidth - 14, y + 15)
    context.fillStyle = '#3b82f6'
    context.fillRect(labelWidth, y, width, 18)
    context.fillStyle = '#ffffff'
    context.textAlign = 'right'
    context.fillText(row.value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), labelWidth + width - 6, y + 14)
  })

  const imageId = workbook.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' })
  sheet.addImage(imageId, { tl: { col: 3, row: 1 }, ext: { width: 720, height: canvas.height * 0.72 } })
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName)
}
