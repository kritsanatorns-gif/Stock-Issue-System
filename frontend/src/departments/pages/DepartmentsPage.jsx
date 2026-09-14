import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Database, Pencil, Plus, RefreshCw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { createDepartment, getDepartments, importDepartmentsFromHr, updateDepartment } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { normalizePlainName } from '../../utils/inputGuards'

const emptyForm = {
  departmentId: '',
  departmentName: '',
  divisionName: '',
  departmentStatus: 1,
}

function mapDepartment(row) {
  return {
    departmentId: row.departmentId ?? row.DepartmentId ?? '',
    departmentName: row.departmentName ?? row.DepartmentName ?? '',
    divisionName: row.divisionName ?? row.DivisionName ?? row.departmentName ?? row.DepartmentName ?? '',
    departmentStatus: Number(row.departmentStatus ?? row.DepartmentStatus ?? 1),
  }
}

function DepartmentsPage() {
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [tableResetKey, setTableResetKey] = useState(0)

  const loadDepartments = async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const data = await getDepartments()
      setDepartments((data ?? []).map(mapDepartment))
    } catch {
      setLoadError('โหลดข้อมูลแผนกไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDepartments()
  }, [])

  const handleCreate = () => {
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const handleEdit = (department) => {
    setForm(department)
    setIsDialogOpen(true)
  }

  const handleReset = () => {
    setForm(emptyForm)
    setIsDialogOpen(false)
    setTableResetKey((current) => current + 1)
    loadDepartments()
  }

  const handleImportFromHr = async () => {
    const result = await Swal.fire({
      title: 'นำเข้าฝ่ายและแผนกจาก HR',
      text: 'ระบบจะอ่านข้อมูลจาก HR แล้วเพิ่มเฉพาะรายการที่ยังไม่มีในระบบนี้ โดยจะไม่แก้ไขหรือลบข้อมูล HR',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'นำเข้า',
      cancelButtonText: 'ยกเลิก',
      customClass: { container: 'stock-swal-container' },
    })

    if (!result.isConfirmed) return

    setIsLoading(true)
    try {
      const importResult = await importDepartmentsFromHr()
      await loadDepartments()
      await Swal.fire({
        title: 'นำเข้าข้อมูลสำเร็จ',
        text: `เพิ่ม ${importResult.imported ?? 0} รายการ · มีอยู่แล้ว ${importResult.skipped ?? 0} รายการ`,
        icon: 'success',
        confirmButtonText: 'ตกลง',
        customClass: { container: 'stock-swal-container' },
      })
    } catch (error) {
      await Swal.fire({
        title: 'นำเข้าข้อมูลไม่สำเร็จ',
        text: String(error?.response?.data ?? '') || 'ไม่สามารถอ่านข้อมูลจาก HR ได้',
        icon: 'error',
        confirmButtonText: 'ตกลง',
        customClass: { container: 'stock-swal-container' },
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: field === 'departmentName' || field === 'divisionName' ? normalizePlainName(value) : value,
    }))
  }

  const canSave = form.divisionName.trim() && form.departmentName.trim()

  const handleSave = async () => {
    if (!canSave) return

    setIsSaving(true)
    const payload = {
      departmentName: form.departmentName.trim(),
      divisionName: form.divisionName.trim(),
      departmentStatus: Number(form.departmentStatus),
    }

    try {
      const savedDepartment = form.departmentId
        ? await updateDepartment(form.departmentId, payload)
        : await createDepartment(payload)
      const mappedDepartment = mapDepartment(savedDepartment)

      setDepartments((current) => (
        form.departmentId
          ? current.map((department) => (
            department.departmentId === mappedDepartment.departmentId ? mappedDepartment : department
          ))
          : [mappedDepartment, ...current]
      ))
      setIsDialogOpen(false)
      await Swal.fire({
        title: 'สำเร็จ',
        text: 'บันทึกข้อมูลแผนกสำเร็จ',
        icon: 'success',
        customClass: { container: 'stock-swal-container' },
        confirmButtonText: 'ตกลง',
      })
    } catch (error) {
      const apiMessage = String(error?.response?.data ?? '')
      await Swal.fire({
        title: 'ไม่สำเร็จ',
        text: apiMessage || 'บันทึกข้อมูลแผนกไม่สำเร็จ',
        icon: 'error',
        customClass: { container: 'stock-swal-container' },
        confirmButtonText: 'ตกลง',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const columns = [
    {
      key: 'actions', label: 'แก้ไข', width: 120, align: 'center', searchable: false, sortable: false,
      render: (row) => (
        <Button startIcon={<Pencil size={16} />} size="small" variant="outlined" onClick={() => handleEdit(row)}>
          แก้ไข
        </Button>
      ),
    },
    { key: 'divisionName', label: 'ฝ่าย', width: 180 },
    { key: 'departmentName', label: 'ชื่อแผนก', width: 260 },
    {
      key: 'departmentStatus', label: 'สถานะ', width: 140, align: 'center', searchable: false,
      render: (row) => (
        <Chip color={row.departmentStatus === 1 ? 'success' : 'error'} label={row.departmentStatus === 1 ? 'ใช้งาน' : 'ไม่ใช้งาน'} size="small" />
      ),
    },
  ]

  return (
    <Stack spacing={2.5}>
      <Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>จัดการแผนก</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>จัดการฝ่าย แผนก และสถานะการใช้งาน</Typography>
        </Box>
        <Stack direction="row" spacing={1.25}>
          <Button disabled={isLoading} startIcon={<Database size={16} />} sx={{ fontWeight: 700, height: 40, py: 0 }} variant="outlined" onClick={handleImportFromHr}>นำเข้าจาก HR</Button>
          <Button disabled={isLoading} startIcon={<RefreshCw size={16} />} sx={{ fontWeight: 700, height: 40, minWidth: 122, py: 0 }} variant="outlined" onClick={handleReset}>รีเฟรช</Button>
          <Button startIcon={<Plus size={18} />} sx={{ fontWeight: 700, height: 40, minWidth: 136, py: 0 }} variant="contained" onClick={handleCreate}>เพิ่มแผนก</Button>
        </Stack>
      </Stack>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #d9e0ea', borderRadius: 2 }}>
        <CardContent sx={{ p: 2.5 }}>
          <AppTable key={tableResetKey} columns={columns} defaultSortField="departmentId" defaultSortDirection="desc" isLoading={isLoading} noDataText="ไม่พบข้อมูลแผนก" rowKey="departmentId" rows={departments} showGlobalSearch />
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="sm" open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <DialogTitle>{form.departmentId ? 'แก้ไขแผนก' : 'เพิ่มแผนก'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField fullWidth select label="สถานะ" value={form.departmentStatus} onChange={(event) => handleFormChange('departmentStatus', event.target.value)}>
                  <MenuItem value={1}>ใช้งาน</MenuItem>
                  <MenuItem value={2}>ไม่ใช้งาน</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <TextField fullWidth required helperText="รองรับภาษาไทย อังกฤษ ตัวเลข และ . _ / -" label="ฝ่าย" value={form.divisionName} onChange={(event) => handleFormChange('divisionName', event.target.value)} />
            <TextField fullWidth required label="ชื่อแผนก" value={form.departmentName} onChange={(event) => handleFormChange('departmentName', event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
          <Button disabled={!canSave || isSaving} startIcon={<Save size={18} />} variant="contained" onClick={() => setIsConfirmSaveOpen(true)}>บันทึก</Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="xs" open={isConfirmSaveOpen} onClose={() => setIsConfirmSaveOpen(false)}>
        <DialogTitle>ยืนยันการบันทึก</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info">ต้องการบันทึกข้อมูลแผนกนี้ใช่หรือไม่</Alert>
            <Typography sx={{ color: '#475569', fontSize: 14 }}>ฝ่าย: {form.divisionName || '-'}</Typography>
            <Typography sx={{ color: '#475569', fontSize: 14 }}>แผนก: {form.departmentName || '-'}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setIsConfirmSaveOpen(false)}>ยกเลิก</Button>
          <Button startIcon={<Save size={18} />} variant="contained" onClick={() => { setIsConfirmSaveOpen(false); handleSave() }}>ยืนยันบันทึก</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default DepartmentsPage
