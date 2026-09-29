const statuses = [
  { label: 'พร้อมเบิก', color: '#15803d' },
  { label: 'ใกล้หมด', color: '#f97316' },
  { label: 'หมด', color: '#dc2626' },
]
export default function StockStatusChart({ rows, trendRows = [], selectedStatus = '', onSelectStatus, showSummary = false }) {
  const statusRows = statuses.map(({ label, color }) => ({ status: label, color, total: rows.filter((row) => row.status === label).length }))
  // Keep all twelve months on the axis. Months before the first product exists
  // contain zero counts, so their column remains intentionally blank.
  const visibleTrendRows = trendRows
  const trendMaximum = Math.max(1, ...visibleTrendRows.flatMap((row) => [Number(row.available ?? 0), Number(row.low ?? 0), Number(row.outOfStock ?? 0)]))
  const number = (value) => value.toLocaleString('th-TH')
  let progress = 0
  const donutGradient = rows.length ? statusRows.map((row) => {
    const next = progress + row.total / rows.length * 100
    const segment = `${row.color} ${progress}% ${next}%`
    progress = next
    return segment
  }).join(', ') : '#e2e8f0 0% 100%'
  return (
    <div className={`stock-category-charts${showSummary ? ' stock-category-charts--print' : ''}`}>
      <style>{`
        .stock-category-charts { display:grid; grid-template-columns:minmax(250px, 0.42fr) minmax(0, 1.58fr); gap:12px; color:#0f172a; }
        .stock-category-charts > section { min-width:0; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; }
        .stock-category-charts button:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
        @media(max-width:900px) { .stock-category-charts:not(.stock-category-charts--print) { grid-template-columns:1fr; } }
      `}</style>
    <section>
      <h2 style={{ fontSize: 16, margin: '0 0 6px', fontWeight: 800 }}>สัดส่วนสถานะสินค้าทั้งหมด</h2>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>จำนวนรายการสินค้า ณ ปัจจุบัน</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 42 }}>
        <div style={{ width: 190, height: 190, borderRadius: '50%', background: `conic-gradient(${donutGradient})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 116, height: 116, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}><strong style={{ fontSize: 29 }}>{number(rows.length)}</strong><span style={{ fontSize: 11, color: '#64748b' }}>รายการทั้งหมด</span></div>
        </div>
        <div style={{ fontSize: 12 }}>
          {statusRows.map((row) => <button key={row.status} type="button" onClick={() => onSelectStatus?.(selectedStatus === row.status ? '' : row.status)} style={{ display: 'block', border: 0, background: 'transparent', padding: '4px 0', textAlign: 'left', font: 'inherit', color: selectedStatus && selectedStatus !== row.status ? '#94a3b8' : '#0f172a', cursor: onSelectStatus ? 'pointer' : 'default' }}><span style={{ display: 'inline-block', background: row.color, width: 8, height: 8, borderRadius: '50%', marginRight: 7 }} />{row.status}<br /><strong style={{ marginLeft: 15 }}>{number(row.total)} รายการ</strong></button>)}
        </div>
      </div>
    </section>
    <section>
      <h2 style={{ fontSize: 16, margin: '0 0 6px', fontWeight: 800 }}>แนวโน้มสถานะสินค้าคงเหลือรายเดือน</h2>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>ยอดสินค้าทั้งหมดของแต่ละเดือน แยกตามสถานะ{onSelectStatus ? ' • กดสีในคำอธิบายเพื่อกรองตาราง' : ''}</p>
      {showSummary && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13 }}>
          <strong>ทั้งหมด {number(rows.length)} รายการ</strong>
          {statuses.map(({ label, color }) => <span key={label} style={{ color }}>{label} {number(rows.filter((row) => row.status === label).length)} รายการ</span>)}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 18, fontSize: 12 }}>
        {statuses.map(({ label, color }) => <button key={label} type="button" onClick={() => onSelectStatus?.(selectedStatus === label ? '' : label)} style={{ border: 0, background: 'transparent', color: selectedStatus && selectedStatus !== label ? '#94a3b8' : '#0f172a', cursor: onSelectStatus ? 'pointer' : 'default', font: 'inherit', padding: 0 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: color, marginRight: 6 }} />{label}</button>)}
      </div>
      {!visibleTrendRows.length && <p style={{ fontSize: 13, color: '#64748b' }}>ไม่พบข้อมูลแนวโน้มสินค้า</p>}
      <div style={{ overflowX: showSummary ? 'visible' : 'auto', paddingTop: 26 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(visibleTrendRows.length, 1)}, minmax(0, 1fr))`, gap: 8, minWidth: showSummary ? 0 : visibleTrendRows.length * 85, background: 'repeating-linear-gradient(to top, transparent 0px, transparent 54px, #e2e8f0 55px, transparent 56px)', backgroundSize: '100% 220px', backgroundRepeat: 'no-repeat' }}>
      {visibleTrendRows.map((month) => {
        const label = new Date(month.periodStart).toLocaleDateString('th-TH', { month: 'short' })
        const counts = [{ status: 'พร้อมเบิก', color: '#15803d', total: Number(month.available ?? 0) }, { status: 'ใกล้หมด', color: '#f97316', total: Number(month.low ?? 0) }, { status: 'หมด', color: '#dc2626', total: Number(month.outOfStock ?? 0) }]
        const total = counts.reduce((sum, group) => sum + group.total, 0)
        return (
          <div key={month.periodStart} style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, padding: 0, textAlign: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 220, width: '100%', borderBottom: '1px solid #94a3b8', position: 'relative' }}>
              {total > 0 && <strong style={{ position: 'absolute', top: 2, fontSize: 11, color: '#0f172a' }}>{number(total)} รายการ</strong>}
              <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, width: '90%', height: 'calc(100% - 42px)', alignSelf: 'flex-end' }}>{counts.map((group) => <button key={group.status} type="button" onClick={() => onSelectStatus?.(selectedStatus === group.status ? '' : group.status)} title={`${label} ${group.status}: ${number(group.total)} รายการ`} style={{ alignSelf: 'flex-end', height: `${group.total / trendMaximum * 100}%`, minHeight: group.total ? 3 : 0, width: '28%', border: 0, borderRadius: '4px 4px 0 0', background: group.color, cursor: onSelectStatus ? 'pointer' : 'default', opacity: selectedStatus && selectedStatus !== group.status ? 0.3 : 1, position: 'relative' }}>{group.total > 0 && <strong style={{ position: 'absolute', top: -19, left: 0, right: 0, color: '#0f172a', fontSize: 10 }}>{number(group.total)}</strong>}</button>)}</span>
            </span>
            <span style={{ fontSize: 11, width: '100%', paddingTop: 10 }}>{label}</span>
          </div>
        )
      })}
      </div>
      </div>
      {visibleTrendRows.length > 0 && <p style={{ textAlign: 'center', color: '#64748b', fontSize: 11 }}>จำนวนรายการสินค้า ณ สิ้นเดือน • ความสูงสูงสุด {number(trendMaximum)} รายการ</p>}
    </section>
    </div>
  )
}
