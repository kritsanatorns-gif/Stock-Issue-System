import { Avatar, Box, Button, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { ChevronDown, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import './AppShell.css'

function getInitials(name) {
  const cleanedName = String(name ?? '').trim()

  if (!cleanedName) {
    return 'U'
  }

  return cleanedName.slice(0, 2).toUpperCase()
}

function UserMenu() {
  const [anchorEl, setAnchorEl] = useState(null)
  const navigate = useNavigate()
  const employee = useAuthStore((state) => state.employee)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const logout = useAuthStore((state) => state.logout)
  const isOpen = Boolean(anchorEl)
  const employeeName =
    employee?.fullName ||
    employee?.employeeName ||
    employee?.name ||
    employee?.username ||
    employee?.employeeCode ||
    'ผู้ใช้งาน'
  const employeeRole =
    employee?.roleName || employee?.permissionName || employee?.role || 'ผู้ใช้งานทั่วไป'

  if (!isAuthenticated) {
    return (
      <Button
        className="user-menu__login-button"
        startIcon={<LogIn size={18} />}
        variant="contained"
        onClick={() => navigate('/login')}
      >
        เข้าสู่ระบบ
      </Button>
    )
  }

  const handleLogout = () => {
    setAnchorEl(null)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <Tooltip title="เมนูผู้ใช้งาน">
        <IconButton
          aria-controls={isOpen ? 'user-menu' : undefined}
          aria-expanded={isOpen ? 'true' : undefined}
          aria-haspopup="true"
          className="user-menu__button"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <Avatar className="user-menu__avatar">{getInitials(employeeName)}</Avatar>
          <Box className="user-menu__text">
            <Typography className="user-menu__name">{employeeName}</Typography>
            <Typography className="user-menu__role">{employeeRole}</Typography>
          </Box>
          <ChevronDown size={16} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        id="user-menu"
        open={isOpen}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={handleLogout}>ออกจากระบบ</MenuItem>
      </Menu>
    </>
  )
}

export default UserMenu
