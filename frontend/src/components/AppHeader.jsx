import { Badge, Box, IconButton, Menu as MuiMenu, MenuItem, Tooltip, Typography } from '@mui/material'
import { Bell, Menu, Moon, Sun } from 'lucide-react'
import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectNotificationHub } from '../api/notificationHub'
import { getRequisitions } from '../api/api'
import { canAccessMenu } from '../app/navigationItems'
import { useAuthStore } from '../store/authStore'
import { ColorModeContext } from '../theme/ColorModeContext'
import UserMenu from './UserMenu'
import './AppShell.css'

const maxRequestNotifications = 5

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
  const knownRequestStorageKey = 'stock-issue-hr-known-request-ids-v1'
  const sidebarToggleLabel = sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'
  const themeToggleLabel = isDarkMode ? 'โหมดสว่าง' : 'โหมดมืด'
  const isNotificationOpen = Boolean(notificationAnchor)

  useEffect(() => {
    if (!canApproveRequests) {
      setNotifications([])
      return undefined
    }

    const savedNotifications = JSON.parse(localStorage.getItem(notificationStorageKey) || '[]')
      .slice(0, maxRequestNotifications)
    setNotifications(savedNotifications)
    localStorage.setItem(notificationStorageKey, JSON.stringify(savedNotifications))
    const checkNewRequisitions = async () => {
      try {
        const requests = await getRequisitions()
        const activeRequestIds = new Set((requests ?? [])
          .filter((request) => [6, 8].includes(Number(request.statusId ?? request.StatusId ?? 0)))
          .map((request) => `new-request-${String(request.headerId ?? request.HeaderId ?? '')}`))
        setNotifications((current) => {
          const nextNotifications = current.filter((item) => activeRequestIds.has(item.id))

          if (nextNotifications.length !== current.length) {
            localStorage.setItem(notificationStorageKey, JSON.stringify(nextNotifications))
          }

          return nextNotifications
        })
        const requestIds = (requests ?? [])
          .map((request) => String(request.headerId ?? request.HeaderId ?? ''))
          .filter(Boolean)
        const knownRequestIds = JSON.parse(localStorage.getItem(knownRequestStorageKey) || '[]')

        if (knownRequestIds.length === 0) {
          localStorage.setItem(knownRequestStorageKey, JSON.stringify(requestIds.slice(0, 300)))
          return
        }

        const knownIds = new Set(knownRequestIds)
        const newRequests = (requests ?? []).filter((request) => !knownIds.has(String(request.headerId ?? request.HeaderId ?? '')))
        localStorage.setItem(knownRequestStorageKey, JSON.stringify(requestIds.slice(0, 300)))

        if (newRequests.length === 0) return

        setNotifications((current) => {
          const nextNotifications = [...current]
          newRequests.reverse().forEach((request) => {
            const headerId = String(request.headerId ?? request.HeaderId ?? '')
            const notificationId = `new-request-${headerId}`
            if (!headerId || nextNotifications.some((item) => item.id === notificationId)) return
            nextNotifications.unshift({
              id: notificationId,
              requestNo: request.requestNo ?? request.RequestNo ?? `คำขอ #${headerId}`,
              requester: request.employeeName ?? request.EmployeeName ?? '-',
              label: 'มีคำขอเบิกสินค้าใหม่จากผู้ใช้',
              read: false,
            })
          })
          const limitedNotifications = nextNotifications.slice(0, maxRequestNotifications)
          localStorage.setItem(notificationStorageKey, JSON.stringify(limitedNotifications))
          return limitedNotifications
        })
      } catch {
        // SignalR remains the primary path; retry on the next low-frequency check.
      }
    }

    checkNewRequisitions()
    const handleRequisitionUpdated = () => checkNewRequisitions()
    window.addEventListener('stock-issue:requisition-updated', handleRequisitionUpdated)
    let requestCheckInterval
    const startFallbackRequestCheck = () => {
      if (!requestCheckInterval) {
        checkNewRequisitions()
        requestCheckInterval = window.setInterval(checkNewRequisitions, 120000)
      }
    }
    const stopFallbackRequestCheck = () => {
      if (requestCheckInterval) {
        window.clearInterval(requestCheckInterval)
        requestCheckInterval = undefined
      }
    }
    let connection
    let active = true

    connectNotificationHub({
      groupMethod: 'JoinHrNotifications',
      onConnectionStateChange: (isConnected) => {
        if (isConnected) stopFallbackRequestCheck()
        else startFallbackRequestCheck()
      },
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
            }, ...current].slice(0, maxRequestNotifications)
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
      startFallbackRequestCheck()
    })

    return () => {
      active = false
      stopFallbackRequestCheck()
      connection?.stop()
      window.removeEventListener('stock-issue:requisition-updated', handleRequisitionUpdated)
    }
  }, [canApproveRequests, knownRequestStorageKey, notificationStorageKey])

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
