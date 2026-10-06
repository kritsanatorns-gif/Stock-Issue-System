import { Button, Chip } from '@mui/material'
import AppTable from '../../components/common/AppTable'
import { formatDisplayDateTime, getIdSortValue } from '../../utils/dateUtils'

function formatMoney(value) {
  return Number(value ?? 0).toLocaleString('th-TH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function isReversedStatus(status) {
  return ['ถอยยอด', 'ถอยยอดบางส่วน', 'ยกเลิก'].includes(String(status ?? '').trim())
}

function getDocumentTypeChipProps(row) {
  if (isReversedStatus(row.status)) {
    return {
      color: 'error',
      label: row.documentType === 'RECEIVE' ? 'ถอยยอด/รับเข้า' : 'ถอยยอด/ใบเบิก',
    }
  }

  if (row.documentType === 'RECEIVE') {
    return {
      color: 'success',
      label: 'รับเข้า',
    }
  }

  if (row.documentType === 'ADJUST') {
    return {
      color: 'warning',
      label: 'ปรับสต๊อก',
    }
  }

  return {
    color: 'primary',
    label: 'เบิกสินค้า',
  }
}

function createColumns(onViewDocument) {
  const columns = [
    { key: 'date', label: 'วันที่', width: 145, align: 'center' },
    {
      key: 'documentTypeLabel',
      label: 'ประเภทเอกสาร',
      width: 135,
      align: 'center',
      render: (row) => {
        const chipProps = getDocumentTypeChipProps(row)

        return (
          <Chip
            color={chipProps.color}
            label={chipProps.label}
            size="small"
          />
        )
      },
    },
    { key: 'employeeDepartment', label: 'แผนกทำรายการ', width: 125, align: 'center' },
    {
      key: 'requestDepartment',
      label: 'แผนกผู้เบิก',
      width: 115,
      align: 'center',
      render: (row) => row.documentType === 'ISSUE' ? (row.requestDepartment || '-') : '-',
    },
    {
      key: 'unitName',
      label: 'หน่วยงานผู้ขอเบิก',
      width: 200,
      headerAlign: 'center',
      bodyAlign: 'left',
      wrap: true,
      value: (row) => row.unitName || '-',
    },
    {
      key: 'poInvoiceNo',
      label: 'Invoice',
      width: 100,
      align: 'center',
      render: (row) => row.documentType === 'RECEIVE' ? (row.poInvoiceNo || '-') : '-',
    },
    { key: 'totalItems', label: 'จำนวนรายการสินค้า', width: 150, align: 'center' },
    { key: 'totalQty', label: 'จำนวนรวม', width: 100, align: 'center' },
    {
      key: 'totalCost',
      label: 'ต้นทุนรวม',
      width: 120,
      align: 'center',
      render: (row) => formatMoney(row.totalCost),
    },
    { key: 'employeeName', label: 'ผู้ทำรายการ', width: 150, wrap: true },
    {
      key: 'action',
      label: 'รายการ',
      width: 100,
      searchable: false,
      sortable: false,
      render: (row) => (
        <Button size="small" variant="outlined" onClick={() => onViewDocument(row.documentNo)}>
          ดูรายการ
        </Button>
      ),
    },
  ]

  return columns.map((column) => (
    column.key === 'date'
      ? {
        ...column,
        sortValue: (row) => getIdSortValue(row.sortId, row.headerId, row.documentId, row.documentNo, row.requestNo)
          || Date.parse(row.createdAt ?? row.date ?? '')
          || 0,
        value: (row) => (row.createdAt ? formatDisplayDateTime(row.createdAt) : row.date),
      }
      : column
  ))
}

function ReportDataTable({ data, isLoading, onViewDocument }) {
  const columns = createColumns(onViewDocument)

  return (
    <AppTable
      columns={columns}
      fitToWidth
      defaultSortDirection="desc"
      defaultSortField="date"
      isLoading={isLoading}
      noDataText="ไม่พบข้อมูลเอกสาร"
      rowKey={(row) => `${row.documentType}-${row.documentNo}`}
      rows={data}
      showGlobalSearch={false}
    />
  )
}

export default ReportDataTable
