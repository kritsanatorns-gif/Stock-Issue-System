import DataTable from 'react-data-table-component'

const defaultCustomStyles = {
  table: {
    style: {
      border: '1px solid #d9e0ea',
      borderRadius: 8,
      overflow: 'hidden',
    },
  },
  headRow: {
    style: {
      minHeight: 48,
      backgroundColor: '#f8fafc',
      borderBottomColor: '#d9e0ea',
    },
  },
  headCells: {
    style: {
      color: '#334155',
      fontSize: 13,
      fontWeight: 800,
    },
  },
  rows: {
    style: {
      minHeight: 52,
      fontSize: 13,
    },
  },
}

const defaultPaginationComponentOptions = {
  rowsPerPageText: 'Rows per page',
  rangeSeparatorText: 'of',
}

function AppDataTable({
  columns,
  data,
  isLoading = false,
  noDataText = 'No records found',
  defaultSortFieldId,
  defaultSortAsc = false,
  pagination = true,
  paginationPerPage = 10,
  paginationRowsPerPageOptions = [10, 25, 50, 100],
  customStyles = defaultCustomStyles,
  paginationComponentOptions = defaultPaginationComponentOptions,
  ...rest
}) {
  return (
    <DataTable
      columns={columns}
      customStyles={customStyles}
      data={data}
      defaultSortAsc={defaultSortAsc}
      defaultSortFieldId={defaultSortFieldId}
      highlightOnHover
      noDataComponent={noDataText}
      pagination={pagination}
      paginationComponentOptions={paginationComponentOptions}
      paginationPerPage={paginationPerPage}
      paginationRowsPerPageOptions={paginationRowsPerPageOptions}
      persistTableHead
      progressPending={isLoading}
      striped
      {...rest}
    />
  )
}

export default AppDataTable
