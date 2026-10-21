import { apiOrigin, useServerApi } from './apiConfig'

// รูปบน IIS อ่านผ่าน Virtual Directory ส่วนเครื่องพัฒนาอ่านผ่าน API
export function getProductImageUrl(imageName) {
  const value = String(imageName ?? '').trim()
  if (!value) return ''
  const base = import.meta.env.VITE_PRODUCT_IMAGE_BASE_URL
    || `${apiOrigin}${useServerApi ? '/StockIssueSystemimg' : '/uploads/products'}`
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    if (!/\/(uploads\/products|StockIssueSystemimg)\//i.test(url.pathname)) return value
  }
  const pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value
  const filename = pathname.split('/').pop()
  if (!/\.(jpg|jpeg|png|webp)$/i.test(filename)) return ''
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(decodeURIComponent(filename))}`
}
