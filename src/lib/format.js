const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const MINUS = '−' // typographic minus, same width as +

export const money = (v) => (v == null ? '—' : usd.format(v).replace('-', MINUS))

/** Signed currency: +$12.30 / −$4.00 / $0.00 */
export function signedMoney(v) {
  if (v == null) return '—'
  if (v === 0) return usd.format(0)
  return (v > 0 ? '+' : MINUS) + usd.format(Math.abs(v))
}

/** Axis ticks: $0, $500, $1.2K */
export function axisMoney(v) {
  const abs = Math.abs(v)
  const s = abs >= 1000 ? usdCompact.format(abs) : usdWhole.format(abs)
  return v < 0 ? MINUS + s : s
}

export const pct = (v, digits = 0) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`)

/** Signed percentage change: +17% / −8% */
export function signedPct(v) {
  if (v == null) return '—'
  const s = `${Math.abs(v * 100).toFixed(0)}%`
  return v > 0 ? `+${s}` : v < 0 ? MINUS + s : s
}

/** R-multiple: +1.25R / −0.50R */
export function rFmt(v, digits = 2) {
  if (v == null) return '—'
  const s = `${Math.abs(v).toFixed(digits)}R`
  return v > 0 ? `+${s}` : v < 0 ? MINUS + s : s
}

export function ratio(v) {
  if (v == null) return '—'
  if (v === Infinity) return '∞'
  return v.toFixed(2)
}

/** Minus sign for plain numbers in labels. */
export const num = (v, digits = 1) => v.toFixed(digits).replace('-', MINUS)

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const dateOnly = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const fmtDateTime = (d) => dateTime.format(d)
export const fmtDate = (d) => dateOnly.format(d)

/** Tailwind text class for a signed value (delta convention: up is good). */
export const signClass = (v) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-zinc-300')
