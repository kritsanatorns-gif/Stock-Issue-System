import {
  Box,
  FormControl,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Select,
  MenuItem,
  Typography,
  IconButton,
} from '@mui/material'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'

function getCellValue(row, column) {
  if (column.value) {
    return column.value(row)
  }

  return row[column.key]
}

function getSortValue(row, column) {
  if (column.sortValue) {
    return column.sortValue(row)
  }

  return getCellValue(row, column)
}

function includesSearch(value, searchText) {
  return String(value ?? '').toLowerCase().includes(searchText.trim().toLowerCase())
}

function compareValues(firstValue, secondValue, direction) {
  const firstNumber = Number(firstValue)
  const secondNumber = Number(secondValue)
  const bothNumbers = !Number.isNaN(firstNumber) && !Number.isNaN(secondNumber)

  const result = bothNumbers
    ? firstNumber - secondNumber
    : String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'th')

  return direction === 'asc' ? result : -result
}

function AppTable({
  columns,
  rows,
  defaultSortField,
  defaultSortDirection = 'desc',
  globalSearchPlaceholder = 'ค้นหา / กรองข้อมูล',
  isLoading = false,
  maxHeight = 'calc(100vh - 310px)',
  noDataText = 'No records found',
  expandable = false,
  fitToWidth = false,
  isRowExpanded,
  onToggleRow,
  renderExpandedRow,
  rowKey,
  showColumnFilters = true,
  showGlobalSearch = false,
  showPagination = true,
}) {
  const firstSortableColumn = columns.find((column) => column.sortable !== false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState({})
  const [sortConfig, setSortConfig] = useState({
    direction: defaultSortDirection,
    field: defaultSortField ?? firstSortableColumn?.key ?? '',
  })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const visibleColumns = columns.filter((column) => column.hidden !== true)

  const filteredRows = useMemo(() => {
    const searchableColumns = visibleColumns.filter((column) => column.searchable !== false)

    return rows.filter((row) => {
      const matchesGlobal = globalSearch.trim()
        ? searchableColumns.some((column) => includesSearch(getCellValue(row, column), globalSearch))
        : true

      const matchesColumns = searchableColumns.every((column) => {
        const keyword = columnFilters[column.key]

        return keyword ? includesSearch(getCellValue(row, column), keyword) : true
      })

      return matchesGlobal && matchesColumns
    })
  }, [columnFilters, globalSearch, rows, visibleColumns])

  const sortedRows = useMemo(() => {
    if (!sortConfig.field) {
      return filteredRows
    }

    const sortColumn = visibleColumns.find((column) => column.key === sortConfig.field)

    if (!sortColumn) {
      return filteredRows
    }

    return [...filteredRows].sort((firstRow, secondRow) =>
      compareValues(
        getSortValue(firstRow, sortColumn),
        getSortValue(secondRow, sortColumn),
        sortConfig.direction,
      ),
    )
  }, [filteredRows, sortConfig, visibleColumns])

  const paginatedRows = useMemo(
    () => showPagination ? sortedRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage) : sortedRows,
    [page, rowsPerPage, showPagination, sortedRows],
  )

  useEffect(() => {
    setPage(0)
  }, [columnFilters, globalSearch, rows, sortConfig])

  const handleSort = (field) => {
    setSortConfig((current) => ({
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
      field,
    }))
  }

  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') {
      return rowKey(row)
    }

    if (rowKey) {
      return row[rowKey]
    }

    return row.id ?? `${index}`
  }

  return (
    <Box>
      {showPagination || showGlobalSearch ? (
        <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          {showPagination ? (
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <Typography sx={{ color: '#475569', fontSize: 14 }}>แสดงต่อหน้า:</Typography>
              <FormControl size="small">
                <Select
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value))
                    setPage(0)
                  }}
                  sx={{ fontSize: 14, minWidth: 72 }}
                >
                  {[10, 25, 50, 100].map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          ) : <Box />}
          {showGlobalSearch ? (
            <TextField
              placeholder={globalSearchPlaceholder}
              size="small"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search color="#64748b" size={18} /></InputAdornment> } }}
              sx={{ maxWidth: 560, width: '100%' }}
            />
          ) : null}
        </Box>
      ) : null}

      <TableContainer
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 1.5,
          maxHeight,
          overflowX: 'auto',
          width: '100%',
        }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{
            tableLayout: fitToWidth ? 'fixed' : 'auto',
            minWidth: '100%',
            width: fitToWidth ? '100%' : 'max-content',
            '& .MuiTableCell-root': {
              borderBottom: '1px solid #cbd5e1',
            },
            '& .MuiTableCell-root:not(:last-of-type)': {
              borderRight: '1px solid #d4dce7',
            },
          }}
        >
          <TableHead>
            <TableRow>
              {expandable ? (
                <TableCell
                  align="center"
                  sx={{
                    bgcolor: '#f8fafc',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 800,
                    width: 44,
                  }}
                />
              ) : null}
              {visibleColumns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.headerAlign ?? column.align ?? 'center'}
                  sx={{
                    bgcolor: '#f8fafc',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 800,
                    minWidth: fitToWidth ? 0 : column.width,
                    width: column.width,
                    '& .MuiTableSortLabel-icon': {
                      opacity: 0.55,
                    },
                    '& .MuiTableSortLabel-root.Mui-active .MuiTableSortLabel-icon': {
                      opacity: 1,
                    },
                  }}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={sortConfig.field === column.key}
                      direction={sortConfig.field === column.key ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort(column.key)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>

            {showColumnFilters ? (
              <TableRow>
                {expandable ? (
                  <TableCell
                    sx={{
                      bgcolor: '#f8fafc',
                      p: 0.75,
                      width: 44,
                    }}
                  >
                    <Box sx={{ height: 32 }} />
                  </TableCell>
                ) : null}
                {visibleColumns.map((column) => (
                  <TableCell
                    key={column.key}
                    sx={{
                      bgcolor: '#f8fafc',
                      minWidth: fitToWidth ? 0 : column.width,
                      p: 0.75,
                      width: column.width,
                    }}
                  >
                    {column.searchable !== false ? (
                      <TextField
                        fullWidth
                        placeholder="Search"
                        size="small"
                        value={columnFilters[column.key] ?? ''}
                        onChange={(event) =>
                          setColumnFilters((current) => ({
                            ...current,
                            [column.key]: event.target.value,
                          }))
                        }
                        slotProps={{
                          htmlInput: {
                            style: { fontSize: 12, padding: '6px 8px' },
                          },
                        }}
                      />
                    ) : (
                      <Box sx={{ height: 32 }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ) : null}
          </TableHead>

          <TableBody>
            {paginatedRows.map((row, index) => {
              const key = getRowKey(row, page * rowsPerPage + index)
              const expanded = Boolean(isRowExpanded?.(row))

              return (
                <Fragment key={key}>
                  <TableRow key={key} hover>
                    {expandable ? (
                      <TableCell align="center" sx={{ width: 44 }}>
                        <IconButton
                          aria-label={expanded ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียด'}
                          size="small"
                          onClick={() => onToggleRow?.(row)}
                          sx={{
                            bgcolor: expanded ? '#dbeafe' : '#f8fafc',
                            border: '1px solid',
                            borderColor: expanded ? '#93c5fd' : '#cbd5e1',
                            color: expanded ? '#1d4ed8' : '#475569',
                            height: 26,
                            width: 26,
                            '&:hover': {
                              bgcolor: expanded ? '#bfdbfe' : '#e2e8f0',
                              borderColor: expanded ? '#60a5fa' : '#94a3b8',
                            },
                          }}
                        >
                          {expanded ? (
                            <ChevronDown size={17} strokeWidth={2.4} />
                          ) : (
                            <ChevronRight size={17} strokeWidth={2.4} />
                          )}
                        </IconButton>
                      </TableCell>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        align={column.align ?? 'center'}
                        sx={{
                          color: '#0f172a',
                          fontSize: 13,
                          whiteSpace: column.wrap ? 'normal' : 'nowrap',
                        }}
                      >
                        {column.render ? column.render(row) : getCellValue(row, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expanded && renderExpandedRow ? (
                    <TableRow key={`${key}-expanded`}>
                      <TableCell
                        colSpan={visibleColumns.length + (expandable ? 1 : 0)}
                        sx={{ bgcolor: '#f8fafc', p: 1.5 }}
                      >
                        {renderExpandedRow(row)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}

            {!sortedRows.length ? (
              <TableRow>
                <TableCell
                  align="center"
                  colSpan={visibleColumns.length + (expandable ? 1 : 0)}
                  sx={{ py: 5 }}
                >
                  {isLoading ? 'กำลังโหลดข้อมูล...' : noDataText}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      {showPagination ? (
        <TablePagination
          component="div"
          count={sortedRows.length}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
          labelRowsPerPage=""
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[]}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value))
            setPage(0)
          }}
          sx={{ borderTop: '1px solid #e2e8f0', mt: 0.5 }}
        />
      ) : null}
    </Box>
  )
}

export default AppTable
