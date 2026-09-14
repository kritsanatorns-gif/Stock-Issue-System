import { Autocomplete, TextField } from '@mui/material'

export default function SearchableSelect({
  disabled = false,
  getOptionLabel = (option) => option?.label ?? '',
  label,
  onChange,
  options = [],
  placeholder = 'ค้นหา / เลือกข้อมูล',
  value,
  ...props
}) {
  const selectedOption = options.find((option) => String(option.value ?? option.id) === String(value ?? '')) ?? null

  return (
    <Autocomplete
      disabled={disabled}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, selected) => String(option.value ?? option.id) === String(selected?.value ?? selected?.id)}
      options={options}
      value={selectedOption}
      onChange={(_, option) => onChange?.(option?.value ?? option?.id ?? '')}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
      {...props}
    />
  )
}
