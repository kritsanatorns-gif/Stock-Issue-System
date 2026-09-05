import { InputAdornment, TextField } from '@mui/material'
import { CalendarDays } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

function formatDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

function parseDate(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, dayText, monthText, year] = match
  const day = Number(dayText)
  const month = Number(monthText)
  const date = new Date(Number(year), month - 1, day)
  if (date.getFullYear() !== Number(year) || date.getMonth() !== month - 1 || date.getDate() !== day) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function DateInputField({ disabled = false, helperText, label, onChange, value, ...props }) {
  const nativeInputRef = useRef(null)
  const [displayValue, setDisplayValue] = useState(() => formatDate(value))

  useEffect(() => {
    setDisplayValue(formatDate(value))
  }, [value])

  const commitDisplayValue = () => {
    if (!displayValue.trim()) {
      onChange('')
      return
    }

    const nextValue = parseDate(displayValue)
    if (nextValue) {
      onChange(nextValue)
      return
    }

    setDisplayValue(formatDate(value))
  }

  const openPicker = () => {
    if (disabled) return
    const input = nativeInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.focus()
  }

  return (
    <>
      <TextField
        {...props}
        disabled={disabled}
        fullWidth={props.fullWidth ?? true}
        helperText={helperText}
        label={label}
        placeholder="วว/ดด/ปปปป"
        value={displayValue}
        onBlur={commitDisplayValue}
        onClick={openPicker}
        onChange={(event) => setDisplayValue(event.target.value.replace(/[^\d/]/g, ''))}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <CalendarDays aria-label="เลือกวันที่" cursor="pointer" size={18} onClick={openPicker} />
              </InputAdornment>
            ),
          },
        }}
      />
      <input
        ref={nativeInputRef}
        aria-hidden="true"
        tabIndex={-1}
        type="date"
        disabled={disabled}
        min={props.min}
        max={props.max}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        style={{ height: 1, opacity: 0, pointerEvents: 'none', position: 'fixed', width: 1 }}
      />
    </>
  )
}

export default DateInputField
