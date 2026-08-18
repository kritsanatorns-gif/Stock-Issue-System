import { Box, Card, CardContent, Typography } from '@mui/material'

function ReportSummaryCard({ color = '#2563eb', label, value }) {
  return (
    <Card
      elevation={0}
      sx={{
        background: `linear-gradient(135deg, ${color}22, #ffffff 86%)`,
        border: `1px solid ${color}33`,
        borderRadius: 2,
        minHeight: 82,
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Box>
          <Typography sx={{ color: '#475569', fontSize: 11, fontWeight: 800 }}>
            {label}
          </Typography>
          <Typography sx={{ color: '#0f172a', fontSize: 24, fontWeight: 900, mt: 0.5 }}>
            {value}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ReportSummaryCard
