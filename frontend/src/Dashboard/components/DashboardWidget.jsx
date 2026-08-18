import { Card, CardContent, Stack, Typography } from '@mui/material'

function DashboardWidget({ children, title }) {
  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid #d9e0ea',
        borderRadius: 2,
        bgcolor: '#ffffff',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 800 }}>
            {title}
          </Typography>
          {children}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default DashboardWidget
