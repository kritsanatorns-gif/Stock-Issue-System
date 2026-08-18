import { Alert, Box, Button, Typography } from '@mui/material'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { canAccessMenu, getAllowedNavigationItems } from '../../app/navigationItems'
import { useAuthStore } from '../../store/authStore'

function AccessDenied() {
  const navigate = useNavigate()

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Alert severity="warning" sx={{ mb: 2 }}>
        ไม่มีสิทธิ์เข้าใช้งานเมนูนี้
      </Alert>
      <Typography sx={{ mb: 2, color: '#475569' }}>
        กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์การใช้งานเมนูที่ต้องการ
      </Typography>
      <Button variant="contained" onClick={() => navigate('/login', { replace: true })}>
        กลับไปหน้าเข้าสู่ระบบ
      </Button>
    </Box>
  )
}

function RequireMenuAccess({ menuCode, children }) {
  const employee = useAuthStore((state) => state.employee)
  const location = useLocation()
  const allowedNavigationItems = getAllowedNavigationItems(employee)
  const firstAllowedPath = allowedNavigationItems[0]?.path

  if (canAccessMenu(employee, menuCode)) {
    return children
  }

  if (firstAllowedPath && firstAllowedPath !== location.pathname) {
    return <Navigate to={firstAllowedPath} replace />
  }

  return <AccessDenied />
}

export default RequireMenuAccess
