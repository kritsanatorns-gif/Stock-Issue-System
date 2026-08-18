import { Box, Paper } from '@mui/material'
import { Outlet } from 'react-router-dom'
import './LoginLayout.css'

function LoginLayout() {
  return (
    <Box className="login-layout">
      <Paper className="login-layout__card" elevation={0}>
        <Box className="login-layout__image" />
        <Box className="login-layout__content">
          <Box className="login-layout__corner login-layout__corner--top" />
          <Box className="login-layout__corner login-layout__corner--bottom" />
          <Outlet />
        </Box>
      </Paper>
    </Box>
  )
}

export default LoginLayout
