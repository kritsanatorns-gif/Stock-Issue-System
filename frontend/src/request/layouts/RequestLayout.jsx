import {
  Avatar,
  Badge,
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
import { Bell, ChevronDown, ClipboardList, History, Menu as MenuIcon, Moon, PackageCheck, Sun } from 'lucide-react'
import { useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { getRequisitions } from '../../api/api'
import { connectNotificationHub } from '../../api/notificationHub'
import { useRequestAuthStore } from '../../store/requestAuthStore'
import { ColorModeContext } from '../../theme/ColorModeContext'
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

function getNotificationMeta(statusId) {
  if (statusId === 7) return { label: 'HR จ่ายสินค้าให้ครบแล้ว', color: 'success' }
  if (statusId === 8) return { label: 'HR จ่ายสินค้าแล้วบางส่วน มีรายการค้าง', color: 'warning' }
  if (statusId === 9) return { label: 'HR ไม่อนุมัติคำขอเบิก', color: 'error' }
  return null
}

function RequestLayout() {
  const navigate = useNavigate()
  const employee = useRequestAuthStore((state) => state.employee)
  const { mode, toggleColorMode } = useContext(ColorModeContext)
  const logout = useRequestAuthStore((state) => state.logout)
  const isAuthenticated = useRequestAuthStore((state) => state.isAuthenticated)
  const expiresAt = useRequestAuthStore((state) => state.expiresAt)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [userMenuAnchor, setUserMenuAnchor] = useState(null)
  const [notificationAnchor, setNotificationAnchor] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notCompletedRequestCount, setNotCompletedRequestCount] = useState(0)
  const isCompactScreen = useMediaQuery('(max-width:900px)')
  const sidebarCollapsed = isCompactScreen || isSidebarCollapsed
  const isSessionActive = isAuthenticated && expiresAt && expiresAt > Date.now()
  const isUserMenuOpen = Boolean(userMenuAnchor)
  const isNotificationOpen = Boolean(notificationAnchor)
  const employeeId = Number(employee?.employeeId ?? employee?.EmployeeId ?? employee?.id ?? 0)

  if (!isSessionActive) {
    return <Navigate to="/request-login" replace />
  }

  const requesterName = employee?.employeeName || employee?.name || employee?.username || 'ผู้ขอเบิก'
  const department = employee?.department || '-'
  const notificationStorageKey = `stock-issue-request-notifications-v3-${employeeId || requesterName}`
  const statusStorageKey = `stock-issue-request-statuses-v3-${employeeId || requesterName}`

  const matchesCurrentRequester = useCallback((row) => {
    const rowEmployeeId = Number(row.employeeId ?? row.EmployeeId ?? 0)
    const rowName = row.employeeName ?? row.EmployeeName ?? ''
    const rowDepartment = row.department ?? row.Department ?? ''
    return (employeeId > 0 && rowEmployeeId === employeeId)
      || (requesterName && rowName === requesterName && department && rowDepartment === department)
  }, [department, employeeId, requesterName])

  const checkRequestStatuses = useCallback(async () => {
    try {
      const requests = (await getRequisitions()).filter(matchesCurrentRequester)
      setNotCompletedRequestCount(requests.filter((request) => Number(request.statusId ?? request.StatusId ?? 0) !== 7).length)
      const previousStatuses = JSON.parse(localStorage.getItem(statusStorageKey) || '{}')
      const storedNotifications = JSON.parse(localStorage.getItem(notificationStorageKey) || '[]')
      const nextStatuses = {}
      const nextNotifications = [...storedNotifications]

      requests.forEach((request) => {
        const headerId = String(request.headerId ?? request.HeaderId ?? '')
        const statusId = Number(request.statusId ?? request.StatusId ?? 0)
        const meta = getNotificationMeta(statusId)
        nextStatuses[headerId] = statusId

        if (meta && previousStatuses[headerId] !== undefined && previousStatuses[headerId] !== statusId) {
          const notificationId = `${headerId}-${statusId}`
          if (!nextNotifications.some((item) => item.id === notificationId)) {
            nextNotifications.unshift({
              id: notificationId,
              label: meta.label,
              read: false,
              requestNo: request.requestNo ?? request.RequestNo ?? `คำขอ #${headerId}`,
              statusId,
            })
          }
        }
      })

      localStorage.setItem(statusStorageKey, JSON.stringify(nextStatuses))
      localStorage.setItem(notificationStorageKey, JSON.stringify(nextNotifications.slice(0, 30)))
      setNotifications(nextNotifications.slice(0, 30))
    } catch {
      // Keep the request page usable even if the periodic status check fails.
    }
  }, [matchesCurrentRequester, notificationStorageKey, statusStorageKey])

  useEffect(() => {
    setNotifications(JSON.parse(localStorage.getItem(notificationStorageKey) || '[]'))
    checkRequestStatuses()
    let connection
    let active = true

    if (employeeId > 0) {
      connectNotificationHub({
        groupMethod: 'JoinRequesterNotifications',
        groupArguments: [employeeId],
        handlers: {
          RequisitionStatusChanged: (request) => {
            if (!active) return

            const headerId = String(request.headerId ?? request.HeaderId ?? '')
            const statusId = Number(request.statusId ?? request.StatusId ?? 0)
            const previousStatuses = JSON.parse(localStorage.getItem(statusStorageKey) || '{}')
            const previousStatusId = Number(previousStatuses[headerId] ?? 0)
            const meta = getNotificationMeta(statusId)

            previousStatuses[headerId] = statusId
            localStorage.setItem(statusStorageKey, JSON.stringify(previousStatuses))
            setNotCompletedRequestCount((current) => {
              if (statusId === 7 && previousStatusId !== 7) return Math.max(0, current - 1)
              if (statusId !== 7 && previousStatusId === 7) return current + 1
              return current
            })

            if (!meta || previousStatusId === statusId) return

            const notificationId = `${headerId}-${statusId}`
            setNotifications((current) => {
              if (current.some((item) => item.id === notificationId)) return current

              const nextNotifications = [{
                id: notificationId,
                label: meta.label,
                read: false,
                requestNo: request.requestNo ?? request.RequestNo ?? `คำขอ #${headerId}`,
                statusId,
              }, ...current].slice(0, 30)
              localStorage.setItem(notificationStorageKey, JSON.stringify(nextNotifications))
              return nextNotifications
            })
          },
        },
      }).then((startedConnection) => {
        if (active) connection = startedConnection
        else startedConnection.stop()
      }).catch(() => {
        // The history page remains available even if realtime connection is unavailable.
      })
    }

    return () => {
      active = false
      connection?.stop()
    }
  }, [checkRequestStatuses, employeeId, notificationStorageKey, statusStorageKey])

  const unreadNotificationCount = notifications.filter((item) => !item.read).length
  const handleOpenNotifications = (event) => {
    setNotificationAnchor(event.currentTarget)
    const nextNotifications = notifications.map((item) => ({ ...item, read: true }))
    setNotifications(nextNotifications)
    localStorage.setItem(notificationStorageKey, JSON.stringify(nextNotifications))
  }
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
            const showRequestCount = item.path === '/request/history' && notCompletedRequestCount > 0

            return (
              <Tooltip key={item.path} placement="right" title={sidebarCollapsed ? item.label : ''}>
                <ListItemButton className="app-sidebar__nav-item" component={NavLink} end={item.path === '/request'} to={item.path}>
                  <ListItemIcon className="app-sidebar__nav-icon">
                    {showRequestCount ? (
                      <Badge badgeContent={notCompletedRequestCount} color="error" max={9}>
                        <Icon size={19} />
                      </Badge>
                    ) : (
                      <Icon size={19} />
                    )}
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

          <IconButton
            aria-label="การแจ้งเตือนคำขอเบิก"
            onClick={handleOpenNotifications}
            sx={{ border: '1px solid #d7e3f4', borderRadius: 2 }}
          >
            <Badge badgeContent={unreadNotificationCount} color="error" max={9}>
              <Bell size={20} />
            </Badge>
          </IconButton>

          <Tooltip title={mode === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}>
            <IconButton
              aria-label={mode === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
              onClick={toggleColorMode}
              sx={{ border: '1px solid #d7e3f4', borderRadius: 2 }}
            >
              {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </IconButton>
          </Tooltip>

          <MuiMenu
            anchorEl={notificationAnchor}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            id="request-notification-menu"
            open={isNotificationOpen}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            onClose={() => setNotificationAnchor(null)}
            slotProps={{ paper: { sx: { maxWidth: 360, minWidth: 300 } } }}
          >
            {notifications.length === 0 ? (
              <MenuItem disabled>ยังไม่มีการแจ้งเตือน</MenuItem>
            ) : notifications.map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => {
                  setNotificationAnchor(null)
                  navigate('/request/history')
                }}
                sx={{ alignItems: 'flex-start', py: 1.25, whiteSpace: 'normal' }}
              >
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 900 }}>{notification.requestNo}</Typography>
                  <Typography sx={{ color: '#475569', fontSize: 12 }}>{notification.label}</Typography>
                </Box>
              </MenuItem>
            ))}
          </MuiMenu>

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
