import AppTable from '../../components/common/AppTable'
import { formatDisplayDateTime, getIdSortValue } from '../../utils/dateUtils'

const columns = [
  {
    key: 'transactionDate',
    label: 'Date',
    width: 170,
    align: 'center',
    value: (row) => formatDisplayDateTime(row.transactionDate),
    sortValue: (row) => getIdSortValue(row.transactionId, row.detailId, row.headerId, row.referenceNo)
      || Date.parse(row.transactionDate ?? '')
      || 0,
  },
  { key: 'transactionType', label: 'Type', width: 130, align: 'center' },
  { key: 'barcode', label: 'Barcode', width: 180 },
  { key: 'productName', label: 'Product Name', width: 280 },
  { key: 'quantity', label: 'Qty', width: 100, align: 'center' },
  { key: 'employeeName', label: 'Employee', width: 180 },
  { key: 'referenceNo', label: 'Reference', width: 180 },
]

function TransactionHistoryDataTable({ data, isLoading }) {
  return (
    <AppTable
      columns={columns}
      defaultSortDirection="desc"
      defaultSortField="transactionDate"
      isLoading={isLoading}
      noDataText="No transactions found"
      rowKey={(row) => `${row.transactionDate}-${row.barcode}-${row.referenceNo}`}
      rows={data}
      showGlobalSearch={false}
    />
  )
}

export default TransactionHistoryDataTable
