import { Button, Grid, TextField } from '@mui/material'
import { Download } from 'lucide-react'
import DateInputField from '../../components/common/DateInputField'

function HistoryFilters({
  barcode,
  employee,
  endDate,
  onBarcodeChange,
  onEmployeeChange,
  onEndDateChange,
  onExport,
  onStartDateChange,
  startDate,
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={2.4}>
        <DateInputField
          fullWidth
          label="วันที่เริ่มต้น"
          size="small"
          value={startDate}
          onChange={onStartDateChange}
        />
      </Grid>
      <Grid size={2.4}>
        <DateInputField
          fullWidth
          label="วันที่สิ้นสุด"
          size="small"
          value={endDate}
          onChange={onEndDateChange}
        />
      </Grid>
      <Grid size={2.4}>
        <TextField
          fullWidth
          label="บาร์โค้ด"
          size="small"
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
        />
      </Grid>
      <Grid size={2.4}>
        <TextField
          fullWidth
          label="พนักงาน"
          size="small"
          value={employee}
          onChange={(event) => onEmployeeChange(event.target.value)}
        />
      </Grid>
      <Grid size={2.4}>
        <Button
          fullWidth
          startIcon={<Download size={18} />}
          sx={{ minHeight: 40, fontWeight: 700 }}
          variant="contained"
          onClick={onExport}
        >
          ส่งออก Excel
        </Button>
      </Grid>
    </Grid>
  )
}

export default HistoryFilters
