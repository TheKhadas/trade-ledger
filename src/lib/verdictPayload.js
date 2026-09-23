// The AI verdict only ever sees this compact summary of computed metrics, never raw
// trades or CSV text. The client builds it; the server re-validates it field by field
// (sanitizeVerdictPayload) so a hand-crafted request can't smuggle free text into the prompt.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_REVENGE_ITEMS = 10

const round = (v, digits = 2) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)))
const isoDay = (d) => d.toISOString().slice(0, 10)

/** Build the verdict request body from analyze() output and the trades it came from. */
export function buildVerdictPayload(analysis, trades) {
  const { core, r, byWeekday, byHour, afterOutcome, sizeChanges, streaks, revenge } = analysis
  const summarizeAfter = (s) => ({
    count: s.count,
    winRate: round(s.winRate, 3),
    avgPnl: round(s.avgPnl),
    avgR: round(s.avgR),
  })
  const summarizeSize = (s) => ({ avgChange: round(s.avgChange, 3), sizedUpShare: round(s.sizedUpShare, 3) })

  return {
    tradeCount: core.tradeCount,
    firstDate: isoDay(trades[0].date),
    lastDate: isoDay(trades.at(-1).date),
    core: {
      totalPnl: round(core.totalPnl),
      winRate: round(core.winRate, 3),
      avgWin: round(core.avgWin),
      avgLoss: round(core.avgLoss),
      profitFactor: round(core.profitFactor), // null when there are no losses (Infinity)
      expectancy: round(core.expectancy),
      maxDrawdown: round(core.maxDrawdown),
    },
    r: {
      avgR: round(r.avgR),
      bestR: round(r.bestR),
      worstR: round(r.worstR),
      distribution: r.distribution.map((b) => ({ from: b.from, to: b.to, count: b.count })),
    },
    byWeekday: byWeekday.map((d) => ({ day: d.label, pnl: round(d.pnl), count: d.count, winRate: round(d.winRate, 3) })),
    byHour: byHour.map((h) => ({ hour: h.key, pnl: round(h.pnl), count: h.count, winRate: round(h.winRate, 3) })),
    afterWin: { ...summarizeAfter(afterOutcome.afterWin), ...summarizeSize(sizeChanges.afterWin) },
    afterLoss: { ...summarizeAfter(afterOutcome.afterLoss), ...summarizeSize(sizeChanges.afterLoss) },
    streaks: { longestWin: streaks.longestWin, longestLoss: streaks.longestLoss },
    revenge: {
      count: revenge.flagged.length,
      totalPnl: round(revenge.totalPnl),
      trades: revenge.flagged.slice(0, MAX_REVENGE_ITEMS).map((f) => ({
        symbol: f.trade.symbol,
        minutesAfter: round(f.minutesAfter, 0),
        sizeRatio: round(f.sizeRatio),
        pnl: round(f.pnl),
      })),
    },
  }
}

// ---- Server-side validation -------------------------------------------------

class PayloadError extends Error {}

const LIMIT = 1e9 // no legitimate money/count value comes near this

function num(v, path, { nullable = false, integer = false, min = -LIMIT, max = LIMIT } = {}) {
  if (v === null && nullable) return null
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new PayloadError(`${path} must be a number`)
  if (integer && !Number.isInteger(v)) throw new PayloadError(`${path} must be an integer`)
  if (v < min || v > max) throw new PayloadError(`${path} is out of range`)
  return v
}

function obj(v, path) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new PayloadError(`${path} must be an object`)
  return v
}

function arr(v, path, maxLength) {
  if (!Array.isArray(v)) throw new PayloadError(`${path} must be an array`)
  if (v.length > maxLength) throw new PayloadError(`${path} has too many items`)
  return v
}

function date(v, path) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new PayloadError(`${path} must be YYYY-MM-DD`)
  return v
}

function symbol(v, path) {
  // Tickers only: this is the one free-form string that reaches the prompt.
  if (typeof v !== 'string' || !/^[A-Z0-9.\-/:^=]{1,12}$/.test(v)) throw new PayloadError(`${path} is not a valid symbol`)
  return v
}

const rate = (v, path) => num(v, path, { nullable: true, min: 0, max: 1 })
const count = (v, path) => num(v, path, { integer: true, min: 0, max: 1e6 })

function after(v, path) {
  obj(v, path)
  return {
    count: count(v.count, `${path}.count`),
    winRate: rate(v.winRate, `${path}.winRate`),
    avgPnl: num(v.avgPnl, `${path}.avgPnl`, { nullable: true }),
    avgR: num(v.avgR, `${path}.avgR`, { nullable: true }),
    avgChange: num(v.avgChange, `${path}.avgChange`, { nullable: true, min: -1, max: 1e6 }),
    sizedUpShare: rate(v.sizedUpShare, `${path}.sizedUpShare`),
  }
}

/**
 * Rebuild the payload from known fields only, rejecting anything malformed.
 * Returns { value } or { error }.
 */
export function sanitizeVerdictPayload(input) {
  try {
    const p = obj(input, 'body')
    const core = obj(p.core, 'core')
    const r = obj(p.r, 'r')
    const streaks = obj(p.streaks, 'streaks')
    const revenge = obj(p.revenge, 'revenge')
    const value = {
      tradeCount: num(p.tradeCount, 'tradeCount', { integer: true, min: 1, max: 1e6 }),
      firstDate: date(p.firstDate, 'firstDate'),
      lastDate: date(p.lastDate, 'lastDate'),
      core: {
        totalPnl: num(core.totalPnl, 'core.totalPnl'),
        winRate: rate(core.winRate, 'core.winRate'),
        avgWin: num(core.avgWin, 'core.avgWin', { nullable: true }),
        avgLoss: num(core.avgLoss, 'core.avgLoss', { nullable: true }),
        profitFactor: num(core.profitFactor, 'core.profitFactor', { nullable: true, min: 0 }),
        expectancy: num(core.expectancy, 'core.expectancy', { nullable: true }),
        maxDrawdown: num(core.maxDrawdown, 'core.maxDrawdown', { min: 0 }),
      },
      r: {
        avgR: num(r.avgR, 'r.avgR', { nullable: true }),
        bestR: num(r.bestR, 'r.bestR', { nullable: true }),
        worstR: num(r.worstR, 'r.worstR', { nullable: true }),
        distribution: arr(r.distribution, 'r.distribution', 40).map((b, i) => {
          obj(b, `r.distribution[${i}]`)
          return {
            from: num(b.from, `r.distribution[${i}].from`, { min: -100, max: 100 }),
            to: num(b.to, `r.distribution[${i}].to`, { min: -100, max: 100 }),
            count: count(b.count, `r.distribution[${i}].count`),
          }
        }),
      },
      byWeekday: arr(p.byWeekday, 'byWeekday', 7).map((d, i) => {
        obj(d, `byWeekday[${i}]`)
        if (!WEEKDAYS.includes(d.day)) throw new PayloadError(`byWeekday[${i}].day is invalid`)
        return {
          day: d.day,
          pnl: num(d.pnl, `byWeekday[${i}].pnl`),
          count: count(d.count, `byWeekday[${i}].count`),
          winRate: rate(d.winRate, `byWeekday[${i}].winRate`),
        }
      }),
      byHour: arr(p.byHour, 'byHour', 24).map((h, i) => {
        obj(h, `byHour[${i}]`)
        return {
          hour: num(h.hour, `byHour[${i}].hour`, { integer: true, min: 0, max: 23 }),
          pnl: num(h.pnl, `byHour[${i}].pnl`),
          count: count(h.count, `byHour[${i}].count`),
          winRate: rate(h.winRate, `byHour[${i}].winRate`),
        }
      }),
      afterWin: after(p.afterWin, 'afterWin'),
      afterLoss: after(p.afterLoss, 'afterLoss'),
      streaks: {
        longestWin: count(streaks.longestWin, 'streaks.longestWin'),
        longestLoss: count(streaks.longestLoss, 'streaks.longestLoss'),
      },
      revenge: {
        count: count(revenge.count, 'revenge.count'),
        totalPnl: num(revenge.totalPnl, 'revenge.totalPnl'),
        trades: arr(revenge.trades, 'revenge.trades', MAX_REVENGE_ITEMS).map((t, i) => {
          obj(t, `revenge.trades[${i}]`)
          return {
            symbol: symbol(t.symbol, `revenge.trades[${i}].symbol`),
            minutesAfter: num(t.minutesAfter, `revenge.trades[${i}].minutesAfter`, { min: 0, max: 60 * 24 }),
            sizeRatio: num(t.sizeRatio, `revenge.trades[${i}].sizeRatio`, { min: 0, max: 1e6 }),
            pnl: num(t.pnl, `revenge.trades[${i}].pnl`),
          }
        }),
      },
    }
    return { value }
  } catch (err) {
    if (err instanceof PayloadError) return { error: err.message }
    throw err
  }
}
