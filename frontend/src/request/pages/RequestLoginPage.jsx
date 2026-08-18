import {
  Alert,
  Box,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Barcode, Building2, ClipboardList, LogIn, Search, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getDepartments, getHrEmployee } from '../../api/api'
import BufferedTextField from '../../components/BufferedTextField'
import { useRequestAuthStore } from '../../store/requestAuthStore'

function normalizeDepartmentRow(row) {
  return {
    code: row.departmentCode ?? row.DepartmentCode ?? '',
    id: row.departmentId ?? row.DepartmentId ?? '',
    name: row.departmentName ?? row.DepartmentName ?? '',
    status: Number(row.departmentStatus ?? row.DepartmentStatus ?? 1),
  }
}

const departmentSearchOptionValue = '__department_search__'

function RequestLoginPage() {
  const navigate = useNavigate()
  const isAuthenticated = useRequestAuthStore((state) => state.isAuthenticated)
  const expiresAt = useRequestAuthStore((state) => state.expiresAt)
  const login = useRequestAuthStore((state) => state.login)
  const [username, setUsername] = useState('')
  const [department, setDepartment] = useState('')
  const [departmentCodeText, setDepartmentCodeText] = useState('')
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState('')
  const [departmentSearchText, setDepartmentSearchText] = useState('')
  const [departmentOptions, setDepartmentOptions] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [employeeCodeError, setEmployeeCodeError] = useState('')
  const [departmentError, setDepartmentError] = useState('')
  const [hrEmployee, setHrEmployee] = useState(null)
  const [isCheckingEmployee, setIsCheckingEmployee] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSessionActive = isAuthenticated && expiresAt && expiresAt > Date.now()
  const canSubmit = username.trim() && department.trim() && !employeeCodeError && !departmentError && !isSubmitting

  const activeDepartmentOptions = useMemo(
    () => departmentOptions.filter((item) => item.status === 1),
    [departmentOptions],
  )

  const filteredDepartmentOptions = useMemo(() => {
    const keyword = departmentSearchText.trim().toLowerCase()

    if (!keyword) {
      return activeDepartmentOptions
    }

    return activeDepartmentOptions.filter((item) =>
      `${item.code} ${item.name}`.toLowerCase().includes(keyword),
    )
  }, [activeDepartmentOptions, departmentSearchText])

  useEffect(() => {
    let isMounted = true

    const loadDepartments = async () => {
      try {
        const data = await getDepartments()

        if (isMounted) {
          setDepartmentOptions((data ?? []).map(normalizeDepartmentRow))
        }
      } catch {
        if (isMounted) {
          setDepartmentOptions([])
        }
      }
    }

    loadDepartments()

    return () => {
      isMounted = false
    }
  }, [])

  if (isSessionActive) {
    return <Navigate to="/request" replace />
  }

  const clearCheckedEmployee = () => {
    setErrorMessage('')
    setHrEmployee(null)
  }

  const handleEmployeeCodeChange = (value) => {
    const nextValue = value.replace(/\D/g, '')

    clearCheckedEmployee()
    setEmployeeCodeError(value === nextValue ? '' : 'รหัสพนักงานกรอกได้เฉพาะตัวเลขเท่านั้น')
    setUsername(nextValue)
  }

  const selectDepartment = (departmentRow) => {
    clearCheckedEmployee()
    setDepartment(departmentRow?.name ?? '')
    setSelectedDepartmentCode(departmentRow?.code ?? '')
    setDepartmentCodeText(departmentRow?.code ?? '')
    setDepartmentSearchText('')
    setDepartmentError('')
  }

  const clearDepartment = () => {
    clearCheckedEmployee()
    setDepartment('')
    setSelectedDepartmentCode('')
    setDepartmentCodeText('')
    setDepartmentSearchText('')
    setDepartmentError('')
  }

  const handleDepartmentSelectChange = (value) => {
    if (value === departmentSearchOptionValue) {
      return
    }

    if (!value) {
      clearDepartment()
      return
    }

    const departmentRow = activeDepartmentOptions.find((item) => item.code === value)

    if (departmentRow) {
      selectDepartment(departmentRow)
    }
  }

  const handleDepartmentCodeChange = (value) => {
    const hasInvalidCharacter = /[^A-Za-z0-9]/.test(value)
    const nextValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

    clearCheckedEmployee()
    setDepartmentCodeText(nextValue)
    setDepartment('')
    setSelectedDepartmentCode('')
    setDepartmentError(hasInvalidCharacter ? 'QR แผนกรองรับเฉพาะตัวอักษรอังกฤษและตัวเลขเท่านั้น' : '')
  }

  const handleDepartmentCodeCheck = () => {
    const code = departmentCodeText.trim().toUpperCase()

    if (!code) {
      clearDepartment()
      return
    }

    const departmentRow = activeDepartmentOptions.find(
      (item) => item.code.toUpperCase() === code || item.name.toUpperCase() === code,
    )

    if (!departmentRow) {
      setDepartment('')
      setSelectedDepartmentCode('')
      setDepartmentError('ไม่พบ QR แผนกนี้ในระบบ')
      return
    }

    selectDepartment(departmentRow)
  }

  const handleDepartmentCodeKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleDepartmentCodeCheck()
    }
  }

  const handleCheckEmployee = async () => {
    const employeeCode = username.trim()
    const employeeDepartment = department.trim()

    if (!employeeCode || !employeeDepartment) {
      setErrorMessage('กรุณากรอกรหัสพนักงานและแผนกก่อนตรวจสอบ')
      return
    }

    if (employeeCodeError || departmentError) {
      setErrorMessage('กรุณาแก้ไขข้อมูลที่กรอกไม่ถูกต้องก่อนตรวจสอบ')
      return
    }

    setErrorMessage('')
    setHrEmployee(null)
    setIsCheckingEmployee(true)

    try {
      const employee = await getHrEmployee(employeeCode, employeeDepartment)

      setHrEmployee(employee)
    } catch (error) {
      const status = error?.response?.status

      setErrorMessage(
        status === 404
          ? 'ไม่พบข้อมูลพนักงานในแผนกนี้จากระบบ HR'
          : 'ตรวจสอบข้อมูลพนักงานจาก HR ไม่สำเร็จ',
      )
    } finally {
      setIsCheckingEmployee(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!canSubmit) {
      setErrorMessage('กรุณาแก้ไขข้อมูลที่กรอกไม่ถูกต้องก่อนเข้าสู่ระบบ')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const employeeCode = username.trim()
      const employeeDepartment = department.trim()
      const checkedEmployee =
        hrEmployee?.code === employeeCode && hrEmployee?.department === employeeDepartment
          ? hrEmployee
          : await getHrEmployee(employeeCode, employeeDepartment)

      setHrEmployee(checkedEmployee)

      await login({
        department: checkedEmployee.department,
        employeeCode: checkedEmployee.code,
        employeeName: checkedEmployee.name,
        unitRef: checkedEmployee.unitRef || '',
        username: checkedEmployee.name,
      })
      navigate('/request', { replace: true })
    } catch (error) {
      const status = error?.response?.status

      setErrorMessage(
        status === 404
          ? 'รหัสพนักงานหรือแผนกไม่ถูกต้อง ไม่พบข้อมูลจากระบบ HR'
          : 'เข้าสู่หน้าขอเบิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        alignItems: 'center',
        background:
          'radial-gradient(circle at 6% 12%, rgba(178,206,255,0.96) 0 36px, transparent 38px), radial-gradient(circle at 11% 12%, rgba(255,255,255,0.96) 0 32px, transparent 34px), radial-gradient(circle at 16% 12%, rgba(198,242,255,0.98) 0 34px, transparent 36px), radial-gradient(ellipse at -4% 104%, rgba(255,255,255,0.64) 0 28%, transparent 29%), radial-gradient(ellipse at 106% 104%, rgba(255,255,255,0.58) 0 25%, transparent 26%), linear-gradient(135deg, #d8e6ff 0%, #f8fbff 52%, #d7f3ff 100%)',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        overflow: 'hidden',
        p: { xs: 3, md: 5 },
        position: 'relative',
        '&::after': {
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.92) 1.6px, transparent 1.8px)',
          backgroundSize: '18px 18px',
          bottom: 70,
          content: '""',
          height: 110,
          opacity: 0.8,
          position: 'absolute',
          right: 86,
          width: 150,
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'rgba(255,255,255,0.96)',
          border: '1px solid rgba(96,165,250,0.24)',
          borderRadius: 2,
          boxShadow: '0 34px 95px rgba(30,64,175,0.24), 0 10px 26px rgba(15,23,42,0.10)',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '42% 58%' },
          minHeight: { xs: 'auto', md: 610 },
          overflow: 'hidden',
          width: 'min(1120px, 100%)',
        }}
      >
        <Box
          sx={{
            backgroundImage:
              "linear-gradient(180deg, rgba(219,234,254,0.08), rgba(255,255,255,0.12)), url('/login-bg.jpg')",
            backgroundPosition: 'left center',
            backgroundSize: 'cover',
            display: { xs: 'none', md: 'block' },
            minHeight: 610,
          }}
        />

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
            display: 'flex',
            justifyContent: 'center',
            p: { xs: 3, md: 6 },
            position: 'relative',
            '&::before': {
              background: 'linear-gradient(135deg, #d8e6ff 0%, #d7f3ff 100%)',
              bottom: 0,
              clipPath:
                'polygon(100% 100%, 44% 100%, 52% 92%, 58% 87%, 68% 86%, 72% 80%, 78% 74%, 88% 68%, 92% 58%, 100% 52%)',
              content: '""',
              height: 330,
              opacity: 0.82,
              pointerEvents: 'none',
              position: 'absolute',
              right: 0,
              width: 330,
            },
            '&::after': {
              background: '#f8fbff',
              bottom: 0,
              clipPath:
                'polygon(100% 100%, 48% 100%, 55% 94%, 60% 89%, 70% 88%, 74% 82%, 80% 76%, 90% 70%, 93% 61%, 100% 55%)',
              content: '""',
              height: 300,
              pointerEvents: 'none',
              position: 'absolute',
              right: 0,
              width: 300,
            },
          }}
        >
          <Box
            sx={{
              height: 250,
              pointerEvents: 'none',
              position: 'absolute',
              right: 0,
              top: 0,
              width: 250,
              '&::before': {
                background: 'linear-gradient(135deg, #d7f3ff 0%, #d8e6ff 100%)',
                clipPath:
                  'polygon(100% 0, 48% 0, 55% 8%, 61% 13%, 70% 14%, 75% 20%, 82% 27%, 92% 34%, 95% 44%, 100% 50%)',
                content: '""',
                height: 250,
                opacity: 0.7,
                position: 'absolute',
                right: 0,
                top: 0,
                width: 250,
              },
              '&::after': {
                background: '#f8fbff',
                clipPath:
                  'polygon(100% 0, 54% 0, 61% 6%, 67% 11%, 75% 12%, 80% 18%, 86% 24%, 94% 31%, 97% 40%, 100% 46%)',
                content: '""',
                height: 220,
                position: 'absolute',
                right: 0,
                top: 0,
                width: 220,
              },
            }}
          />

          <Stack spacing={3} sx={{ maxWidth: 390, position: 'relative', width: '100%', zIndex: 1 }}>
            <Stack alignItems="center" direction="row" spacing={2}>
              <ClipboardList color="#1d4ed8" size={54} strokeWidth={1.6} />
              <Box>
                <Typography sx={{ color: '#0f172a', fontSize: 24, fontWeight: 900, lineHeight: 1.15 }}>
                  เข้าสู่ระบบขอเบิกสินค้า
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.75 }}>
                  สำหรับพนักงานที่ต้องการส่งคำขอเบิกให้ HR อนุมัติ
                </Typography>
              </Box>
            </Stack>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

            <BufferedTextField
              autoFocus
              fullWidth
              required
              label="รหัสพนักงาน"
              value={username}
              onChange={(event) => {
                handleEmployeeCodeChange(event.target.value)
              }}
              error={Boolean(employeeCodeError)}
              helperText={employeeCodeError || 'กรอกเฉพาะตัวเลขเท่านั้น'}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <User color="#5f7f99" size={22} />
                  </InputAdornment>
                ),
              }}
            />

            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <BufferedTextField
                  fullWidth
                  label="ยิง QR แผนก"
                  placeholder="สแกนรหัสแผนก"
                  value={departmentCodeText}
                  onBlur={handleDepartmentCodeCheck}
                  onChange={(event) => {
                    handleDepartmentCodeChange(event.target.value)
                  }}
                  onKeyDown={handleDepartmentCodeKeyDown}
                  error={Boolean(departmentError)}
                  helperText={departmentError || 'สแกนหรือพิมพ์รหัสแผนก'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Barcode color="#5f7f99" size={22} />
                      </InputAdornment>
                    ),
                  }}
                />

                <FormControl fullWidth required error={Boolean(departmentError)}>
                  <InputLabel id="request-department-select-label">เลือกแผนก</InputLabel>
                  <Select
                    label="เลือกแผนก"
                    labelId="request-department-select-label"
                    value={selectedDepartmentCode}
                    onChange={(event) => handleDepartmentSelectChange(event.target.value)}
                    startAdornment={
                      <InputAdornment position="start">
                        <Building2 color="#5f7f99" size={22} />
                      </InputAdornment>
                    }
                  >
                    <MenuItem
                      disableRipple
                      value={departmentSearchOptionValue}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      sx={{
                        cursor: 'default',
                        p: 1,
                        '&.Mui-focusVisible': { bgcolor: 'transparent' },
                        '&:hover': { bgcolor: 'transparent' },
                      }}
                    >
                      <TextField
                        autoFocus
                        fullWidth
                        placeholder="ค้นหาแผนก"
                        size="small"
                        value={departmentSearchText}
                        onChange={(event) => setDepartmentSearchText(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search color="#64748b" size={16} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </MenuItem>
                    <MenuItem value="">เลือกแผนก</MenuItem>
                    {filteredDepartmentOptions.length ? (
                      filteredDepartmentOptions.map((departmentRow) => (
                        <MenuItem key={departmentRow.id || departmentRow.code} value={departmentRow.code}>
                          {departmentRow.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>ไม่พบแผนก</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Stack>

              <BufferedTextField
                fullWidth
                required
                label="ชื่อแผนกที่เลือก"
                value={department}
                helperText={department ? `Code: ${selectedDepartmentCode || '-'}` : 'เลือกแผนกหรือยิง QR แผนกก่อนเข้าสู่ระบบ'}
                InputProps={{
                  readOnly: true,
                }}
              />
            </Stack>

            <Button
              disabled={!username.trim() || !department.trim() || Boolean(employeeCodeError) || Boolean(departmentError) || isCheckingEmployee}
              onClick={handleCheckEmployee}
              startIcon={<Search size={18} />}
              type="button"
              variant="outlined"
            >
              {isCheckingEmployee ? 'กำลังตรวจสอบ...' : 'ตรวจสอบข้อมูล HR'}
            </Button>

            {hrEmployee ? (
              <Box
                sx={{
                  bgcolor: 'rgba(239,246,255,0.86)',
                  border: '1px solid rgba(96,165,250,0.36)',
                  borderRadius: 2,
                  color: '#0f172a',
                  p: 2,
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>
                  ข้อมูลจาก HR
                </Typography>
                <Stack spacing={0.5}>
                  <Typography sx={{ fontSize: 13 }}>
                    รหัส: <strong>{hrEmployee.code || '-'}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    ชื่อ: <strong>{hrEmployee.name || '-'}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    แผนก: <strong>{hrEmployee.department || '-'}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    UnitRef: <strong>{hrEmployee.unitRef || '-'}</strong>
                  </Typography>
                </Stack>
              </Box>
            ) : null}

            <Button
              disabled={!canSubmit}
              fullWidth
              size="large"
              startIcon={<LogIn size={20} />}
              type="submit"
              variant="contained"
            >
              {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่หน้าขอเบิก'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}

export default RequestLoginPage
