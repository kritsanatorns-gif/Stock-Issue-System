import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Eye, Pencil, Plus, RefreshCw, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import {
  createEmployee,
  getEmployeeMenus,
  getEmployeePermissions,
  getEmployeeStatuses,
  getEmployees,
  updateEmployee,
} from '../../api/api'
import BufferedTextField from '../../components/BufferedTextField'
import AppTable from '../../components/common/AppTable'
import {
  normalizeEmployeeName,
  normalizeEmployeeNumericId,
  normalizeUsernameInput,
} from '../../utils/inputGuards'

const roleOptions = [
  {
    value: '1',
    label: 'ผู้ดูแลระบบ',
    description: 'ทำได้ทุกอย่างในระบบ',
    color: 'error',
  },
  {
    value: '2',
    label: 'ผู้ควบคุมสต็อก',
    description: 'เพิ่มและแก้ไขข้อมูลสต็อกได้',
    color: 'primary',
  },
  {
    value: '3',
    label: 'ผู้จ่ายสินค้า',
    description: 'จ่ายสินค้าออกได้อย่างเดียว',
    color: 'success',
  },
]

const emptyForm = {
  employeeId: '',
  name: '',
  department: 'HR',
  username: '',
  password: '',
  role: '',
  status: 1,
  menuIds: [],
}

const userTableColumns = [
  { key: 'actions', label: 'แก้ไข', width: 120 },
  { key: 'employeeId', label: 'รหัสพนักงาน', width: 120, sortable: true },
  { key: 'name', label: 'ชื่อพนักงาน', width: 280, sortable: true },
  { key: 'department', label: 'แผนก', width: 130, sortable: true },
  { key: 'username', label: 'ชื่อผู้ใช้', width: 220, sortable: true },
  { key: 'role', label: 'สิทธิ์การใช้งาน', width: 170, sortable: true },
  { key: 'menus', label: 'เมนูที่มองเห็น', width: 190, sortable: false },
  { key: 'status', label: 'สถานะ', width: 120, searchable: false, sortable: true },
]

function getRoleOption(role, options = roleOptions) {
  const normalizedRole = String(role ?? '').toLowerCase()
  const option = options.find((item) => String(item.value).toLowerCase() === normalizedRole)

  return (
    option ?? {
      value: role,
      label: role || 'ไม่ระบุสิทธิ์',
      description: 'สิทธิ์จากฐานข้อมูล',
      color: 'default',
    }
  )
}

const defaultStatusOptions = [
  {
    value: '1',
    label: 'ใช้งาน',
  },
  {
    value: '2',
    label: 'ไม่ใช้งาน',
  },
]

const roleDefaultMenuCodes = {
  1: ['DASHBOARD', 'STOCK_OUT', 'APPROVALS', 'STOCK_IN', 'STOCK_ADJUST', 'PRODUCTS', 'HISTORY', 'REPORTS', 'USERS', 'DEPARTMENTS', 'SUPPLIERS'],
  2: ['DASHBOARD', 'STOCK_OUT', 'APPROVALS', 'STOCK_IN', 'STOCK_ADJUST', 'PRODUCTS', 'HISTORY', 'REPORTS'],
  3: ['DASHBOARD', 'STOCK_OUT', 'APPROVALS'],
}

function getStatusOption(status, options = defaultStatusOptions) {
  return (
    options.find((option) => option.value === String(status)) ?? {
      value: String(status),
      label: Number(status) === 1 ? 'ใช้งาน' : 'ไม่ใช้งาน',
    }
  )
}

function getDefaultMenuIdsByRole(role, menuOptions) {
  if (!role) {
    return []
  }

  const roleKey = Number(role)
  const defaultCodes = roleDefaultMenuCodes[roleKey] ?? roleDefaultMenuCodes[3]

  return menuOptions
    .filter((menu) => {
      const menuCode = String(menu.code ?? '').trim().toUpperCase()

      return defaultCodes.includes(menuCode) || menuCode === 'APPROVALS'
    })
    .map((menu) => menu.id)
}

function mapEmployee(row) {
  return {
    employeeId: String(row.employeeId ?? ''),
    name: row.employeeName ?? '',
    department: row.department || 'HR',
    role: row.permissionId ?? row.permission ?? '',
    roleName: row.permissionName ?? row.permission ?? '',
    username: row.username ?? '',
    status: row.status ?? 0,
    menuIds: row.menuIds ?? [],
  }
}

function UsersPage() {
  const [users, setUsers] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [permissionOptions, setPermissionOptions] = useState(roleOptions)
  const [statusOptions, setStatusOptions] = useState(defaultStatusOptions)
  const [menuOptions, setMenuOptions] = useState([])
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [isUsernameEdited, setIsUsernameEdited] = useState(false)
  const [menuDetailUser, setMenuDetailUser] = useState(null)

  const loadUsers = async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const data = await getEmployees()
      setUsers(data.map(mapEmployee))
    } catch {
      setErrorMessage('โหลดข้อมูลพนักงานไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPermissions = async () => {
    try {
      const data = await getEmployeePermissions()
      const options = data.map((permission) => ({
        value: String(permission.permissionId),
        label: permission.permissionName,
        description: '',
        color:
          Number(permission.permissionId) === 1
            ? 'error'
            : Number(permission.permissionId) === 2
              ? 'primary'
              : 'success',
      }))

      if (options.length) {
        setPermissionOptions(options)
        setForm((current) => ({
          ...current,
          role: current.role && options.some((option) => option.value === current.role)
            ? current.role
            : '',
        }))
      }
    } catch {
      toast.error('โหลดข้อมูลสิทธิ์การใช้งานไม่สำเร็จ')
    }
  }

  const loadStatuses = async () => {
    try {
      const data = await getEmployeeStatuses()
      const options = data
        .filter((status) => Number(status.statusId) === 1 || Number(status.statusId) === 2)
        .map((status) => ({
          value: String(status.statusId),
          label: status.statusName,
        }))

      if (options.length) {
        setStatusOptions(options)
      }
    } catch {
      toast.error('โหลดข้อมูลสถานะไม่สำเร็จ')
    }
  }

  const loadMenus = async () => {
    try {
      const data = await getEmployeeMenus()
      const options = data.map((menu) => ({
        id: Number(menu.menuId),
        code: menu.menuCode,
        label: menu.menuName,
        path: menu.menuPath,
        sortOrder: menu.sortOrder,
      }))

      setMenuOptions(options)
      setForm((current) => ({
        ...current,
        menuIds: current.menuIds.length || !current.role
          ? current.menuIds
          : getDefaultMenuIdsByRole(current.role, options),
      }))
    } catch {
      toast.error('โหลดข้อมูลเมนูไม่สำเร็จ')
    }
  }

  useEffect(() => {
    loadUsers()
    loadPermissions()
    loadStatuses()
    loadMenus()
  }, [])

  const columns = userTableColumns.map((column) => {
    if (column.key === 'role') {
      return {
        ...column,
        render: (row) => {
          const role = getRoleOption(row.role, permissionOptions)

          return <Chip color={role.color} label={role.label} size="small" variant="outlined" />
        },
        value: (row) => getRoleOption(row.role, permissionOptions).label,
      }
    }

    if (column.key === 'status') {
      return {
        ...column,
        align: 'center',
        render: (row) => (
          <Chip
            color={Number(row.status) === 1 ? 'success' : 'error'}
            label={getStatusOption(row.status, statusOptions).label}
            size="small"
          />
        ),
        value: (row) => getStatusOption(row.status, statusOptions).label,
      }
    }

    if (column.key === 'menus') {
      return {
        ...column,
        align: 'center',
        searchable: false,
        render: (row) => {
          const selectedMenus = menuOptions.filter((menu) => row.menuIds.includes(menu.id))

          if (!selectedMenus.length) {
            return (
              <Stack alignItems="center" direction="row" justifyContent="center" sx={{ width: '100%' }}>
                <Button
                  disabled
                  size="small"
                  startIcon={<Eye size={14} />}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 700,
                    justifyContent: 'center',
                    mx: 'auto',
                    minWidth: 156,
                  }}
                  variant="outlined"
                >
                  ดูเมนูที่ใช้งานได้
                </Button>
              </Stack>
            )
          }

          return (
            <Stack alignItems="center" direction="row" justifyContent="center" sx={{ width: '100%' }}>
              <Button
                size="small"
                startIcon={<Eye size={14} />}
                sx={{
                  borderRadius: 1.5,
                  fontWeight: 700,
                  justifyContent: 'center',
                  mx: 'auto',
                  minWidth: 156,
                }}
                variant="outlined"
                onClick={() => setMenuDetailUser(row)}
              >
                ดูเมนูที่ใช้งานได้
              </Button>
            </Stack>
          )
        },
        value: (row) =>
          menuOptions
            .filter((menu) => row.menuIds.includes(menu.id))
            .map((menu) => menu.label)
            .join(', '),
      }
    }

    if (column.key === 'actions') {
      return {
        ...column,
        align: 'center',
        searchable: false,
        sortable: false,
        render: (row) => (
          <Button
            size="small"
            startIcon={<Pencil size={15} />}
            variant="outlined"
            onClick={() => handleOpenEditDialog(row)}
          >
            แก้ไข
          </Button>
        ),
      }
    }

    return column
  })

  const isEditMode = Boolean(editingEmployeeId)
  const canSubmit =
    form.employeeId.trim() &&
    form.name.trim() &&
    form.department.trim() &&
    form.username.trim() &&
    (isEditMode || form.password.trim()) &&
    form.role &&
    form.menuIds.length > 0

  const handleOpenDialog = () => {
    setEditingEmployeeId('')
    setIsUsernameEdited(false)
    setForm({
      ...emptyForm,
      department: 'HR',
      role: '',
      menuIds: [],
    })
    setErrorMessage('')
    setIsDialogOpen(true)
  }

  const handleOpenEditDialog = (row) => {
    setEditingEmployeeId(row.employeeId)
    setIsUsernameEdited(true)
    setForm({
      employeeId: row.employeeId,
      name: row.name,
      department: row.department || 'HR',
      username: row.username,
      password: '',
      role: row.role || permissionOptions[0]?.value || emptyForm.role,
      status: Number(row.status) || 1,
      menuIds: row.menuIds ?? [],
    })
    setErrorMessage('')
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingEmployeeId('')
    setIsUsernameEdited(false)
  }

  const handleChange = (field, value) => {
    if (field === 'username') {
      setIsUsernameEdited(true)
    }

    const normalizedValue =
      field === 'employeeId'
        ? normalizeEmployeeNumericId(value)
        : field === 'name'
          ? normalizeEmployeeName(value)
          : field === 'username'
            ? normalizeUsernameInput(value)
            : value

    setErrorMessage('')
    setForm((current) => ({
      ...current,
      [field]: normalizedValue,
      ...(field === 'role' ? { menuIds: getDefaultMenuIdsByRole(normalizedValue, menuOptions) } : {}),
      ...(field === 'employeeId' && !isEditMode && !isUsernameEdited ? { username: normalizedValue } : {}),
    }))
  }

  const handleApplyRoleDefaultMenus = () => {
    setForm((current) => ({
      ...current,
      menuIds: getDefaultMenuIdsByRole(current.role, menuOptions),
    }))
  }

  const handleToggleMenu = (menuId) => {
    setErrorMessage('')
    setForm((current) => ({
      ...current,
      menuIds: current.menuIds.includes(menuId)
        ? current.menuIds.filter((id) => id !== menuId)
        : [...current.menuIds, menuId],
    }))
  }

  const handleSelectAllMenus = () => {
    setForm((current) => ({
      ...current,
      menuIds: menuOptions.map((menu) => menu.id),
    }))
  }

  const handleClearMenus = () => {
    setForm((current) => ({
      ...current,
      menuIds: [],
    }))
  }

  const menuDetailItems = menuDetailUser
    ? menuOptions.filter((menu) => menuDetailUser.menuIds.includes(menu.id))
    : []

  const handleSaveUser = async (event) => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    const selectedRole = getRoleOption(form.role, permissionOptions)
    const selectedMenuLabels = menuOptions
      .filter((menu) => form.menuIds.includes(menu.id))
      .map((menu) => menu.label)
    const result = await Swal.fire({
      title: isEditMode ? 'ยืนยันการแก้ไข' : 'ยืนยันการบันทึก',
      text: `${isEditMode ? 'ต้องการแก้ไขข้อมูล' : 'ต้องการบันทึก'}พนักงาน ${form.name.trim()} ใช่หรือไม่`,
      icon: 'question',
      customClass: {
        container: 'stock-swal-container',
      },
      showCancelButton: true,
      confirmButtonText: isEditMode ? 'แก้ไข' : 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      html: `
        <div style="text-align:left;line-height:1.8">
          <div><b>รหัสพนักงาน:</b> ${form.employeeId.trim()}</div>
          <div><b>ชื่อพนักงาน:</b> ${form.name.trim()}</div>
          <div><b>แผนก:</b> ${form.department.trim() || 'HR'}</div>
          <div><b>ชื่อผู้ใช้:</b> ${form.username.trim()}</div>
          <div><b>สิทธิ์:</b> ${selectedRole.label}</div>
          <div><b>เมนูที่เห็น:</b> ${selectedMenuLabels.join(', ')}</div>
          <div><b>สถานะ:</b> ${getStatusOption(form.status, statusOptions).label}</div>
        </div>
      `,
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage('')

      const payload = {
        employeeId: Number(form.employeeId.trim()),
        employeeName: form.name.trim(),
        department: form.department.trim() || 'HR',
        permission: form.role,
        username: form.username.trim(),
        password: form.password.trim(),
        status: Number(form.status) || 1,
        menuIds: form.menuIds,
      }

      const saved = isEditMode
        ? await updateEmployee(editingEmployeeId, payload)
        : await createEmployee(payload)

      setUsers((current) => {
        const mapped = mapEmployee(saved)

        return isEditMode
          ? current.map((user) => (user.employeeId === editingEmployeeId ? mapped : user))
          : [mapped, ...current]
      })
      setIsDialogOpen(false)
      setEditingEmployeeId('')
      await Swal.fire({
        title: 'สำเร็จ',
        text: isEditMode ? 'แก้ไขข้อมูลพนักงานสำเร็จ' : 'บันทึกพนักงานสำเร็จ',
        icon: 'success',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } catch (error) {
      const message =
        error?.response?.status === 409
          ? 'รหัสพนักงานนี้มีอยู่แล้ว'
          : isEditMode
            ? 'แก้ไขข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง'
            : 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง'

      setErrorMessage(message)
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: message,
        icon: 'error',
        customClass: {
          container: 'stock-swal-container',
        },
        confirmButtonText: 'ตกลง',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          alignItems: 'flex-start',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>
            จัดการผู้ใช้งาน
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
            จัดการรายชื่อพนักงานและสิทธิ์การใช้งานในคลังสินค้า
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.25} sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' }, width: { xs: '100%', md: 'auto' } }}>
          <Button
            disabled={isLoading}
            startIcon={<RefreshCw size={16} />}
            sx={{ fontWeight: 700, minHeight: 40 }}
            variant="outlined"
            onClick={loadUsers}
          >
            รีเฟรช
          </Button>
          <Button
            startIcon={<UserPlus size={18} />}
            sx={{ fontWeight: 700, minHeight: 40 }}
            variant="contained"
            onClick={handleOpenDialog}
          >
            เพิ่มพนักงาน
          </Button>
        </Stack>
      </Box>

      {errorMessage && !isDialogOpen ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card
        elevation={0}
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #d9e0ea',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <AppTable
            columns={columns}
            defaultSortField="employeeId"
            isLoading={isLoading}
            maxHeight="calc(100vh - 300px)"
            noDataText="ไม่พบข้อมูลผู้ใช้งาน"
            rowKey="employeeId"
            rows={users}
            showGlobalSearch
          />
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="md" open={isDialogOpen} onClose={handleCloseDialog}>
        <Box autoComplete="off" component="form" onSubmit={handleSaveUser}>
          <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
            {isEditMode ? <Pencil size={20} /> : <Plus size={20} />}
            {isEditMode ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}
          </DialogTitle>

          <DialogContent>
            <Stack spacing={2.25} sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={5}>
                  <BufferedTextField
                    autoFocus
                    fullWidth
                    required
                    autoComplete="new-password"
                    helperText="รองรับเฉพาะตัวเลขเท่านั้น"
                    label="รหัสพนักงาน"
                    name="stock-employee-code"
                    value={form.employeeId}
                    onChange={(event) => handleChange('employeeId', event.target.value)}
                  />
                </Grid>
                <Grid size={4}>
                  <BufferedTextField
                    fullWidth
                    required
                    autoComplete="new-password"
                    helperText="ไม่รองรับตัวเลขและอักขระพิเศษ"
                    label="ชื่อพนักงาน"
                    name="stock-employee-full-name"
                    value={form.name}
                    onChange={(event) => handleChange('name', event.target.value)}
                  />
                </Grid>
                <Grid size={3}>
                  <BufferedTextField
                    fullWidth
                    required
                    autoComplete="new-password"
                    helperText="ค่าเริ่มต้น HR"
                    label="แผนก"
                    name="stock-employee-department"
                    value={form.department}
                    onChange={(event) => handleChange('department', event.target.value)}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <BufferedTextField
                    fullWidth
                    required
                    autoComplete="new-password"
                    helperText="ไม่รองรับภาษาไทย"
                    label="ชื่อผู้ใช้"
                    name="stock-login-code"
                    value={form.username}
                    onChange={(event) => handleChange('username', event.target.value)}
                  />
                </Grid>
                <Grid size={6}>
                  <BufferedTextField
                    fullWidth
                    required={!isEditMode}
                    autoComplete="new-password"
                    helperText={isEditMode ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน' : ''}
                    label="รหัสผ่าน"
                    name="stock-login-secret"
                    type="password"
                    value={form.password}
                    onChange={(event) => handleChange('password', event.target.value)}
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                required
                select
                helperText="เมื่อเลือกสิทธิ์ ระบบจะตั้งค่าเมนูเริ่มต้นให้อัตโนมัติ และสามารถปรับรายคนได้"
                label="สิทธิ์การใช้งาน"
                value={form.role}
                onChange={(event) => handleChange('role', event.target.value)}
              >
                <MenuItem disabled value="">
                  กรุณาเลือกสิทธิ์การใช้งาน
                </MenuItem>
                {permissionOptions.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>

              <Box
                sx={{
                  border: '1px solid #d9e0ea',
                  borderRadius: 1.5,
                  p: 2,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography sx={{ color: '#111827', fontSize: 14, fontWeight: 800 }}>
                        เมนูที่มองเห็นได้ *
                      </Typography>
                      <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.25 }}>
                        ติ๊กเลือกเมนูที่พนักงานคนนี้สามารถใช้งานได้ หรือใช้ค่าเริ่มต้นตามสิทธิ์หลัก
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={handleApplyRoleDefaultMenus}>
                        ค่าเริ่มต้นตามสิทธิ์
                      </Button>
                      <Button size="small" variant="outlined" onClick={handleSelectAllMenus}>
                        เลือกทั้งหมด
                      </Button>
                      <Button color="inherit" size="small" onClick={handleClearMenus}>
                        ล้าง
                      </Button>
                    </Stack>
                  </Stack>

                  <Divider />

                  <FormGroup
                    sx={{
                      display: 'grid',
                      gap: 0.5,
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    }}
                  >
                    {menuOptions.map((menu) => (
                      <FormControlLabel
                        key={menu.id}
                        control={
                          <Checkbox
                            checked={form.menuIds.includes(menu.id)}
                            onChange={() => handleToggleMenu(menu.id)}
                          />
                        }
                        label={menu.label}
                      />
                    ))}
                  </FormGroup>
                </Stack>
              </Box>

              <TextField
                fullWidth
                required
                select
                label="สถานะ"
                value={String(form.status)}
                onChange={(event) => handleChange('status', Number(event.target.value))}
              >
                {statusOptions.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </TextField>

              {errorMessage ? (
                <Typography sx={{ color: '#dc2626', fontSize: 13, fontWeight: 700 }}>
                  {errorMessage}
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Typography
              sx={{
                color: canSubmit ? '#64748b' : '#dc2626',
                flex: 1,
                fontSize: 13,
                fontWeight: canSubmit ? 500 : 700,
                textAlign: 'left',
              }}
            >
              {canSubmit
                ? 'ตรวจสอบข้อมูลให้ถูกต้องก่อนกดบันทึก'
                : 'กรุณากรอกข้อมูลให้ครบและเลือกอย่างน้อย 1 เมนูก่อนกดบันทึก'}
            </Typography>
            <Button color="inherit" onClick={handleCloseDialog}>
              ยกเลิก
            </Button>
            <Button disabled={!canSubmit || isSaving} type="submit" variant="contained">
              {isSaving
                ? isEditMode
                  ? 'กำลังแก้ไข...'
                  : 'กำลังบันทึก...'
                : isEditMode
                  ? 'แก้ไขพนักงาน'
                  : 'บันทึกพนักงาน'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="sm"
        open={Boolean(menuDetailUser)}
        onClose={() => setMenuDetailUser(null)}
      >
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <Eye size={20} />
          เมนูที่มองเห็น
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 800 }}>
                {menuDetailUser?.name || '-'}
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                รหัสพนักงาน {menuDetailUser?.employeeId || '-'} | ชื่อผู้ใช้{' '}
                {menuDetailUser?.username || '-'}
              </Typography>
            </Box>

            <Box
              sx={{
                border: '1px solid #cbd5e1',
                borderRadius: 1.5,
                overflow: 'hidden',
              }}
            >
              {menuDetailItems.map((menu, index) => (
                <Box
                  key={menu.id}
                  sx={{
                    alignItems: 'center',
                    bgcolor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderBottom:
                      index === menuDetailItems.length - 1 ? 'none' : '1px solid #e2e8f0',
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: '48px 1fr',
                    px: 2,
                    py: 1.25,
                  }}
                >
                  <Typography sx={{ color: '#64748b', fontSize: 13, fontWeight: 700 }}>
                    {index + 1}
                  </Typography>
                  <Box>
                    <Typography sx={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>
                      {menu.label}
                    </Typography>
                  </Box>
                </Box>
              ))}

              {!menuDetailItems.length ? (
                <Typography sx={{ color: '#94a3b8', fontSize: 14, p: 2, textAlign: 'center' }}>
                  ยังไม่ได้กำหนดเมนู
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={() => setMenuDetailUser(null)}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default UsersPage
