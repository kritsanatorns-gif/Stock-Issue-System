import { Box, Card, CardContent, Typography } from '@mui/material'

function SummaryCard({ color = '#2563eb', icon: Icon, label, value, helper }) {
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color}22, #ffffff 86%)`,
        border: `1px solid ${color}33`,
        borderRadius: 2,
        minHeight: 88,
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ color: '#475569', fontSize: 11, fontWeight: 800 }}>
              {label}
            </Typography>
            <Typography sx={{ color: '#0f172a', fontSize: 24, fontWeight: 900, mt: 0.5 }}>
              {value}
            </Typography>
          </Box>

          {Icon ? (
            <Box
              sx={{
                display: 'grid',
                width: 34,
                height: 34,
                placeItems: 'center',
                borderRadius: 2,
                bgcolor: '#ffffffcc',
                color,
              }}
            >
              <Icon size={18} />
            </Box>
          ) : null}
        </Box>

        {helper ? (
          <Typography sx={{ color: '#64748b', fontSize: 11, mt: 0.25 }}>{helper}</Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default SummaryCard
