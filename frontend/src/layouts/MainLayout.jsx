import { Outlet } from 'react-router-dom'
import { Box, useMediaQuery } from '@mui/material'
import { useState } from 'react'
import AppBreadcrumb from '../components/AppBreadcrumb'
import AppFooter from '../components/AppFooter'
import AppHeader from '../components/AppHeader'
import AppSidebar from '../components/AppSidebar'
import './MainLayout.css'

function MainLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const isCompactScreen = useMediaQuery('(max-width:900px)')
  const sidebarCollapsed = isCompactScreen || isSidebarCollapsed

  return (
    <Box className="main-layout">
      <AppSidebar collapsed={sidebarCollapsed} />

      <Box
        className="main-layout__body"
        component="section"
      >
        <AppHeader
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        />

        <Box
          className="main-layout__main"
          component="main"
        >
          <AppBreadcrumb />
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
    </Box>
  )
}

export default MainLayout
