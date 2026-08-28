import { Badge, Box, IconButton, Menu as MuiMenu, MenuItem, Tooltip, Typography } from '@mui/material'
import { Bell, Menu, Moon, Sun } from 'lucide-react'
import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectNotificationHub } from '../api/notificationHub'
import { canAccessMenu } from '../app/navigationItems'
import { useAuthStore } from '../store/authStore'
import { ColorModeContext } from '../theme/ColorModeContext'
import UserMenu from './UserMenu'
import './AppShell.css'

function AppHeader({ onToggleSidebar, sidebarCollapsed }) {
  const { mode, toggleColorMode } = useContext(ColorModeContext)
  const navigate = useNavigate()
  const employee = useAuthStore((state) => state.employee)
  const isDarkMode = mode === 'dark'
  const [notificationAnchor, setNotificationAnchor] = useState(null)
  const [notifications, setNotifications] = useState([])
  const canApproveRequests = canAccessMenu(employee, 'APPROVALS')
  const employeeId = Number(employee?.id ?? employee?.employeeId ?? employee?.EmployeeId ?? 0)
  const employeeName = employee?.fullName || employee?.employeeName || employee?.name || employee?.username || 'hr'
  const notificationStorageKey = `stock-issue-hr-request-notifications-v1-${employeeId || employeeName}`
  const sidebarToggleLabel = sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'
  const themeToggleLabel = isDarkMode ? 'โหมดสว่าง' : 'โหมดมืด'
  const isNotificationOpen = Boolean(notificationAnchor)

  useEffect(() => {
    if (!canApproveRequests) {
      setNotifications([])
      return undefined
    }

    setNotifications(JSON.parse(localStorage.getItem(notificationStorageKey) || '[]'))
    let connection
    let active = true

    connectNotificationHub({
      groupMethod: 'JoinHrNotifications',
      handlers: {
        RequisitionCreated: (request) => {
          if (!active) return

          const headerId = String(request.headerId ?? request.HeaderId ?? '')
          const notificationId = `new-request-${headerId}`
          setNotifications((current) => {
            if (current.some((item) => item.id === notificationId)) return current

            const nextNotifications = [{
              id: notificationId,
              requestNo: request.requestNo ?? request.RequestNo ?? `คำขอ #${headerId}`,
              requester: request.employeeName ?? request.EmployeeName ?? '-',
              label: 'มีคำขอเบิกสินค้าใหม่จากผู้ใช้',
              read: false,
            }, ...current].slice(0, 30)
            localStorage.setItem(notificationStorageKey, JSON.stringify(nextNotifications))
            window.dispatchEvent(new CustomEvent('stock-issue:requisition-created'))
            return nextNotifications
          })
        },
      },
    }).then((startedConnection) => {
      if (active) connection = startedConnection
      else startedConnection.stop()
    }).catch(() => {
      // Realtime notifications are optional; normal HR pages remain available.
    })

    return () => {
      active = false
      connection?.stop()
    }
  }, [canApproveRequests, notificationStorageKey])

  const unreadNotificationCount = notifications.filter((item) => !item.read).length
  const handleOpenNotifications = (event) => {
    setNotificationAnchor(event.currentTarget)
    const nextNotifications = notifications.map((item) => ({ ...item, read: true }))
    setNotifications(nextNotifications)
    localStorage.setItem(notificationStorageKey, JSON.stringify(nextNotifications))
  }

  return (
    <Box className="app-header" component="header">
      <Box className="app-header__left">
        <Tooltip title={sidebarToggleLabel}>
          <IconButton
            aria-label={sidebarToggleLabel}
            className="app-header__toggle"
            onClick={onToggleSidebar}
          >
            <Menu size={20} />
          </IconButton>
        </Tooltip>

        <Box className="app-header__title-wrap">
          <Typography className="app-header__title" noWrap>
            ระบบการเบิกสินค้าสำนักงาน
          </Typography>
          <Typography className="app-header__subtitle" noWrap>
            สำหรับการเบิกและจัดการสินค้าสำนักงาน
          </Typography>
        </Box>
      </Box>

      <Box className="app-header__right">
        {canApproveRequests ? (
          <>
            <Tooltip title="การแจ้งเตือนคำขอเบิกใหม่">
              <IconButton
                aria-label="การแจ้งเตือนคำขอเบิกใหม่"
                className="app-header__theme-button"
                onClick={handleOpenNotifications}
              >
                <Badge badgeContent={unreadNotificationCount} color="error" max={9}>
                  <Bell size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
            <MuiMenu
              anchorEl={notificationAnchor}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              id="hr-request-notification-menu"
              open={isNotificationOpen}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              onClose={() => setNotificationAnchor(null)}
              slotProps={{ paper: { sx: { maxWidth: 360, minWidth: 300 } } }}
            >
              {notifications.length === 0 ? (
                <MenuItem disabled>ยังไม่มีคำขอเบิกใหม่</MenuItem>
              ) : notifications.map((notification) => (
                <MenuItem
                  key={notification.id}
                  sx={{ alignItems: 'flex-start', py: 1.25, whiteSpace: 'normal' }}
                  onClick={() => {
                    setNotificationAnchor(null)
                    navigate('/approvals')
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 900 }}>{notification.requestNo}</Typography>
                    <Typography sx={{ color: '#475569', fontSize: 12 }}>{notification.label}</Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 12 }}>ผู้ขอ: {notification.requester}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </MuiMenu>
          </>
        ) : null}
        <Tooltip title={themeToggleLabel}>
          <IconButton
            aria-label={themeToggleLabel}
            className="app-header__theme-button"
            onClick={toggleColorMode}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
        </Tooltip>
        <UserMenu />
      </Box>
    </Box>
  )
}

export default AppHeader
