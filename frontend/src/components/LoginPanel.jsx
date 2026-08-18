import { Alert, Box, Button, IconButton, InputAdornment, Stack, Typography } from '@mui/material'
import { ClipboardList, Eye, EyeOff, Lock, LogIn, User } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { normalizeUsernameInput } from '../utils/inputGuards'
import BufferedTextField from './BufferedTextField'
import './LoginPanel.css'

const thaiCharacterPattern = /[\u0E00-\u0E7F]/

function LoginPanel({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [usernameHasThai, setUsernameHasThai] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const login = useAuthStore((state) => state.login)
  const canSubmit = username.trim() && password.trim() && !usernameHasThai && !isSubmitting

  const handleUsernameChange = (value) => {
    setErrorMessage('')
    setUsernameHasThai(thaiCharacterPattern.test(value))
    setUsername(normalizeUsernameInput(value))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await login({ employeeId: username, password })
      onSuccess?.()
    } catch {
      setErrorMessage('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Stack className="login-panel" spacing={3}>
      <Stack alignItems="center" direction="row" spacing={2}>
        <ClipboardList color="#1d4ed8" size={54} strokeWidth={1.6} />
        <Box>
          <Typography className="login-panel__title">เข้าสู่ระบบ HR</Typography>
          <Typography className="login-panel__subtitle">
            สำหรับผู้ดูแลระบบและเจ้าหน้าที่คลังสำนักงาน
          </Typography>
        </Box>
      </Stack>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Box autoComplete="off" component="form" onSubmit={handleSubmit}>
        <input
          autoComplete="username"
          className="login-panel__hidden-input"
          name="hidden-user"
          tabIndex={-1}
          type="text"
        />
        <input
          autoComplete="current-password"
          className="login-panel__hidden-input"
          name="hidden-pass"
          tabIndex={-1}
          type="password"
        />
        <Stack spacing={2.25}>
          <BufferedTextField
            autoFocus
            fullWidth
            required
            autoComplete="new-password"
            className={usernameHasThai ? 'login-panel__field login-panel__field--error' : 'login-panel__field'}
            error={usernameHasThai}
            helperText={usernameHasThai ? 'ห้ามกรอกภาษาไทยในช่องชื่อผู้ใช้' : ''}
            name="stock-access-username-field"
            placeholder="ชื่อผู้ใช้"
            value={username}
            onChange={(event) => handleUsernameChange(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <User color={usernameHasThai ? '#dc2626' : '#5f7f99'} size={22} />
                </InputAdornment>
              ),
            }}
          />

          <BufferedTextField
            fullWidth
            required
            autoComplete="new-password"
            className="login-panel__field"
            name="stock-access-secret-field"
            placeholder="รหัสผ่าน"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock color="#5f7f99" size={22} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    edge="end"
                    onClick={() => setShowPassword((current) => !current)}
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {showPassword ? <EyeOff color="#5f7f99" size={22} /> : <Eye color="#5f7f99" size={22} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            className="login-panel__submit"
            disabled={!canSubmit}
            fullWidth
            size="large"
            startIcon={<LogIn size={20} />}
            type="submit"
            variant="contained"
          >
            {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </Stack>
      </Box>
    </Stack>
  )
}

export default LoginPanel
