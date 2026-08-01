export function formatMoney(amount, currency = 'USD') {
  const n = Number(amount) || 0
  if (currency === 'KHR') {
    return `៛${Math.round(n).toLocaleString('en-US')}`
  }
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Generates a reasonably unique numeric barcode (EAN-ish, 12 digits).
export function generateBarcode() {
  const timePart = Date.now().toString().slice(-8)
  const randPart = Math.floor(1000 + Math.random() * 9000).toString()
  return `${timePart}${randPart}`
}

export function generateOrderNumber() {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(100 + Math.random() * 900)
  return `ORD-${y}${m}${d}-${rand}`
}

export function variantLabel(variant) {
  const parts = [variant?.size, variant?.color].filter(Boolean)
  return parts.length ? parts.join(' / ') : '—'
}

export function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfWeek(d = new Date()) {
  const x = startOfDay(d)
  const day = x.getDay() // 0 = Sunday
  x.setDate(x.getDate() - day)
  return x
}

export function startOfMonth(d = new Date()) {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}
