import { Button, Chip, Stack, TextField, Typography } from '@mui/material'
import { Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createUnit, getUnits, updateUnit } from '../../api/api'
import AppTable from '../../components/common/AppTable'

export default function UnitsPage() {
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const loadRows = useCallback(async () => {
    try { setRows(await getUnits()) } catch { toast.error('โหลดข้อมูลหน่วยไม่สำเร็จ') }
  }, [])
  useEffect(() => { loadRows() }, [loadRows])
  const addUnit = async () => {
    if (!name.trim()) return
    try { await createUnit({ unitName: name.trim() }); setName(''); await loadRows(); toast.success('เพิ่มหน่วยแล้ว') } catch (error) { toast.error(error?.response?.data ?? 'เพิ่มหน่วยไม่สำเร็จ') }
  }
  const columns = [
    { key: 'unitId', label: 'ลำดับ', width: 90, align: 'center' },
    { key: 'unitName', label: 'หน่วย', minWidth: 240 },
    { key: 'unitStatus', label: 'สถานะ', width: 140, align: 'center', render: (row) => <Chip color={row.unitStatus === 1 ? 'success' : 'default'} label={row.unitStatus === 1 ? 'ใช้งาน' : 'ปิดใช้งาน'} size="small" /> },
    { key: 'manage', label: 'จัดการ', width: 150, align: 'center', searchable: false, sortable: false, render: (row) => <Button size="small" variant="outlined" onClick={async () => { await updateUnit(row.unitId, { unitName: row.unitName, unitStatus: row.unitStatus === 1 ? 2 : 1 }); await loadRows() }}>{row.unitStatus === 1 ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</Button> },
  ]
  return <Stack spacing={2.5}><Stack direction="row" justifyContent="space-between"><div><Typography sx={{ fontSize: 24, fontWeight: 900 }}>จัดการหน่วย</Typography><Typography color="text.secondary">เพิ่มและเปิด/ปิดหน่วยสำหรับรับเข้าและเบิกออก</Typography></div><Button startIcon={<RefreshCw size={18} />} variant="outlined" onClick={loadRows}>รีเฟรช</Button></Stack><Stack direction="row" spacing={1}><TextField label="ชื่อหน่วย" size="small" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addUnit() }} /><Button startIcon={<Plus size={18} />} variant="contained" onClick={addUnit}>เพิ่มหน่วย</Button></Stack><AppTable columns={columns} rows={rows} rowKey="unitId" /></Stack>
}
