import { Alert, Box, Chip, Grid, Stack, Typography } from '@mui/material'
import { AlertTriangle, PackageX, ScanBarcode } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getDashboardSummary } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { formatDisplayDateTime } from '../../utils/dateUtils'
import DashboardWidget from '../components/DashboardWidget'
import SummaryCard from '../components/SummaryCard'

const defaultSummary = {
  criticalStockItems: [],
  issueTodayQty: 0,
  lowStockCount: 0,
  lowStockThreshold: 10,
  outOfStockCount: 0,
}

const criticalStockColumns = [
  { key: 'productId', label: 'รหัสสินค้า', width: 170 },
  { key: 'productName', label: 'ชื่อสินค้า', width: 280 },
  { key: 'barcode', label: 'Barcode', width: 160 },
  { key: 'qty', label: 'คงเหลือ', width: 110, align: 'center' },
  {
    key: 'minQty',
    label: 'เตือนเมื่อเหลือไม่เกิน',
    width: 170,
    align: 'center',
    value: (row) => row.minQty ?? row.MinQty ?? 10,
  },
  { key: 'unit', label: 'หน่วย', width: 90 },
  {
    key: 'status',
    label: 'สถานะ',
    width: 130,
    render: (row) => (
      <Chip
        color={row.qty <= 0 ? 'error' : 'warning'}
        label={row.qty <= 0 ? 'สินค้าหมด' : 'ใกล้หมด'}
        size="small"
      />
    ),
  },
  {
    key: 'lastUpdate',
    label: 'อัปเดตล่าสุด',
    width: 170,
    value: (row) => formatDisplayDateTime(row.lastUpdate),
  },
]

function DashboardPage() {
  const [summary, setSummary] = useState(defaultSummary)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadSummary = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const data = await getDashboardSummary()

        if (isMounted) {
          setSummary({
            criticalStockItems: data.criticalStockItems ?? [],
            issueTodayQty: data.issueTodayQty ?? 0,
            lowStockCount: data.lowStockCount ?? 0,
            lowStockThreshold: data.lowStockThreshold ?? 10,
            outOfStockCount: data.outOfStockCount ?? 0,
          })
        }
      } catch {
        if (isMounted) {
          setLoadError('โหลดข้อมูลหน้าหลักไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      isMounted = false
    }
  }, [])

  const summaryCards = useMemo(
    () => [
      {
        color: '#2563eb',
        helper: 'จำนวนใบคำขอเบิกที่ user ส่งวันนี้',
        icon: ScanBarcode,
        label: 'ใบขอเบิกวันนี้',
        value: summary.issueTodayQty.toLocaleString('th-TH'),
      },
      {
        color: '#f59e0b',
        helper: `คงเหลือ 1-${summary.lowStockThreshold} ชิ้น`,
        icon: AlertTriangle,
        label: 'สินค้าใกล้หมด',
        value: summary.lowStockCount.toLocaleString('th-TH'),
      },
      {
        color: '#dc2626',
        helper: 'คงเหลือ 0 ชิ้น',
        icon: PackageX,
        label: 'สินค้าหมด',
        value: summary.outOfStockCount.toLocaleString('th-TH'),
      },
    ],
    [summary],
  )

  return (
    <Stack spacing={3}>
      <Box>
        <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 800 }}>
          หน้าหลัก
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
          ภาพรวมการเบิกสินค้าและสถานะสต๊อกประจำวัน
        </Typography>
      </Box>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <Grid container spacing={2.5}>
        {summaryCards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 4 }}>
            <SummaryCard {...card} />
          </Grid>
        ))}
      </Grid>

      <DashboardWidget title="ภาพรวมการทำงาน">
        <AppTable
          columns={criticalStockColumns}
          defaultSortField="qty"
          isLoading={isLoading}
          maxHeight={520}
          noDataText="ไม่มีสินค้าใกล้หมดหรือสินค้าหมด"
          rowKey={(row) => row.productId}
          rows={summary.criticalStockItems}
          showColumnFilters={false}
          showGlobalSearch
        />
      </DashboardWidget>
    </Stack>
  )
}

export default DashboardPage
