import {
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu as MuiMenu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { ChevronDown, ClipboardList, History, Menu as MenuIcon, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useRequestAuthStore } from '../../store/requestAuthStore'
import '../../components/AppShell.css'
import '../../layouts/MainLayout.css'

const requestNavigationItems = [
  {
    icon: PackageCheck,
    label: 'เบิกสินค้า',
    path: '/request',
  },
  {
    icon: History,
    label: 'ประวัติของฉัน',
    path: '/request/history',
  },
]

function getInitials(name) {
  return String(name || 'U')
    .trim()
    .slice(0, 2)
    .toUpperCase()
}

function RequestLayout() {
  const navigate = useNavigate()
  const employee = useRequestAuthStore((state) => state.employee)
  const logout = useRequestAuthStore((state) => state.logout)
  const isAuthenticated = useRequestAuthStore((state) => state.isAuthenticated)
  const expiresAt = useRequestAuthStore((state) => state.expiresAt)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [userMenuAnchor, setUserMenuAnchor] = useState(null)
  const isCompactScreen = useMediaQuery('(max-width:900px)')
  const sidebarCollapsed = isCompactScreen || isSidebarCollapsed
  const isSessionActive = isAuthenticated && expiresAt && expiresAt > Date.now()
  const isUserMenuOpen = Boolean(userMenuAnchor)

  if (!isSessionActive) {
    return <Navigate to="/request-login" replace />
  }

  const requesterName = employee?.employeeName || employee?.name || employee?.username || 'ผู้ขอเบิก'
  const department = employee?.department || '-'
  const handleLogout = () => {
    setUserMenuAnchor(null)
    logout()
    navigate('/request-login', { replace: true })
  }

  return (
    <Box className="main-layout">
      <Box className={sidebarCollapsed ? 'app-sidebar app-sidebar--collapsed' : 'app-sidebar'} component="aside">
        <Box className="app-sidebar__brand">
          <Box className="app-sidebar__brand-row">
            <Box className="app-sidebar__brand-icon">
              <ClipboardList size={22} />
            </Box>
            {!sidebarCollapsed ? (
              <Box>
                <Typography className="app-sidebar__brand-title">ขอเบิกสินค้า</Typography>
                <Typography className="app-sidebar__brand-subtitle">สำหรับพนักงาน</Typography>
              </Box>
            ) : null}
          </Box>
        </Box>

        <Divider className="app-sidebar__divider" />

        <List className="app-sidebar__nav">
          {requestNavigationItems.map((item) => {
            const Icon = item.icon

            return (
              <Tooltip key={item.path} placement="right" title={sidebarCollapsed ? item.label : ''}>
                <ListItemButton className="app-sidebar__nav-item" component={NavLink} end={item.path === '/request'} to={item.path}>
                  <ListItemIcon className="app-sidebar__nav-icon">
                    <Icon size={19} />
                  </ListItemIcon>
                  {!sidebarCollapsed ? (
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          fontSize: 14,
                          fontWeight: 600,
                        },
                      }}
                    />
                  ) : null}
                </ListItemButton>
              </Tooltip>
            )
          })}
        </List>
      </Box>

      <Box className="main-layout__body" component="section">
        <Box
          component="header"
          sx={{
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderBottom: '1px solid #dbe4f0',
            display: 'flex',
            gap: 2,
            minHeight: 72,
            px: 3,
          }}
        >
          <IconButton
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            sx={{ border: '1px solid #cbd5e1', borderRadius: 1.5 }}
          >
            <MenuIcon size={20} />
          </IconButton>

          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: '#0f172a', fontSize: 18, fontWeight: 900 }}>
              ระบบขอเบิกสินค้าสำนักงาน
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 13 }}>
              ส่งคำขอเบิกและติดตามประวัติของตัวเอง
            </Typography>
          </Box>

          <Tooltip title="เมนูผู้ใช้งาน">
            <IconButton
              aria-controls={isUserMenuOpen ? 'request-user-menu' : undefined}
              aria-expanded={isUserMenuOpen ? 'true' : undefined}
              aria-haspopup="true"
              onClick={(event) => setUserMenuAnchor(event.currentTarget)}
              sx={{
                border: '1px solid #d7e3f4',
                borderRadius: 2,
                gap: 1.25,
                px: 1.25,
                py: 0.75,
              }}
            >
              <Avatar sx={{ bgcolor: '#2563eb', fontSize: 13, fontWeight: 900, height: 34, width: 34 }}>
                {getInitials(requesterName)}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1, textAlign: 'left' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 900 }}>{requesterName}</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12 }}>{department}</Typography>
              </Box>
              <ChevronDown size={16} />
            </IconButton>
          </Tooltip>

          <MuiMenu
            anchorEl={userMenuAnchor}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            id="request-user-menu"
            open={isUserMenuOpen}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            onClose={() => setUserMenuAnchor(null)}
          >
            <MenuItem onClick={handleLogout}>ออกจากระบบ</MenuItem>
          </MuiMenu>
        </Box>

        <Box className="main-layout__main" component="main">
          <Outlet />
        </Box>

        <Box
          component="footer"
          sx={{
            borderTop: '1px solid #dbe4f0',
            color: '#64748b',
            display: 'flex',
            fontSize: 12,
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
          }}
        >
          <span>ระบบการเบิกสินค้าสำนักงาน</span>
          <span>สำหรับพนักงานภายในบริษัท</span>
        </Box>
      </Box>
    </Box>
  )
}

export default RequestLayout
