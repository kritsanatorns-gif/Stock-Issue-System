import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import { Menu, Moon, Sun } from 'lucide-react'
import { useContext } from 'react'
import { ColorModeContext } from '../theme/ColorModeContext'
import UserMenu from './UserMenu'
import './AppShell.css'

function AppHeader({ onToggleSidebar, sidebarCollapsed }) {
  const { mode, toggleColorMode } = useContext(ColorModeContext)
  const isDarkMode = mode === 'dark'
  const sidebarToggleLabel = sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'
  const themeToggleLabel = isDarkMode ? 'โหมดสว่าง' : 'โหมดมืด'

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
