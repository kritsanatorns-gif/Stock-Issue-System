import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

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
