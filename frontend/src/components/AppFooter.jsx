import { Box, Typography } from '@mui/material'
import './AppShell.css'

function AppFooter() {
  return (
    <Box className="app-footer" component="footer">
      <Typography className="app-footer__text">ระบบการเบิกสินค้าสำนักงาน</Typography>
      <Typography className="app-footer__text">ใช้งานภายในบริษัท</Typography>
    </Box>
  )
}

export default AppFooter
