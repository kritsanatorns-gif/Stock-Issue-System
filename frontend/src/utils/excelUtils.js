import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

export function exportRowsToExcel(rows, columns, fileName) {
  const exportData = rows.map((row) =>
    columns.reduce((record, column) => {
      record[column.header] = column.value(row)
      return record
    }, {}),
  )

  const worksheet = XLSX.utils.json_to_sheet(exportData)
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
