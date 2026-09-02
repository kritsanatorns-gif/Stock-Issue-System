const thaiCharacterPattern = /[\u0E00-\u0E7F]/g
const barcodeCharacterPattern = /[^A-Za-z0-9._/-]/g
const plainNameCharacterPattern = /[^A-Za-z0-9\u0E00-\u0E7F\s.,_/#()+"'-]/g

// Keep spaces inside a value (for example a person's full name), but never save
// accidental whitespace at the beginning or end.
export function trimOuterWhitespace(value) {
  return typeof value === 'string' ? value.trim() : value
}

export function trimPayloadOuterWhitespace(value) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value.map(trimPayloadOuterWhitespace)
  }

  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Blob) && !(value instanceof FormData)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, trimPayloadOuterWhitespace(item)]),
    )
  }

  return value
}

export function removeThaiCharacters(value) {
  return String(value ?? '').replace(thaiCharacterPattern, '')
}

export function normalizeBarcodeInput(value) {
  return removeThaiCharacters(value).replace(barcodeCharacterPattern, '').toUpperCase()
}

export function normalizeEmployeeId(value) {
  return removeThaiCharacters(value).replace(/\s/g, '')
}

export function normalizeEmployeeNumericId(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizeEmployeeName(value) {
  return String(value ?? '').replace(/[^A-Za-z\u0E00-\u0E7F\s]/g, '')
}

export function normalizeUsernameInput(value) {
  return removeThaiCharacters(value).replace(/\s/g, '')
}

export function normalizePlainName(value) {
  return String(value ?? '').replace(plainNameCharacterPattern, '')
}

export function normalizeWholeNumberInput(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizeDecimalNumberInput(value) {
  const cleanedValue = String(value ?? '').replace(/[^\d.]/g, '')
  const [firstPart, ...otherParts] = cleanedValue.split('.')

  return otherParts.length ? `${firstPart}.${otherParts.join('')}` : firstPart
}
