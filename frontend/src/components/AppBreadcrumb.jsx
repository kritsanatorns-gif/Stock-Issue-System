import { Breadcrumbs, Link, Typography } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import './AppShell.css'

const labelsByPath = {
  '/dashboard': 'หน้าหลัก',
  '/stock-issue': 'เบิกสินค้า',
  '/approvals': 'รายการขอเบิก',
  '/stock-in': 'นำของเข้า',
  '/stock-adjust': 'ปรับสต๊อก',
  '/products': 'สินค้า / ยอดคงเหลือ',
  '/stock-balance': 'สินค้า / ยอดคงเหลือ',
  '/history': 'ประวัติ',
  '/reports': 'รายงาน',
  '/users': 'ผู้ใช้งาน',
  '/departments': 'แผนก',
  '/suppliers': 'จัดการผู้ขาย',
}

function AppBreadcrumb() {
  const { pathname } = useLocation()
  const currentLabel = labelsByPath[pathname] ?? 'หน้าหลัก'

  return (
    <Breadcrumbs aria-label="breadcrumb" className="app-breadcrumb">
      <Link
        className="app-breadcrumb__link"
        component={RouterLink}
        to="/dashboard"
        underline="hover"
      >
        หน้าหลัก
      </Link>
      <Typography className="app-breadcrumb__current">{currentLabel}</Typography>
    </Breadcrumbs>
  )
}

export default AppBreadcrumb
