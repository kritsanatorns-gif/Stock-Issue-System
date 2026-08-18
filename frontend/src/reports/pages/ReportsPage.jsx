import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { AlertTriangle, Building2, Clock, Download, FileText, Package, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getPurchasesBySupplier, getRequisitions, getStockIssues } from '../../api/api'
import AppTable from '../../components/common/AppTable'
import { formatDisplayDate, formatDisplayDateTime, getDateSortValue, getElapsedDuration, getIdSortValue } from '../../utils/dateUtils'
import { exportRowsToExcel } from '../../utils/excelUtils'

const shortMonthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const palette = ['#2563eb', '#22b8cf', '#f97316', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b', '#f59e0b']

const rankingModes = [
  { label: 'แผนกเบิกเยอะสุด', value: 'department' },
  { label: 'สินค้าถูกเบิกเยอะสุด', value: 'product' },
]

const periodModes = [
  { label: 'รายเดือน', value: 'monthly' },
  { label: 'รายวัน', value: 'daily' },
]

const reportModes = [
  { label: 'รายงานการเบิก', value: 'issue' },
  { label: 'ยอดซื้อแยกผู้ขาย', value: 'purchase' },
]

const exportColumns = [
  { header: 'วันที่', value: (row) => row.dateName },
  { header: 'แผนก', value: (row) => row.department },
  { header: 'รหัสสินค้า', value: (row) => row.productCode },
  { header: 'ชื่อสินค้า', value: (row) => row.productName },
  { header: 'จำนวนสินค้าที่ถูกเบิก', value: (row) => row.totalQty },
  { header: 'จำนวนใบเบิก', value: (row) => row.documentCount },
]

const backlogExportColumns = [
  { header: 'วันที่ขอเบิก', value: (row) => row.requestDateName },
  { header: 'เลขที่คำขอ', value: (row) => row.requestNo },
  { header: 'ระยะเวลาค้าง', value: (row) => row.backlogDurationLabel },
  { header: 'ระดับการตามงาน', value: (row) => row.followUpText },
  { header: 'แผนก', value: (row) => row.department },
  { header: 'ผู้ขอเบิก', value: (row) => row.requesterName },
  { header: 'รหัสสินค้า', value: (row) => row.productCode },
  { header: 'ชื่อสินค้า', value: (row) => row.productName },
  { header: 'จำนวนที่ขอ', value: (row) => row.requestQty },
  { header: 'จ่ายแล้ว', value: (row) => row.fulfilledQty },
  { header: 'ยังค้าง', value: (row) => row.backlogQty },
  { header: 'คงเหลือปัจจุบัน', value: (row) => row.availableQty },
  { header: 'หน่วย', value: (row) => row.unit },
  { header: 'หมายเหตุ HR', value: (row) => row.hrRemark },
]

const purchaseExportColumns = [
  { header: 'ผู้ขาย', value: (row) => row.supplierName },
  { header: 'จำนวนเอกสารรับเข้า', value: (row) => row.documentCount },
  { header: 'จำนวนรายการสินค้า', value: (row) => row.itemCount },
  { header: 'จำนวนรับเข้ารวม', value: (row) => row.totalQty },
  { header: 'ยอดซื้อรวม', value: (row) => row.totalPurchase },
]

const purchaseColumns = [
  { key: 'supplierName', label: 'ผู้ขาย', minWidth: 260 },
  { key: 'documentCount', label: 'เอกสารรับเข้า', width: 160, align: 'center' },
  { key: 'itemCount', label: 'รายการสินค้า', width: 160, align: 'center' },
  { key: 'totalQty', label: 'จำนวนรับเข้ารวม', width: 180, align: 'center' },
  {
    key: 'totalPurchase',
    label: 'ยอดซื้อรวม',
    width: 180,
    align: 'right',
    render: (row) => Number(row.totalPurchase ?? 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  },
]

const reportColumns = [
  { key: 'dateName', label: 'วันที่', width: 130, value: (row) => row.dateName, sortValue: (row) => getDateSortValue(row.date) },
  { key: 'department', label: 'แผนก', width: 180 },
  { key: 'productCode', label: 'รหัสสินค้า', width: 170 },
  { key: 'productName', label: 'สินค้า', width: 280 },
  { key: 'totalQty', label: 'จำนวนสินค้าที่ถูกเบิก', width: 170, align: 'center' },
  { key: 'documentCount', label: 'จำนวนใบเบิก', width: 130, align: 'center' },
]

const backlogColumns = [
  { key: 'requestDateName', label: 'วันที่ขอเบิก', width: 140, value: (row) => row.requestDateName, sortValue: (row) => getDateSortValue(row.requestedAt) },
  { key: 'requestNo', label: 'เลขที่คำขอ', width: 130 },
  { key: 'backlogDurationLabel', label: 'ค้างมาแล้ว', width: 125, align: 'center', value: (row) => row.backlogDurationLabel, sortValue: (row) => row.backlogDays, render: (row) => row.backlogDurationLabel },
  {
    key: 'followUpText',
    label: 'ระดับการตามงาน',
    width: 130,
    align: 'center',
    render: (row) => (
      <Chip
        color={row.followUpColor}
        label={row.followUpText}
        size="small"
        sx={{ fontWeight: 800 }}
      />
    ),
  },
  { key: 'department', label: 'แผนก', width: 120 },
  { key: 'requesterName', label: 'ผู้ขอเบิก', width: 180 },
  { key: 'productCode', label: 'รหัสสินค้า', width: 170 },
  { key: 'productName', label: 'ชื่อสินค้า', width: 260 },
  { key: 'requestQty', label: 'จำนวนที่ขอ', width: 115, align: 'center' },
  { key: 'fulfilledQty', label: 'จ่ายแล้ว', width: 105, align: 'center' },
  { key: 'backlogQty', label: 'ยังค้าง', width: 105, align: 'center' },
  { key: 'availableQty', label: 'คงเหลือปัจจุบัน', width: 140, align: 'center' },
  { key: 'unit', label: 'หน่วย', width: 90, align: 'center' },
  { key: 'hrRemark', label: 'หมายเหตุ HR', width: 260, wrap: true, value: (row) => row.hrRemark || '-', render: (row) => row.hrRemark || '-' },
]

const backlogDepartmentColumns = [
  { key: 'department', label: 'แผนก', width: 180 },
  { key: 'backlogQty', label: 'จำนวนค้าง', width: 120, align: 'center' },
  { key: 'documentCount', label: 'จำนวนใบค้าง', width: 130, align: 'center' },
  { key: 'oldestBacklogDays', label: 'ค้างนานสุด', width: 130, align: 'center', render: (row) => `${row.oldestBacklogDays} วัน` },
]

function getBacklogFollowUp(backlogDays) {
  if (backlogDays >= 7) {
    return { color: 'error', text: 'ตามด่วน' }
  }

  if (backlogDays >= 3) {
    return { color: 'warning', text: 'ควรตาม' }
  }

  return { color: 'default', text: 'ตามปกติ' }
}

function cleanReportDepartment(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return 'ไม่ระบุแผนก'
  }

  const cancelIndex = text.toLowerCase().indexOf('| cancel:')

  if (cancelIndex >= 0) {
    return text.slice(0, cancelIndex).trim() || 'ไม่ระบุแผนก'
  }

  return text
}

function flattenBacklogRows(requisitions) {
  return requisitions.flatMap((requisition) =>
    (requisition.items ?? [])
      .filter((item) => Number(item.backlogQty ?? 0) > 0)
      .map((item) => {
        const requestedAt = requisition.createdAt
        const backlogDuration = getElapsedDuration(requestedAt)
        const backlogDays = backlogDuration.days
        const followUp = getBacklogFollowUp(backlogDays)

        return {
          availableQty: Number(item.availableQty ?? 0),
          backlogDurationLabel: backlogDuration.label,
          backlogDays,
          backlogQty: Number(item.backlogQty ?? 0),
          department: cleanReportDepartment(requisition.department),
          detailId: item.detailId,
          fulfilledQty: Number(item.fulfilledQty ?? 0),
          followUpColor: followUp.color,
          followUpText: followUp.text,
          hrRemark: requisition.hrRemark ?? '',
          productCode: item.code,
          productName: item.productName,
          requestDateName: formatDisplayDateTime(requestedAt),
          requestedAt,
          requesterName: requisition.employeeName ?? requisition.requesterName ?? '-',
          requestNo: requisition.requestNo,
          requestQty: Number(item.quantity ?? 0),
          unit: item.unit ?? '',
        }
      }),
  )
}

function buildBacklogDepartmentRows(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    if (!groups.has(row.department)) {
      groups.set(row.department, {
        department: row.department,
        documentNos: new Set(),
        backlogQty: 0,
        oldestBacklogDays: 0,
      })
    }

    const group = groups.get(row.department)
    group.backlogQty += row.backlogQty
    group.documentNos.add(row.requestNo)
    group.oldestBacklogDays = Math.max(group.oldestBacklogDays, row.backlogDays)
  })

  return [...groups.values()]
    .map((row) => ({
      ...row,
      documentCount: row.documentNos.size,
      documentNos: undefined,
    }))
    .sort((first, second) => second.backlogQty - first.backlogQty)
}

function isReportableIssue(report) {
  const status = String(report.status ?? '').trim().toLowerCase()

  if (!status) {
    return true
  }

  return status.includes('บางส่วน')
    || (!status.includes('ถอย')
    && !status.includes('ยกเลิก')
    && !status.includes('cancel')
    && !status.includes('ปรับ')
    && !status.includes('adjust'))
}

function flattenIssueRows(reports) {
  return reports.filter(isReportableIssue).flatMap((report) =>
    (report.items ?? []).map((item) => ({
      createdAt: report.createdAt,
      department: cleanReportDepartment(report.department),
      documentNo: report.documentNo,
      productCode: item.code,
      productName: item.productName,
      quantity: Number(item.quantity ?? 0),
    })),
  )
}

function summarizeByDayDepartmentProduct(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    const date = dayjs(row.createdAt)
    const dateKey = date.format('YYYY-MM-DD')
    const key = [dateKey, row.department, row.productCode, row.productName].join('|')

    if (!groups.has(key)) {
      groups.set(key, {
        date: dateKey,
        dateName: formatDisplayDate(dateKey),
        department: row.department,
        documentNos: new Set(),
        productCode: row.productCode,
        productName: row.productName,
        totalQty: 0,
      })
    }

    const group = groups.get(key)

    group.totalQty += row.quantity
    group.documentNos.add(row.documentNo)
  })

  return [...groups.values()]
    .map((group) => ({
      ...group,
      documentCount: group.documentNos.size,
      documentNos: undefined,
    }))
    .sort((first, second) =>
      second.date.localeCompare(first.date)
      || first.department.localeCompare(second.department, 'th')
      || first.productName.localeCompare(second.productName, 'th'),
    )
}

function buildDepartmentRows(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    groups.set(row.department, (groups.get(row.department) ?? 0) + row.quantity)
  })

  return [...groups.entries()]
    .map(([department, totalQty], index) => ({
      color: palette[index % palette.length],
      label: department,
      totalQty,
    }))
    .sort((first, second) => second.totalQty - first.totalQty)
}

function buildProductRows(rows) {
  const groups = new Map()

  rows.forEach((row) => {
    const key = `${row.productCode}|${row.productName}`

    if (!groups.has(key)) {
      groups.set(key, {
        label: row.productName || row.productCode,
        totalQty: 0,
      })
    }

    groups.get(key).totalQty += row.quantity
  })

  return [...groups.values()]
    .map((row, index) => ({
      ...row,
      color: palette[index % palette.length],
    }))
    .sort((first, second) => second.totalQty - first.totalQty)
}

function buildTimeTrendRows(rows, reportPeriod, selectedYear) {
  if (reportPeriod === 'daily') {
    const startDate = dayjs().subtract(6, 'day')
    const trendRows = Array.from({ length: 7 }, (_, index) => {
      const date = startDate.add(index, 'day')

      return {
        color: '#2563eb',
        key: date.format('YYYY-MM-DD'),
        label: date.format('DD/MM'),
        totalQty: 0,
      }
    })

    rows.forEach((row) => {
      const dateKey = dayjs(row.createdAt).format('YYYY-MM-DD')
      const trendRow = trendRows.find((item) => item.key === dateKey)

      if (trendRow) {
        trendRow.totalQty += row.quantity
      }
    })

    return trendRows
  }

  const trendRows = shortMonthNames.map((label, index) => ({
    color: '#2563eb',
    key: `${selectedYear}-${String(index + 1).padStart(2, '0')}`,
    label,
    totalQty: 0,
  }))

  rows.forEach((row) => {
    const date = dayjs(row.createdAt)

    if (date.year() === selectedYear) {
      trendRows[date.month()].totalQty += row.quantity
    }
  })

  return trendRows
}

function isRowInPeriod(row, reportPeriod, selectedYear) {
  const date = dayjs(row.createdAt)

  if (reportPeriod === 'daily') {
    const startDate = dayjs().subtract(6, 'day').startOf('day')
    const endDate = dayjs().endOf('day')

    return date.isAfter(startDate.subtract(1, 'millisecond')) && date.isBefore(endDate.add(1, 'millisecond'))
  }

  return date.year() === selectedYear
}

function StatCard({ color, helper, icon: Icon, label, value }) {
  return (
    <Card
      elevation={0}
      sx={{
        background: `linear-gradient(135deg, ${color}22, #ffffff 86%)`,
        border: `1px solid ${color}33`,
        borderRadius: 2,
        minHeight: 86,
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1.25}>
          <Box>
            <Typography sx={{ color: '#475569', fontSize: 11, fontWeight: 800 }}>
              {label}
            </Typography>
            <Typography sx={{ color: '#0f172a', fontSize: 24, fontWeight: 900, mt: 0.5 }}>
              {value}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 11, mt: 0.25 }}>
              {helper}
            </Typography>
          </Box>
          <Box
            sx={{
              alignItems: 'center',
              bgcolor: '#ffffffcc',
              borderRadius: 2,
              color,
              display: 'flex',
              height: 34,
              justifyContent: 'center',
              width: 34,
            }}
          >
            <Icon size={18} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function DonutChart({ action, rows, subtitle, title, totalLabel = 'สินค้าที่ถูกเบิก' }) {
  const totalQty = rows.reduce((total, row) => total + row.totalQty, 0)
  let currentPercent = 0
  const gradient = totalQty
    ? rows.map((row) => {
      const percent = (row.totalQty / totalQty) * 100
      const segment = `${row.color} ${currentPercent}% ${currentPercent + percent}%`

      currentPercent += percent

      return segment
    }).join(', ')
    : '#e2e8f0 0% 100%'

  return (
    <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0, 1fr) auto auto',
            width: '100%',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#111827', fontSize: 15, fontWeight: 900 }}>
              {title}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
              {subtitle}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-end', ml: 'auto' }}>
            {action}
          </Box>
        </Box>

        <Box
          sx={{
            alignItems: 'center',
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: 'minmax(250px, 1fr) 130px',
            ml: 5,
            mt: 4,
            width: 'calc(100% - 40px)',
          }}
        >
          <Box
            sx={{
              alignItems: 'center',
              background: `conic-gradient(${gradient})`,
              borderRadius: '50%',
              display: 'flex',
              height: 250,
              justifyContent: 'center',
              flexShrink: 0,
              justifySelf: 'center',
              width: 250,
            }}
          >
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: '#ffffff',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                height: 142,
                justifyContent: 'center',
                width: 142,
              }}
            >
              <Typography sx={{ color: '#0f172a', fontSize: 24, fontWeight: 900 }}>
                {totalQty.toLocaleString('th-TH')}
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: 12 }}>
                {totalLabel}
              </Typography>
            </Box>
          </Box>

          <Stack alignItems="flex-start" gap={1.2} justifyContent="flex-start" sx={{ alignSelf: 'start', flexShrink: 0, mt: 1.5, width: 130 }}>
            {rows.slice(0, 6).map((row) => (
              <Stack key={row.label} alignItems="center" direction="row" spacing={0.75}>
                <Box sx={{ bgcolor: row.color, borderRadius: '50%', height: 8, width: 8 }} />
                <Typography sx={{ color: '#475569', fontSize: 12 }}>
                  {row.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}

function TimeTrendBarChart({ action, periodMode, rows }) {
  const chartRows = rows
  const maxQty = Math.max(...chartRows.map((row) => row.totalQty), 1)
  const title = periodMode === 'daily' ? 'แนวโน้มการเบิก 7 วันล่าสุด' : 'แนวโน้มการเบิกรายเดือน'
  const subtitle = periodMode === 'daily'
    ? 'ดูยอดเบิกแยกตามวันย้อนหลัง 7 วัน'
    : 'ดูยอดเบิกแยกตามเดือนในปีที่เลือก'

  return (
    <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            width: '100%',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#111827', fontSize: 15, fontWeight: 900 }}>
              {title}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
              {subtitle}
            </Typography>
          </Box>
          <Stack alignItems="center" direction="row" spacing={0.75} sx={{ flexShrink: 0, gridColumn: '1', gridRow: '2', justifySelf: 'start' }}>
            <Box sx={{ bgcolor: '#2563eb', borderRadius: '50%', height: 8, width: 8 }} />
            <Typography sx={{ color: '#64748b', fontSize: 12 }}>ยอดเบิก</Typography>
          </Stack>
          <Stack alignItems="center" direction="row" justifyContent="flex-end" spacing={1.25} sx={{ flexShrink: 0, gridColumn: '2', gridRow: '1', justifySelf: 'end' }}>
            {action}
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', mt: 2.5, pl: 0.5, pr: 1 }}>
          <Box
            sx={{
              alignItems: 'flex-start',
              borderRight: '3px solid #1e1b4b',
              color: '#475569',
              display: 'flex',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 800,
              height: 252,
              justifyContent: 'center',
              pr: 1,
              width: 44,
            }}
          >
            Qty
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                alignItems: 'end',
                borderBottom: '3px solid #1e1b4b',
                display: 'grid',
                gap: 1.2,
                gridTemplateColumns: `repeat(${chartRows.length}, minmax(0, 1fr))`,
                height: 252,
                px: 1.5,
              }}
            >
              {chartRows.map((row) => {
                const barHeight = row.totalQty > 0 ? Math.max((row.totalQty / maxQty) * 205, 18) : 0
                const labelBottom = barHeight + 8

                return (
                  <Box key={row.key} sx={{ height: '100%', minWidth: 0, position: 'relative' }}>
                    <Typography
                      sx={{
                        bottom: labelBottom,
                        color: '#334155',
                        fontSize: 12,
                        fontWeight: 800,
                        left: 0,
                        position: 'absolute',
                        right: 0,
                        textAlign: 'center',
                      }}
                    >
                      {row.totalQty.toLocaleString('th-TH')}
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: row.color,
                        bottom: 0,
                        height: barHeight,
                        left: '50%',
                        position: 'absolute',
                        transform: 'translateX(-50%)',
                        width: 30,
                      }}
                    />
                  </Box>
                )
              })}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: 1.2,
                gridTemplateColumns: `repeat(${chartRows.length}, minmax(0, 1fr))`,
                px: 1.5,
                pt: 1,
              }}
            >
              {chartRows.map((row) => (
                <Typography
                  key={row.key}
                  sx={{
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: 800,
                    textAlign: 'center',
                    transform: periodMode === 'monthly' ? 'rotate(-22deg)' : 'none',
                    transformOrigin: 'top center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.label}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function SupplierPurchaseBarChart({ action, rows, year }) {
  const chartRows = rows.slice(0, 8)
  const maxPurchase = Math.max(...chartRows.map((row) => Number(row.totalQty ?? 0)), 1)

  return (
    <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            width: '100%',
          }}
        >
          <Box>
            <Typography sx={{ color: '#111827', fontSize: 15, fontWeight: 900 }}>
              แนวโน้มยอดซื้อแยกตามผู้ขาย
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
              เปรียบเทียบยอดซื้อรวมจากรายการรับเข้าในปี {year}
            </Typography>
          </Box>
          <Box sx={{ justifySelf: 'end' }}>{action}</Box>
          <Stack alignItems="center" direction="row" spacing={0.75} sx={{ gridColumn: '1', gridRow: '2' }}>
            <Box sx={{ bgcolor: '#2563eb', borderRadius: '50%', height: 8, width: 8 }} />
            <Typography sx={{ color: '#64748b', fontSize: 12 }}>ยอดซื้อ (บาท)</Typography>
          </Stack>
        </Box>

        {chartRows.length ? (
          <Box sx={{ display: 'flex', mt: 2.5, pl: 0.5, pr: 1 }}>
            <Box
              sx={{
                alignItems: 'flex-start',
                borderRight: '3px solid #1e1b4b',
                color: '#475569',
                display: 'flex',
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 800,
                height: 252,
                justifyContent: 'center',
                pr: 1,
                width: 44,
              }}
            >
              บาท
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  alignItems: 'end',
                  borderBottom: '3px solid #1e1b4b',
                  display: 'grid',
                  gap: 1.2,
                  gridTemplateColumns: `repeat(${chartRows.length}, minmax(0, 1fr))`,
                  height: 252,
                  px: 1.5,
                }}
              >
                {chartRows.map((row) => {
                  const totalPurchase = Number(row.totalQty ?? 0)
                  const barHeight = totalPurchase > 0 ? Math.max((totalPurchase / maxPurchase) * 205, 18) : 0

                  return (
                    <Box key={row.key} sx={{ height: '100%', minWidth: 0, position: 'relative' }}>
                      <Typography
                        sx={{
                          bottom: barHeight + 8,
                          color: '#334155',
                          fontSize: 11,
                          fontWeight: 800,
                          left: 0,
                          position: 'absolute',
                          right: 0,
                          textAlign: 'center',
                        }}
                      >
                        {totalPurchase.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                      </Typography>
                      <Box
                        sx={{
                          bgcolor: '#2563eb',
                          bottom: 0,
                          height: barHeight,
                          left: '50%',
                          position: 'absolute',
                          transform: 'translateX(-50%)',
                          width: 30,
                        }}
                      />
                    </Box>
                  )
                })}
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1.2,
                  gridTemplateColumns: `repeat(${chartRows.length}, minmax(0, 1fr))`,
                  px: 1.5,
                  pt: 1,
                }}
              >
                {chartRows.map((row) => (
                  <Typography key={row.key} noWrap title={row.label} sx={{ color: '#475569', fontSize: 11, fontWeight: 800, textAlign: 'center' }}>
                    {row.label}
                  </Typography>
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ alignItems: 'center', color: '#64748b', display: 'flex', height: 300, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 14 }}>ยังไม่มีข้อมูลยอดซื้อในปีที่เลือก</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function ReportsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reports, setReports] = useState([])
  const [requisitions, setRequisitions] = useState([])
  const [purchaseReports, setPurchaseReports] = useState([])
  const [rankingMode, setRankingMode] = useState('department')
  const [reportMode, setReportMode] = useState('issue')
  const [reportPeriod, setReportPeriod] = useState('monthly')
  const [selectedYear, setSelectedYear] = useState(dayjs().year())

  const dateRange = useMemo(() => {
    if (reportPeriod === 'daily') {
      return {
        endDate: dayjs().format('YYYY-MM-DD'),
        startDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
      }
    }

    return {
      endDate: `${selectedYear}-12-31`,
      startDate: `${selectedYear}-01-01`,
    }
  }, [reportPeriod, selectedYear])

  useEffect(() => {
    let isMounted = true

    const loadReports = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const [issueData, requisitionData, purchaseData] = await Promise.all([
          getStockIssues(dateRange),
          getRequisitions(),
          getPurchasesBySupplier({ year: selectedYear }),
        ])

        if (isMounted) {
          setReports(issueData ?? [])
          setRequisitions(requisitionData ?? [])
          setPurchaseReports(purchaseData ?? [])
        }
      } catch {
        if (isMounted) {
          setReports([])
          setRequisitions([])
          setPurchaseReports([])
          setLoadError('โหลดข้อมูลรายงานไม่สำเร็จ กรุณาตรวจสอบว่า Backend API เปิดอยู่')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      isMounted = false
    }
  }, [dateRange, selectedYear])

  const issueRows = useMemo(() => flattenIssueRows(reports), [reports])
  const backlogRows = useMemo(() => flattenBacklogRows(requisitions), [requisitions])
  const purchaseRows = useMemo(
    () => [...purchaseReports].sort((left, right) => Number(right.totalPurchase) - Number(left.totalPurchase)),
    [purchaseReports],
  )
  const purchaseChartRows = useMemo(
    () => purchaseRows.map((row, index) => ({
      color: palette[index % palette.length],
      key: row.supplierId ?? `supplier-${index}`,
      label: row.supplierName,
      totalQty: Number(row.totalPurchase ?? 0),
    })),
    [purchaseRows],
  )
  const backlogDepartmentRows = useMemo(() => buildBacklogDepartmentRows(backlogRows), [backlogRows])

  const periodRows = useMemo(
    () => issueRows.filter((row) => isRowInPeriod(row, reportPeriod, selectedYear)),
    [issueRows, reportPeriod, selectedYear],
  )

  const filteredRows = periodRows

  const reportRows = useMemo(
    () => summarizeByDayDepartmentProduct(filteredRows),
    [filteredRows],
  )

  const trendRows = useMemo(
    () => buildTimeTrendRows(filteredRows, reportPeriod, selectedYear),
    [filteredRows, reportPeriod, selectedYear],
  )

  const departmentRows = useMemo(
    () => buildDepartmentRows(filteredRows),
    [filteredRows],
  )

  const productRows = useMemo(
    () => buildProductRows(filteredRows),
    [filteredRows],
  )

  const rankingRows = rankingMode === 'product' ? productRows : departmentRows
  const topRanking = rankingRows[0]
  const rankingTitle = rankingMode === 'product' ? 'สินค้าที่ถูกเบิกเยอะสุด' : 'แผนกที่เบิกเยอะสุด'
  const rankingSubtitle = rankingMode === 'product'
    ? 'จำนวนสินค้าที่ถูกเบิก แยกตามสินค้า'
    : 'จำนวนสินค้าที่ถูกเบิก แยกตามแผนก'
  const periodLabel = reportPeriod === 'daily' ? '7 วันล่าสุด' : `ปี ${selectedYear}`

  const totalQty = filteredRows.reduce((total, row) => total + row.quantity, 0)
  const totalDocuments = new Set(filteredRows.map((row) => row.documentNo)).size
  const totalProducts = new Set(filteredRows.map((row) => row.productCode)).size
  const summaryItems = [
    {
      color: '#60a5fa',
      helper: periodLabel,
      icon: ShoppingCart,
      label: 'จำนวนสินค้าที่ถูกเบิก',
      value: totalQty.toLocaleString('th-TH'),
    },
    {
      color: '#a78bfa',
      helper: 'จำนวนเอกสารใบเบิก',
      icon: FileText,
      label: 'จำนวนใบเบิก',
      value: totalDocuments.toLocaleString('th-TH'),
    },
    {
      color: '#fbbf24',
      helper: 'จำนวนรหัสสินค้าที่ถูกเบิก',
      icon: Package,
      label: 'จำนวนรายการสินค้า',
      value: totalProducts.toLocaleString('th-TH'),
    },
    {
      color: '#fb7185',
      helper: topRanking ? `จำนวน ${topRanking.totalQty.toLocaleString('th-TH')}` : 'ยังไม่มีข้อมูล',
      icon: rankingMode === 'product' ? Package : Building2,
      label: rankingMode === 'product' ? 'สินค้าอันดับ 1' : 'แผนกอันดับ 1',
      value: topRanking?.label || '-',
    },
  ]

  const backlogDocumentCount = new Set(backlogRows.map((row) => row.requestNo)).size
  const backlogProductCount = new Set(backlogRows.map((row) => row.productCode)).size
  const backlogTotalQty = backlogRows.reduce((total, row) => total + row.backlogQty, 0)
  const oldestBacklogDays = backlogRows.reduce((maxDays, row) => Math.max(maxDays, row.backlogDays), 0)
  const topBacklogDepartment = backlogDepartmentRows[0]
  const backlogSummaryItems = [
    {
      color: '#60a5fa',
      helper: 'ใบขอเบิกที่ยังจ่ายไม่ครบ',
      icon: FileText,
      label: 'จำนวนใบค้าง',
      value: backlogDocumentCount.toLocaleString('th-TH'),
    },
    {
      color: '#f97316',
      helper: 'จำนวนสินค้าที่ยังต้องตามของ',
      icon: AlertTriangle,
      label: 'จำนวนค้างรวม',
      value: backlogTotalQty.toLocaleString('th-TH'),
    },
    {
      color: '#fbbf24',
      helper: 'จำนวนรหัสสินค้าที่มีค้าง',
      icon: Package,
      label: 'สินค้าที่ค้าง',
      value: backlogProductCount.toLocaleString('th-TH'),
    },
    {
      color: '#fb7185',
      helper: topBacklogDepartment ? `แผนก ${topBacklogDepartment.department}` : 'ยังไม่มีข้อมูล',
      icon: Clock,
      label: 'ค้างนานสุด',
      value: `${oldestBacklogDays.toLocaleString('th-TH')} วัน`,
    },
  ]

  const totalPurchase = purchaseRows.reduce((total, row) => total + Number(row.totalPurchase ?? 0), 0)
  const purchaseDocumentCount = purchaseRows.reduce((total, row) => total + Number(row.documentCount ?? 0), 0)
  const purchaseItemCount = purchaseRows.reduce((total, row) => total + Number(row.itemCount ?? 0), 0)
  const purchaseQty = purchaseRows.reduce((total, row) => total + Number(row.totalQty ?? 0), 0)
  const topSupplier = purchaseRows[0]
  const purchaseSummaryItems = [
    { color: '#60a5fa', helper: `ปี ${selectedYear}`, icon: Building2, label: 'จำนวนผู้ขาย', value: purchaseRows.length.toLocaleString('th-TH') },
    { color: '#a78bfa', helper: 'เอกสารรับเข้าที่บันทึกแล้ว', icon: FileText, label: 'จำนวนเอกสารรับเข้า', value: purchaseDocumentCount.toLocaleString('th-TH') },
    { color: '#fbbf24', helper: `จำนวนรับเข้ารวม ${purchaseQty.toLocaleString('th-TH')} หน่วย`, icon: Package, label: 'จำนวนรายการสินค้า', value: purchaseItemCount.toLocaleString('th-TH') },
    { color: '#fb7185', helper: topSupplier ? `สูงสุด: ${topSupplier.supplierName}` : 'ยังไม่มีข้อมูล', icon: ShoppingCart, label: 'ยอดซื้อรวม', value: `${totalPurchase.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท` },
  ]

  const handleExport = () => {
    if (reportMode === 'backlog') {
      exportRowsToExcel(
        backlogRows,
        backlogExportColumns,
        `backlog-report-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
      )
      return
    }

    if (reportMode === 'purchase') {
      exportRowsToExcel(purchaseRows, purchaseExportColumns, `purchase-by-supplier-${selectedYear}-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`)
      return
    }

    exportRowsToExcel(
      reportRows,
      exportColumns,
      `issue-report-${reportPeriod}-${selectedYear}-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
    )
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        alignItems="flex-start"
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ width: '100%' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 900 }}>
            รายงาน
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
            ภาพรวมการเบิกสินค้า แยกตามแผนก สินค้า รายวัน และรายเดือน
          </Typography>
        </Box>

        <Stack
          alignItems="center"
          direction="row"
          justifyContent="flex-end"
          spacing={1.25}
          sx={{ flexShrink: 0, ml: { xs: 0, md: 'auto' }, width: { xs: '100%', md: 'auto' } }}
        >
          <TextField
            select
            label="ประเภทรายงาน"
            size="small"
            value={reportMode}
            onChange={(event) => setReportMode(event.target.value)}
            sx={{ minWidth: 170 }}
          >
            {reportModes.map((mode) => (
              <MenuItem key={mode.value} value={mode.value}>
                {mode.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            startIcon={<Download size={16} />}
            sx={{
              fontSize: 13,
              fontWeight: 800,
              height: 40,
              minWidth: 132,
              px: 1.5,
            }}
            variant="outlined"
            onClick={handleExport}
          >
            ส่งออก Excel
          </Button>
        </Stack>
      </Stack>

      {loadError ? <Alert severity="warning">{loadError}</Alert> : null}

      {reportMode === 'issue' ? (
        <>
          <Grid container spacing={2}>
            {summaryItems.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <DonutChart
                action={(
                  <TextField
                    select
                    label="มุมมอง"
                    size="small"
                    value={rankingMode}
                    onChange={(event) => setRankingMode(event.target.value)}
                    sx={{ width: 170 }}
                  >
                    {rankingModes.map((mode) => (
                      <MenuItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                rows={rankingRows}
                subtitle={rankingSubtitle}
                title={rankingTitle}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <TimeTrendBarChart
                action={(
                  <Stack direction="row" spacing={1}>
                    <TextField
                      select
                      label="ช่วง"
                      size="small"
                      value={reportPeriod}
                      onChange={(event) => setReportPeriod(event.target.value)}
                      sx={{ width: 125 }}
                    >
                      {periodModes.map((mode) => (
                        <MenuItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      disabled={reportPeriod === 'daily'}
                      select
                      label="ปี"
                      size="small"
                      value={selectedYear}
                      onChange={(event) => setSelectedYear(Number(event.target.value))}
                      sx={{ width: 105 }}
                    >
                      {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                )}
                periodMode={reportPeriod}
                rows={trendRows}
              />
            </Grid>
          </Grid>

          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                  ตารางสรุปรายวัน / แผนก / สินค้า / จำนวนสินค้าที่ถูกเบิก / จำนวนใบเบิก
                </Typography>
                <AppTable
                  columns={reportColumns}
                  defaultSortField="dateName"
                  defaultSortDirection="desc"
                  isLoading={isLoading}
                  maxHeight={520}
                  noDataText="ไม่พบข้อมูลการเบิกในช่วงที่เลือก"
                  rowKey={(row) => `${row.date}-${row.department}-${row.productCode}`}
                  rows={reportRows}
                  showGlobalSearch
                />
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : reportMode === 'purchase' ? (
        <>
          <Grid container spacing={2}>
            {purchaseSummaryItems.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <DonutChart
                rows={purchaseChartRows}
                subtitle={`สัดส่วนยอดซื้อจากรายการรับเข้าในปี ${selectedYear}`}
                title="สัดส่วนยอดซื้อแต่ละผู้ขาย"
                totalLabel="ยอดซื้อรวม (บาท)"
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <SupplierPurchaseBarChart
                rows={purchaseChartRows}
                year={selectedYear}
                action={(
                  <TextField select label="ปี" size="small" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} sx={{ width: 110 }}>
                    {[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((year) => (
                      <MenuItem key={year} value={year}>{year}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
          </Grid>

          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                      ยอดซื้อแยกตามผู้ขาย
                    </Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.25 }}>
                      รวมจากรายการรับเข้าที่บันทึกต้นทุนจริงในปี {selectedYear}
                    </Typography>
                  </Box>
                </Stack>
                <AppTable
                  columns={purchaseColumns}
                  defaultSortField="totalPurchase"
                  defaultSortDirection="desc"
                  isLoading={isLoading}
                  maxHeight={560}
                  noDataText="ไม่พบรายการรับเข้าของปีที่เลือก"
                  rowKey={(row) => row.supplierId ?? 'unspecified-supplier'}
                  rows={purchaseRows}
                  showGlobalSearch
                />
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Grid container spacing={2}>
            {backlogSummaryItems.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Card elevation={0} sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Typography sx={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>
                  รายละเอียดงานค้าง
                </Typography>
                <AppTable
                  columns={backlogColumns}
                  defaultSortField="requestDateName"
                  defaultSortDirection="desc"
                  isLoading={isLoading}
                  maxHeight={560}
                  noDataText="ไม่มีงานค้าง"
                  rowKey={(row) => `${row.requestNo}-${row.detailId}`}
                  rows={backlogRows}
                  showGlobalSearch
                />
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  )
}

export default ReportsPage

