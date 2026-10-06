import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Chip, Divider, List, ListItemButton, ListItemText, Paper, Stack, TextField, Typography } from '@mui/material'

const articles = [
  { id: 'start', group: 'คู่มือผู้ขอเบิก', title: 'เริ่มต้นใช้งาน', intro: 'ส่งคำขอเบิกสินค้าสำนักงานและติดตามผลผ่านระบบ โดยใช้ข้อมูลพนักงานจาก HR', steps: ['เข้าหน้าล็อกอินผู้ขอเบิก เลือกฝ่าย–แผนกและหน่วยงานของตนเอง', 'กรอกรหัสพนักงาน ตรวจสอบชื่อและข้อมูลสังกัดที่ระบบแสดงจาก HR', 'เข้าสู่ระบบ หากข้อมูลไม่ตรง ให้ตรวจรหัสและสังกัดก่อนส่งคำขอ'], note: 'บัญชี HR สำหรับเจ้าหน้าที่คลังใช้ชื่อผู้ใช้และรหัสผ่านของระบบ ส่วนผู้ขอเบิกใช้ข้อมูลพนักงานจาก HR' },
  { id: 'request', group: 'คู่มือผู้ขอเบิก', title: 'ขอเบิกสินค้า', intro: 'เลือกสินค้าและจำนวนที่ต้องการ แล้วส่งให้ HR ตรวจสอบและอนุมัติ', steps: ['เปิดเมนูขอเบิก ค้นหาสินค้าด้วยชื่อหรือรหัสสินค้า', 'เลือกสินค้าและกรอกจำนวน ตรวจสอบหน่วยนับให้ถูกต้อง', 'ตรวจสอบรายการทั้งหมด รวมถึงชื่อผู้ขอ ฝ่าย แผนก และหน่วยงาน', 'หากเป็นรายการเร่งด่วน เลือกเบิกด่วนและระบุเหตุผล', 'กดส่งคำขอเบิกและยืนยัน เก็บเลขที่คำขอไว้สำหรับติดตาม'], note: 'ส่งคำขอแล้วไม่ได้หมายความว่าตัดสต๊อกทันที ต้องผ่านการอนุมัติและบันทึกการจ่ายจาก HR' },
  { id: 'tracking', group: 'คู่มือผู้ขอเบิก', title: 'ประวัติและสถานะคำขอ', intro: 'ดูความคืบหน้าและจำนวนที่ได้รับจริงของแต่ละคำขอ', steps: ['เปิดเมนูประวัติ กำหนดช่วงวันที่ที่ต้องการค้นหา', 'ค้นหาเลขที่คำขอหรือกรองข้อมูลในหัวตาราง', 'เปิดรายละเอียดเพื่อตรวจจำนวนขอเบิก จ่ายแล้ว ยังค้าง และไม่ให้เบิก', 'อ่านหมายเหตุและเหตุผลของรายการที่ไม่ได้รับอนุญาต'], statuses: ['รออนุมัติ — HR ยังไม่ได้อนุมัติคำขอ', 'รอจัดของ — อนุมัติแล้ว กำลังรอการจ่าย', 'ค้าง — ยังมีจำนวนที่รอจ่าย', 'ได้ของครบ — ไม่มีจำนวนรอจ่ายแล้ว ให้ดูยอดจ่ายและยอดไม่ให้เบิกประกอบ', 'ไม่ให้เบิก — คำขอไม่ได้รับอนุญาตให้เบิก'] },
  { id: 'print', group: 'คู่มือผู้ขอเบิก', title: 'พิมพ์ใบเบิกและดาวน์โหลด PDF', intro: 'เปิดเอกสารจากรายละเอียดคำขอเพื่อพิมพ์หรือเก็บเป็นไฟล์', steps: ['เปิดประวัติแล้วเลือกดูรายละเอียดคำขอที่ต้องการ', 'กดพิมพ์ใบคำขอเพื่อเปิดหน้าพิมพ์ หรือดาวน์โหลด PDF เพื่อบันทึกไฟล์', 'ตรวจชื่อผู้ขอ สังกัด รายการและจำนวนก่อนนำเอกสารไปใช้', 'กรณีรายการค้าง ให้ตรวจชื่อปุ่มและประเภทเอกสารก่อนพิมพ์'], note: 'หากหน้าพิมพ์ไม่เปิด ให้ตรวจว่าบราวเซอร์บล็อกหน้าต่างป๊อปอัปของระบบหรือไม่' },
  { id: 'approve', group: 'คู่มือ HR / เจ้าหน้าที่คลัง', title: 'อนุมัติคำขอเบิก', intro: 'ตรวจรายการที่ผู้ใช้ส่งมา ก่อนเริ่มจัดเตรียมสินค้า', steps: ['เข้าสู่ระบบ HR แล้วเปิดเมนูอนุมัติคำขอเบิก', 'ค้นหาเลขที่คำขอ ตรวจผู้ขอและหน่วยงาน รวมถึงเหตุผลเบิกด่วน', 'กดดูรายการเพื่อตรวจรายละเอียดสินค้า', 'กดอนุมัติคำขอเบิกและยืนยัน ระบบเปลี่ยนเป็นรอจัดของ'], note: 'การอนุมัติยังไม่ตัดสต๊อก การตัดสต๊อกเกิดเมื่อบันทึกจ่ายสินค้าจริง' },
  { id: 'issue', group: 'คู่มือ HR / เจ้าหน้าที่คลัง', title: 'จ่ายสินค้าและจัดการยอดค้าง', intro: 'บันทึกเฉพาะจำนวนที่ส่งมอบจริง สามารถทยอยจ่ายได้', steps: ['เปิดรายละเอียดคำขอที่อนุมัติแล้ว ตรวจคงเหลือและยอดยังค้าง', 'กรอกจำนวนจริงในช่องจ่ายครั้งนี้ของแต่ละรายการ จำนวนต้องไม่เกินยอดค้างและสต๊อกที่มี', 'ใส่หมายเหตุรายการหากจำเป็น แล้วกดบันทึกการจ่ายสินค้า', 'ตรวจข้อความยืนยันก่อนบันทึก หากจ่ายไม่ครบ ระบบเก็บส่วนที่เหลือเป็นยอดค้าง', 'หากยังจ่ายไม่ได้เลย ใช้ปุ่มยังไม่จ่าย กลับมาเปิดคำขอเพื่อจ่ายต่อภายหลัง'], note: 'ตรวจช่องจ่ายครั้งนี้ทุกครั้ง ระบบอาจเติมจำนวนที่จ่ายได้ให้ล่วงหน้า' },
  { id: 'deny', group: 'คู่มือ HR / เจ้าหน้าที่คลัง', title: 'ไม่ให้เบิกเป็นรายสินค้า', intro: 'ใช้สำหรับรายการที่ยังไม่เคยจ่ายและไม่อนุญาตให้เบิก', steps: ['เปิดรายละเอียดคำขอ แล้วดูยอดจ่ายแล้วของสินค้าที่ต้องการปฏิเสธ', 'ถ้ายอดจ่ายแล้วเป็นศูนย์และยังมียอดค้าง ให้กดไม่ให้เบิกในแถวสินค้านั้น', 'ระบุเหตุผลและยืนยัน ระบบบันทึกรายการนั้นเป็นไม่อนุญาตให้เบิก', 'ทำรายการอื่นต่อได้ โดยตรวจยอดสรุปที่ด้านบนอีกครั้ง'], note: 'รายการที่เคยจ่ายแล้ว แม้ยังค้างบางส่วน จะกดไม่ให้เบิกไม่ได้ ส่วนปุ่มไม่ให้เบิกทั้งคำขอมีเงื่อนไขตามสถานะคำขอ' },
  { id: 'receive', group: 'คู่มือ HR / เจ้าหน้าที่คลัง', title: 'รับเข้าสินค้า', intro: 'บันทึกสินค้าเข้าคลังพร้อมจำนวนและต้นทุน', steps: ['เปิดเมนูรับเข้าสินค้า เลือกสินค้าที่รับเข้าตามเอกสารจริง', 'กรอกจำนวน ต้นทุน และข้อมูลผู้ขายหรือ Invoice ตามช่องที่มีในแบบฟอร์ม', 'ตรวจหน่วยนับและยอดรวมให้ตรงกับเอกสาร', 'ยืนยันบันทึก แล้วตรวจรายการในหน้าประวัติ'], note: 'ต้นทุนรับเข้าใช้ในการคำนวณต้นทุนจ่ายแบบ FIFO จึงควรตรวจให้ถูกต้องก่อนบันทึก' },
  { id: 'adjust', group: 'คู่มือ HR / เจ้าหน้าที่คลัง', title: 'ปรับสต๊อก', intro: 'ใช้เมื่อจำนวนตรวจนับจริงแตกต่างจากยอดในระบบ', steps: ['เปิดเมนูปรับสต๊อก เลือกสินค้าที่ตรวจนับแล้ว', 'ตรวจยอดเดิมและกรอกข้อมูลปรับยอดตามแบบฟอร์ม', 'ระบุเหตุผลเพื่อให้ตรวจสอบย้อนหลังได้', 'ตรวจผลต่างก่อนยืนยัน แล้วตรวจยอดคงเหลือและประวัติหลังบันทึก'] },
  { id: 'history', group: 'คู่มือ HR / เจ้าหน้าที่คลัง', title: 'ประวัติและรายงาน', intro: 'ตรวจเอกสารรับเข้า เบิก และปรับสต๊อก รวมถึงรายงานจำนวนและต้นทุน', steps: ['เปิดหน้าประวัติ เลือกช่วงวันที่และประเภทเอกสาร', 'ใช้ช่องค้นหาในแต่ละคอลัมน์ เช่น แผนกผู้เบิกหรือหน่วยงานผู้ขอเบิก', 'กดดูรายการเพื่อเปิดรายละเอียดเอกสาร', 'เปิดหน้ารายงาน เลือกประเภทรายงานและช่วงเวลาที่ต้องการ', 'ตรวจผลลัพธ์ก่อนใช้ปุ่มพิมพ์หรือส่งออกที่รายงานนั้นมีให้'], note: 'ต้นทุนรายงานอ้างอิงการจ่ายและต้นทุน FIFO ไม่ใช่เพียงจำนวนที่ผู้ใช้ขอเบิก' },
  { id: 'master', group: 'คู่มือผู้ดูแลระบบ', title: 'สินค้า ผู้ขาย และข้อมูลแผนก', intro: 'ดูแลข้อมูลอ้างอิงที่ใช้ในระบบให้เป็นปัจจุบัน', steps: ['เปิดเมนูสินค้าหรือผู้ขายเพื่อเพิ่มและแก้ไขข้อมูล ตรวจรหัสและชื่อก่อนบันทึก', 'หน้าแผนกแสดงฝ่าย แผนก และหน่วยงานที่นำเข้าจาก HR', 'เมื่อต้องการอัปเดตจาก HR กดนำเข้าจาก HR และอ่านข้อความยืนยัน', 'ตรวจข้อมูลหลังนำเข้า โดยหน่วยงานคนละรหัสอาจมีชื่อเหมือนกันได้'], note: 'การนำเข้าจาก HR จะแทนที่รายการแผนกเดิมในระบบ ส่วนข้อมูลสังกัดผู้ขอเบิกตรวจจาก HR ตามรหัสพนักงาน' },
  { id: 'users', group: 'คู่มือผู้ดูแลระบบ', title: 'ผู้ใช้และสิทธิ์เมนู', intro: 'กำหนดบัญชีสำหรับเจ้าหน้าที่ HR และผู้ดูแลคลัง', steps: ['เปิดเมนูผู้ใช้ เลือกเพิ่มหรือแก้ไขบัญชี', 'ตรวจชื่อบัญชี ข้อมูลพนักงาน สถานะใช้งาน และบทบาท', 'กำหนดสิทธิ์เมนูตามหน้าที่ของผู้ใช้งานแล้วบันทึก', 'ให้ผู้ใช้เข้าสู่ระบบใหม่เพื่อตรวจเมนูที่ได้รับสิทธิ์'], note: 'เมนูที่มองเห็นขึ้นอยู่กับสิทธิ์ของบัญชี หากไม่มีเมนูที่ต้องใช้ ให้ติดต่อผู้ดูแลระบบ' },
  { id: 'trouble', group: 'ช่วยเหลือ', title: 'แก้ปัญหาเบื้องต้น', intro: 'ตรวจสอบก่อนแจ้งผู้ดูแลระบบ', steps: ['ล็อกอินไม่ได้: ตรวจข้อมูลที่กรอกและการเชื่อมต่อเครือข่าย หากยังไม่ได้ให้เก็บข้อความผิดพลาด', 'โหลดสินค้าไม่ได้: รีเฟรชหน้าและตรวจการเชื่อมต่อ หากยังเกิดซ้ำให้แจ้งผู้ดูแล', 'ไม่พบประวัติ: ตรวจช่วงวันที่ ตัวกรอง และบัญชีหรือหน่วยงานที่เข้าสู่ระบบ', 'กดไม่ให้เบิกไม่ได้: ตรวจว่าสินค้ารายการนั้นเคยจ่ายแล้วหรือไม่ และยังมียอดค้างหรือไม่', 'แจ้งปัญหาพร้อมชื่อหน้าจอ เลขที่คำขอ เวลาเกิดเหตุ และภาพข้อความผิดพลาด โดยไม่ส่งรหัสผ่าน'] },
]

export default function ManualPage() {
  const [query, setQuery] = useState('')
  const [params, setParams] = useSearchParams()
  const isRequester = useLocation().pathname.startsWith('/request/')
  const available = articles.filter((a) => !isRequester || a.group === 'คู่มือผู้ขอเบิก' || a.group === 'ช่วยเหลือ')
  const selected = available.find((a) => a.id === params.get('topic')) ?? available[0]
  const selectedIndex = available.findIndex((a) => a.id === selected.id)
  const previousArticle = available[selectedIndex - 1]
  const nextArticle = available[selectedIndex + 1]
  const articleRef = useRef(null)
  const lastTopic = useRef(selected.id)
  useEffect(() => {
    if (lastTopic.current !== selected.id) {
      articleRef.current?.scrollIntoView({ block: 'start' })
      lastTopic.current = selected.id
    }
  }, [selected.id])
  const filtered = available.filter((a) => [a.title, a.intro, ...a.steps, a.note ?? ''].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, minHeight: '75vh' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>ช่วยเหลือ / คู่มือ / {selected.title}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, gap: 4 }}>
        <Box component="nav" aria-label="สารบัญคู่มือ" sx={{ borderRight: { md: '1px solid #e2e8f0' }, pr: { md: 2 } }}>
          <TextField fullWidth size="small" label="ค้นหาคู่มือ" value={query} onChange={(event) => setQuery(event.target.value)} />
          {!filtered.length && <Typography sx={{ mt: 2 }}>ไม่พบหัวข้อที่ค้นหา</Typography>}
          {[...new Set(filtered.map((a) => a.group))].map((group) => <Box key={group} sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">{group}</Typography>
            <List dense>{filtered.filter((a) => a.group === group).map((article) => <ListItemButton key={article.id} selected={article.id === selected.id} onClick={() => setParams({ topic: article.id })} sx={{ borderRadius: 1, mb: 0.5 }}><ListItemText primary={article.title} /></ListItemButton>)}</List>
          </Box>)}
        </Box>
        <Box component="article" ref={articleRef} key={selected.id} sx={{ maxWidth: 900, scrollMarginTop: '90px' }}>
          <Typography variant="caption" color="text.secondary">{selected.group}</Typography>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 800, mt: 1 }}>{selected.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.9 }}>{selected.intro}</Typography>
          <Stack direction="row" spacing={1} sx={{ my: 3 }}><Chip label="ขั้นตอนใช้งาน" variant="outlined" /><Chip label="คอมพิวเตอร์ / มือถือ" variant="outlined" /></Stack>
          <Divider />
          <Box component="ol" sx={{ pl: 3, my: 3, '& li': { pl: 1, mb: 2, lineHeight: 1.9 } }}>{selected.steps.map((step) => <li key={step}>{step}</li>)}</Box>
          {selected.statuses && <Box component="ul" sx={{ lineHeight: 2.2 }}>{selected.statuses.map((status) => <li key={status}>{status}</li>)}</Box>}
          {selected.note && <Alert severity="info" sx={{ mt: 3, lineHeight: 1.8 }}>{selected.note}</Alert>}
          {selected.id === 'trouble' && (
            <Alert severity="info" sx={{ mt: 3, lineHeight: 1.8 }}>
              หากยังแก้ไขไม่ได้ กรุณาแจ้งฝ่าย IT หรือโทร <a href="tel:503">503</a>
            </Alert>
          )}
          <Divider sx={{ my: 4 }} />
          <Box component="nav" aria-label="หัวข้อก่อนหน้าและถัดไป" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
            {[previousArticle, nextArticle].map((article, index) => article ? (
              <Button
                key={article.id}
                component={Link}
                to={`?topic=${article.id}`}
                variant="outlined"
                sx={{ display: 'flex', flexDirection: 'column', alignItems: index === 0 ? 'flex-start' : 'flex-end', textAlign: index === 0 ? 'left' : 'right', borderColor: 'divider', color: 'text.primary', px: 2, py: 1.25, borderRadius: 1.5, textTransform: 'none', minWidth: 0 }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.secondary' }}>
                  {index === 0 && <ChevronLeft size={14} />}
                  <Typography variant="caption">{index === 0 ? 'ก่อนหน้า' : 'ถัดไป'}</Typography>
                  {index === 1 && <ChevronRight size={14} />}
                </Stack>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{article.title}</Typography>
              </Button>
            ) : <Box key={index} />)}
          </Box>
          <Button component={Link} to={isRequester ? '/request/history' : '/'}>กลับไปใช้งานระบบ</Button>
        </Box>
      </Box>
    </Paper>
  )
}
