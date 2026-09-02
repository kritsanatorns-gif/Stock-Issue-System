import { Button, Grid, MenuItem, TextField } from '@mui/material'
import { FileBarChart, Search } from 'lucide-react'
import DateInputField from '../../components/common/DateInputField'

const reportTypes = [
  { label: 'ทั้งหมด', value: 'all' },
  { label: 'เบิกสินค้า', value: 'stockIssue' },
  { label: 'รับเข้า', value: 'stockReceive' },
  { label: 'ปรับสต๊อก', value: 'stockAdjust' },
  { label: 'ถอยยอด', value: 'cancellation' },
]

function DateFilterField({ label, onChange, value }) {
  return (
    <DateInputField
      fullWidth
      label={label}
      size="small"
      value={value}
      onChange={onChange}
    />
  )
}

function ReportFilters({
  endDate,
  onEndDateChange,
  onOpenSummary,
  onReportTypeChange,
  onRunReport,
  onStartDateChange,
  reportType,
  startDate,
}) {
  return (
    <Grid container alignItems="center" spacing={2}>
      <Grid size={3}>
        <TextField
          fullWidth
          label="ประเภทรายการ"
          select
          size="small"
          value={reportType}
          onChange={(event) => onReportTypeChange(event.target.value)}
        >
          {reportTypes.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={2.25}>
        <DateFilterField
          label="วันที่เริ่มต้น"
          value={startDate}
          onChange={onStartDateChange}
        />
      </Grid>
      <Grid size={2.25}>
        <DateFilterField
          label="วันที่สิ้นสุด"
          value={endDate}
          onChange={onEndDateChange}
        />
      </Grid>
      <Grid size={2.25}>
        <Button
          fullWidth
          startIcon={<Search size={18} />}
          sx={{ fontWeight: 700, minHeight: 40 }}
          variant="contained"
          onClick={onRunReport}
        >
          ดูรายงาน
        </Button>
      </Grid>
      <Grid size={2.25}>
        <Button
          fullWidth
          startIcon={<FileBarChart size={18} />}
          sx={{ fontWeight: 700, minHeight: 40 }}
          variant="outlined"
          onClick={onOpenSummary}
        >
          สรุป
        </Button>
      </Grid>
    </Grid>
  )
}

export default ReportFilters
