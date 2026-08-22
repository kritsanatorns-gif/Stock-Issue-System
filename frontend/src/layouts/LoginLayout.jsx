import { Box, Paper, Stack, Typography } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { ClipboardCheck, PackageCheck, ShieldCheck } from 'lucide-react'
import './LoginLayout.css'

function LoginLayout() {
  return (
    <Box className="login-layout">
      <Paper className="login-layout__card" elevation={0}>
        <Box className="login-layout__image">
          <Stack className="login-layout__brand" direction="row" spacing={2}>
            <Box className="login-layout__brand-mark">HR</Box>
            <Box>
              <Typography className="login-layout__brand-title">ระบบจัดการคลังสำนักงาน</Typography>
              <Typography className="login-layout__brand-subtitle">OFFICE SUPPLY · WAREHOUSE OPS</Typography>
            </Box>
          </Stack>

          <Box className="login-layout__message">
            <Typography className="login-layout__message-title">จัดการคลังสินค้าอย่างมืออาชีพ</Typography>
            <Typography className="login-layout__message-text">ควบคุมสต๊อก เพิ่มประสิทธิภาพการทำงาน<br />แม่นยำ รวดเร็ว เชื่อถือได้</Typography>
            <Stack className="login-layout__features" direction="row" spacing={3}>
              <Feature icon={<PackageCheck size={23} />} title="ควบคุมสต๊อก" text="แบบเรียลไทม์" />
              <Feature icon={<ClipboardCheck size={23} />} title="ตรวจสอบง่าย" text="มีประวัติครบถ้วน" />
              <Feature icon={<ShieldCheck size={23} />} title="ปลอดภัย" text="เชื่อถือได้" />
            </Stack>
          </Box>
        </Box>
        <Box className="login-layout__content">
          <Box className="login-layout__corner login-layout__corner--top" />
          <Box className="login-layout__corner login-layout__corner--bottom" />
          <Outlet />
        </Box>
      </Paper>
    </Box>
  )
}

function Feature({ icon, text, title }) {
  return (
    <Stack className="login-layout__feature" direction="row" spacing={1.25}>
      <Box className="login-layout__feature-icon">{icon}</Box>
      <Box>
        <Typography>{title}</Typography>
        <Typography>{text}</Typography>
      </Box>
    </Stack>
  )
}

export default LoginLayout
