// Small shared helpers used across pages

export function formatMoney(amount, currency = 'USD') {
  const n = Number(amount || 0)
  if (currency === 'KHR') {
    return `${Math.round(n).toLocaleString()} ៛`
  }
  return `$${n.toFixed(2)}`
}

export function generateBarcode(productName, size, color) {
  const clean = (s) => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
  const stamp = Date.now().toString().slice(-5)
  return `${clean(productName) || 'ITM'}-${clean(size) || 'X'}-${clean(color) || 'X'}-${stamp}`
}

export function dayKey(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10)
}

export function weekKey(dateStr) {
  const d = new Date(dateStr)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

export function monthKey(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 7)
}

export function trueCostPerItem(unitCost, deliveryFee, quantity) {
  const q = Number(quantity) || 1
  return Number(unitCost || 0) + (Number(deliveryFee || 0) / q)
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  const then = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - then) / 86400000)
}

export function timeOfDayBucket(dateTimeStr) {
  const hour = new Date(dateTimeStr).getHours()
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export function isSimilarCategoryName(name, existingNames) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const target = norm(name)
  return existingNames.find((n) => norm(n) === target)
}

export function suggestUniqueBarcode(base, existingBarcodes) {
  let candidate = base
  let i = 1
  while (existingBarcodes.includes(candidate)) {
    candidate = `${base}-${i}`
    i++
  }
  return candidate
}

// Resizes/compresses an image client-side before upload, so photo lists
// stay fast even with lots of products. Caps width at 800px, JPEG quality 0.75.
export function compressImage(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Compression failed')); return }
            resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Ad spend entries cover a date range (e.g. a Facebook billing cycle).
// To fairly attribute cost to "today" or any custom range, spread each
// entry's amount evenly across its own days, then sum whatever portion
// overlaps with the range being viewed.
export function prorateAdSpend(entries, rangeStart, rangeEnd) {
  const rStart = new Date(rangeStart)
  const rEnd = new Date(rangeEnd)
  let total = 0
  entries.forEach(e => {
    const eStart = new Date(e.start_date)
    const eEnd = new Date(e.end_date)
    const totalDays = Math.round((eEnd - eStart) / 86400000) + 1
    if (totalDays <= 0) return
    const dailyRate = Number(e.amount) / totalDays
    const overlapStart = eStart > rStart ? eStart : rStart
    const overlapEnd = eEnd < rEnd ? eEnd : rEnd
    const overlapDays = Math.round((overlapEnd - overlapStart) / 86400000) + 1
    if (overlapDays > 0) total += dailyRate * overlapDays
  })
  return total
}
