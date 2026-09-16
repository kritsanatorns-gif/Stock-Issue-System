import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material'
import { Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getVatSetting, updateVatSetting } from '../../api/api'

export default function VatSettingsPage() {
  const [vatRate, setVatRate] = useState('7')
  const [isSaving, setIsSaving] = useState(false)
  const isValid = vatRate !== '' && Number.isFinite(Number(vatRate)) && Number(vatRate) >= 0 && Number(vatRate) <= 100 && Math.round(Number(vatRate) * 100) / 100 === Number(vatRate)
  const load = useCallback(async () => {
    try { const data = await getVatSetting(); setVatRate(String(data.vatRate ?? 7)) } catch { toast.error('โหลดค่า VAT ไม่สำเร็จ') }
  }, [])
  useEffect(() => { load() }, [load])
  const save = async () => {
    if (!isValid) return
    setIsSaving(true)
    try { const data = await updateVatSetting({ vatRate: Number(vatRate) }); setVatRate(String(data.vatRate)); toast.success('บันทึกค่า VAT แล้ว') }
    catch (error) { toast.error(error?.response?.data ?? 'บันทึกค่า VAT ไม่สำเร็จ') }
    finally { setIsSaving(false) }
  }
  return <Stack spacing={2.5} sx={{ maxWidth: 680 }}>
    <div><Typography sx={{ fontSize: 24, fontWeight: 900 }}>จัดการ VAT</Typography><Typography color="text.secondary">กำหนด VAT กลางที่ใช้คำนวณยอดสรุปในหน้ารายงาน</Typography></div>
    <Card elevation={0} sx={{ border: '1px solid #d9e0ea' }}><CardContent><Stack spacing={2}>
      <Alert severity="info">ระบบใช้ค่านี้เฉพาะตอนสรุปยอดในหน้ารายงาน โดยไม่กระทบราคาสินค้าหรือต้นทุน FIFO</Alert>
      <TextField autoFocus error={!isValid} helperText={isValid ? 'ตั้งได้ตั้งแต่ 0 ถึง 100 และมีทศนิยมได้ 2 ตำแหน่ง' : 'กรอก 0–100 ทศนิยมไม่เกิน 2 ตำแหน่ง'} label="อัตรา VAT (%)" onChange={(event) => setVatRate(event.target.value)} slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }} type="number" value={vatRate} />
      <Button disabled={!isValid || isSaving} onClick={save} startIcon={<Save size={18} />} sx={{ alignSelf: 'flex-end' }} variant="contained">บันทึก</Button>
    </Stack></CardContent></Card>
  </Stack>
}
