import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const THAILAND_TIMEZONE = 'Asia/Bangkok'

function hasExplicitTimeZone(value) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(value ?? '').trim())
}

export function toThailandDate(value) {
  if (!value) {
    return null
  }

  // Transaction timestamps are persisted by SQL Server without a timezone.
  // The client submits them as UTC, so values returned without an offset must
  // be restored from UTC before displaying them in Bangkok time.
  const date = value instanceof Date
    ? dayjs(value).tz(THAILAND_TIMEZONE)
    : hasExplicitTimeZone(value)
      ? dayjs.utc(value).tz(THAILAND_TIMEZONE)
      : dayjs.utc(value).tz(THAILAND_TIMEZONE)

  return date.isValid() ? date : null
}

export function getDateSortValue(value) {
  const date = toThailandDate(value)

  return date ? date.valueOf() : 0
}

export function getIdSortValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') {
      continue
    }

    const directNumber = Number(value)

    if (Number.isFinite(directNumber)) {
      return directNumber
    }

    const match = String(value).match(/(\d+)(?!.*\d)/)

    if (match) {
      return Number(match[1])
    }
  }

  return 0
}

export function formatDisplayDate(value) {
  const date = toThailandDate(value)

  if (!date) {
    return '-'
  }

  return date.format('DD/MM/YYYY')
}

export function formatDisplayDateTime(value) {
  const date = toThailandDate(value)

  if (!date) {
    return '-'
  }

  return date.format('DD/MM/YYYY HH:mm')
}

export function getElapsedDuration(value, now = dayjs().tz(THAILAND_TIMEZONE)) {
  const startedAt = toThailandDate(value)

  if (!startedAt) {
    return { days: 0, hours: 0, label: '-' }
  }

  const totalMinutes = Math.max(0, now.diff(startedAt, 'minute'))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  let label = 'เพิ่งส่งคำขอ'

  if (days > 0) {
    label = `${days} วัน${hours > 0 ? ` ${hours} ชม.` : ''}`
  } else if (hours > 0) {
    label = `${hours} ชม.`
  } else if (minutes > 0) {
    label = `${minutes} นาที`
  }

  return { days, hours, label }
}

export function getThailandDateParts(value) {
  const date = toThailandDate(value) ?? dayjs()

  return {
    day: date.format('DD'),
    month: date.format('MM'),
    year: String(date.year() + 543),
    time: date.format('HH:mm'),
  }
}
