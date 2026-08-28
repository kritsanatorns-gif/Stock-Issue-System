import {
  Badge,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material'
import { ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getRequisitions } from '../api/api'
import { getAllowedNavigationItems } from '../app/navigationItems'
import { useAuthStore } from '../store/authStore'
import './AppShell.css'

function getRequisitionStatusId(row) {
  return Number(row.statusId ?? row.StatusId ?? 0)
}

function isOpenRequisition(row) {
  const statusId = getRequisitionStatusId(row)

  return statusId === 6 || statusId === 8
}

function AppSidebar({ collapsed }) {
  const employee = useAuthStore((state) => state.employee)
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const visibleNavigationItems = getAllowedNavigationItems(employee)
  const sidebarClassName = collapsed ? 'app-sidebar app-sidebar--collapsed' : 'app-sidebar'

  useEffect(() => {
    let isMounted = true

    async function loadPendingRequests() {
      try {
        const data = await getRequisitions()

        if (isMounted) {
          setPendingRequestCount(Array.isArray(data) ? data.filter(isOpenRequisition).length : 0)
        }
      } catch {
        if (isMounted) {
          setPendingRequestCount(0)
        }
      }
    }

    loadPendingRequests()

    const handleRequisitionCreated = () => {
      if (isMounted) {
        setPendingRequestCount((current) => current + 1)
      }
    }

    window.addEventListener('stock-issue:requisition-created', handleRequisitionCreated)

    return () => {
      isMounted = false
      window.removeEventListener('stock-issue:requisition-created', handleRequisitionCreated)
    }
  }, [])

  return (
    <Box className={sidebarClassName} component="aside">
      <Box className="app-sidebar__brand">
        <Box className="app-sidebar__brand-row">
          <Box className="app-sidebar__brand-icon">
            <ClipboardList size={22} />
          </Box>
          {!collapsed ? (
            <Box>
              <Typography className="app-sidebar__brand-title">เบิกสินค้าสำนักงาน</Typography>
              <Typography className="app-sidebar__brand-subtitle">ระบบการเบิกสินค้า</Typography>
            </Box>
          ) : null}
        </Box>
      </Box>

      <Divider className="app-sidebar__divider" />

      <List className="app-sidebar__nav">
        {visibleNavigationItems.map((item) => {
          const Icon = item.icon
          const badgeCount = item.menuCode === 'APPROVALS' ? pendingRequestCount : 0

          return (
            <Tooltip key={item.path} placement="right" title={collapsed ? item.label : ''}>
              <ListItemButton
                className="app-sidebar__nav-item"
                component={NavLink}
                to={item.path}
              >
                <ListItemIcon className="app-sidebar__nav-icon">
                  <Badge
                    badgeContent={badgeCount}
                    className="app-sidebar__nav-badge"
                    color="error"
                    invisible={badgeCount <= 0 || !collapsed}
                    max={99}
                  >
                    <Icon size={19} />
                  </Badge>
                </ListItemIcon>
                {!collapsed ? (
                  <>
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          fontSize: 14,
                          fontWeight: 600,
                        },
                      }}
                    />
                    {badgeCount > 0 ? (
                      <Box className="app-sidebar__nav-count">{badgeCount > 99 ? '99+' : badgeCount}</Box>
                    ) : null}
                  </>
                ) : null}
              </ListItemButton>
            </Tooltip>
          )
        })}
      </List>
    </Box>
  )
}

export default AppSidebar
