import Papa from 'papaparse'

export const REQUIRED_COLUMNS = ['date', 'symbol', 'side', 'entry', 'exit', 'stop', 'size']
export const OPTIONAL_COLUMNS = ['exit_date', 'fees']
export const MAX_FILE_BYTES = 5 * 1024 * 1024

// YYYY-MM-DD, optionally followed by a time and a timezone offset.
const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

function parseDate(raw) {
  if (!ISO_DATETIME.test(raw)) return null
  const date = new Date(raw.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function parseNumber(raw) {
  if (raw === undefined || raw === null) return NaN
  const cleaned = String(raw).trim().replace(/[$,]/g, '')
  if (cleaned === '') return NaN
  return Number(cleaned)
}

/**
 * Validate one CSV row (keys already lower-cased).
 * Returns { trade } on success or { errors: string[] } on failure.
 */
export function validateRow(row) {
  const errors = []
  const get = (key) => (row[key] ?? '').toString().trim()

  const dateRaw = get('date')
  const date = parseDate(dateRaw)
  if (!dateRaw) errors.push('date is missing')
  else if (!date) errors.push(`date "${dateRaw}" is not an ISO datetime (e.g. 2026-07-06T09:38:00)`)

  // Optional close time; when absent, downstream code falls back to the entry date.
  const exitDateRaw = get('exit_date')
  let exitDate = null
  if (exitDateRaw) {
    exitDate = parseDate(exitDateRaw)
    if (!exitDate) errors.push(`exit_date "${exitDateRaw}" is not an ISO datetime (e.g. 2026-07-06T10:05:00)`)
    else if (date && exitDate < date) errors.push(`exit_date ${exitDateRaw} is before date ${dateRaw}`)
  }

  const symbol = get('symbol').toUpperCase()
  if (!symbol) errors.push('symbol is missing')

  const side = get('side').toLowerCase()
  if (side !== 'long' && side !== 'short')
    errors.push(`side "${get('side')}" must be "long" or "short"`)

  const nums = {}
  for (const key of ['entry', 'exit', 'stop', 'size']) {
    const value = parseNumber(row[key])
    if (!get(key)) errors.push(`${key} is missing`)
    else if (!Number.isFinite(value) || value <= 0)
      errors.push(`${key} "${get(key)}" must be a positive number`)
    nums[key] = value
  }

  let fees = 0
  if (get('fees')) {
    fees = parseNumber(row.fees)
    if (!Number.isFinite(fees) || fees < 0)
      errors.push(`fees "${get('fees')}" must be zero or a positive number`)
  }

  // Stop must sit on the losing side of entry, otherwise R is undefined or inverted.
  if (Number.isFinite(nums.entry) && Number.isFinite(nums.stop) && (side === 'long' || side === 'short')) {
    if (nums.stop === nums.entry) errors.push('stop equals entry (risk would be zero)')
    else if (side === 'long' && nums.stop > nums.entry)
      errors.push(`stop ${nums.stop} is above entry ${nums.entry} for a long`)
    else if (side === 'short' && nums.stop < nums.entry)
      errors.push(`stop ${nums.stop} is below entry ${nums.entry} for a short`)
  }

  if (errors.length) return { errors }
  return {
    trade: {
      date,
      exitDate,
      symbol,
      side,
      entry: nums.entry,
      exit: nums.exit,
      stop: nums.stop,
      size: nums.size,
      fees,
    },
  }
}

/**
 * Parse and validate CSV text.
 * Returns { trades, rowErrors, fatalError }:
 * - trades: valid trades sorted by date, each with a stable id and its source line
 * - rowErrors: [{ line, messages }] for rows that were skipped
 * - fatalError: string when the file can't be used at all (e.g. missing columns)
 */
export function parseTradesCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: false, // keep indices aligned with file line numbers
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  const fields = (result.meta.fields ?? []).filter(Boolean)
  const missing = REQUIRED_COLUMNS.filter((c) => !fields.includes(c))
  if (missing.length) {
    return {
      trades: [],
      rowErrors: [],
      fatalError: fields.length
        ? `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Expected: ${[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(', ')}.`
        : 'The file is empty or has no header row.',
    }
  }

  const trades = []
  const rowErrors = []
  result.data.forEach((row, index) => {
    const line = index + 2 // +1 for the header, +1 for 1-based line numbers
    const values = Object.values(row).flat()
    if (values.every((v) => v === undefined || String(v).trim() === '')) return

    const { trade, errors } = validateRow(row)
    if (errors) rowErrors.push({ line, messages: errors })
    else trades.push({ ...trade, id: `L${line}`, line })
  })

  trades.sort((a, b) => a.date - b.date || a.line - b.line)

  const fatalError =
    trades.length === 0
      ? rowErrors.length
        ? 'No valid trades found — every row has errors (see below).'
        : 'The file has a header but no trades.'
      : null

  return { trades, rowErrors, fatalError }
}
