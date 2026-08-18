import { TextField } from '@mui/material'
import { useId } from 'react'

function BufferedTextField({
  autoComplete = 'new-password',
  InputProps,
  inputProps,
  name,
  slotProps,
  ...props
}) {
  const fieldId = useId().replaceAll(':', '')
  const htmlInputFocus = slotProps?.htmlInput?.onFocus
  const inputPropsFocus = inputProps?.onFocus
  const uniqueName = `${name ?? 'stock-field'}-${fieldId}`
  const htmlInputProps = {
    autoComplete,
    autoCapitalize: 'none',
    autoCorrect: 'off',
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
    'data-form-type': 'other',
    readOnly: true,
    spellCheck: false,
    ...inputProps,
    ...slotProps?.htmlInput,
    onFocus: (event) => {
      const input = event.currentTarget

      window.setTimeout(() => {
        input.removeAttribute('readonly')
      }, 120)

      inputPropsFocus?.(event)
      htmlInputFocus?.(event)
    },
  }

  return (
    <TextField
      {...props}
      autoComplete={autoComplete}
      name={uniqueName}
      slotProps={{
        ...slotProps,
        input: {
          ...InputProps,
          ...slotProps?.input,
        },
        htmlInput: htmlInputProps,
      }}
    />
  )
}

export default BufferedTextField
