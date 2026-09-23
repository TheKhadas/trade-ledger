// Pure metric functions over validated trades (see parseTrades.js).
// Trades are expected in chronological order of their open time.

const MINUTE = 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const sum = (xs) => xs.reduce((a, b) => a + b, 0)
const mean = (xs) => (xs.length ? sum(xs) / xs.length : null)

/** Net P&L of one trade in account currency, after fees. */
export function tradePnl(t) {
  const perUnit = t.side === 'long' ? t.exit - t.entry : t.entry - t.exit
  return perUnit * t.size - (t.fees ?? 0)
}

/**
 * R-multiple: price move in units of initial risk (entry → stop), sign-adjusted for shorts.
 * Fees are excluded so R reflects execution against the plan.
 */
export function rMultiple(t) {
  const risk = t.side === 'long' ? t.entry - t.stop : t.stop - t.entry
  const move = t.side === 'long' ? t.exit - t.entry : t.entry - t.exit
  return risk > 0 ? move / risk : null
}

/** When the trade closed; falls back to the open time when exit_date wasn't provided. */
export const closeTime = (t) => t.exitDate ?? t.date

/** Position value at entry (price × size), for comparing sizes across symbols. */
export const notional = (t) => t.entry * t.size

const outcome = (pnl) => (pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'even')

/** Headline stats: P&L, win rate, avg win/loss, profit factor, expectancy, max drawdown. */
export function coreMetrics(trades) {
  const pnls = trades.map(tradePnl)
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const grossProfit = sum(wins)
  const grossLoss = -sum(losses)

  return {
    tradeCount: trades.length,
    totalPnl: sum(pnls),
    winCount: wins.length,
    lossCount: losses.length,
    winRate: trades.length ? wins.length / trades.length : null,
    avgWin: mean(wins),
    avgLoss: mean(losses), // negative
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    expectancy: mean(pnls),
    maxDrawdown: maxDrawdown(pnls),
  }
}

/** Largest peak-to-trough drop of the cumulative P&L (starting from 0), as a positive number. */
export function maxDrawdown(pnls) {
  let equity = 0
  let peak = 0
  let worst = 0
  for (const p of pnls) {
    equity += p
    peak = Math.max(peak, equity)
    worst = Math.max(worst, peak - equity)
  }
  return worst
}

/** Cumulative P&L after each trade, with the drawdown from the running peak. */
export function equityCurve(trades) {
  let equity = 0
  let peak = 0
  return trades.map((t, i) => {
    const pnl = tradePnl(t)
    equity += pnl
    peak = Math.max(peak, equity)
    return { n: i + 1, id: t.id, date: closeTime(t), symbol: t.symbol, pnl, equity, drawdown: equity - peak }
  })
}

/** Average R and a histogram of R-multiples in fixed-width bins; the outer bins are open-ended. */
export function rStats(trades, { binSize = 0.5, min = -2, max = 3 } = {}) {
  const rs = trades.map(rMultiple).filter((r) => r !== null)
  const binCount = Math.round((max - min) / binSize)
  const bins = Array.from({ length: binCount }, (_, i) => {
    const from = min + i * binSize
    return { from, to: from + binSize, count: 0, open: i === 0 ? 'below' : i === binCount - 1 ? 'above' : null }
  })
  for (const r of rs) {
    const i = Math.min(binCount - 1, Math.max(0, Math.floor((r - min) / binSize + 1e-9)))
    bins[i].count++
  }
  return {
    avgR: mean(rs),
    totalR: sum(rs),
    bestR: rs.length ? Math.max(...rs) : null,
    worstR: rs.length ? Math.min(...rs) : null,
    distribution: bins,
  }
}

function groupStats(trades, keyOf) {
  const groups = new Map()
  for (const t of trades) {
    const key = keyOf(t)
    const g = groups.get(key) ?? { key, pnl: 0, count: 0, wins: 0 }
    const pnl = tradePnl(t)
    g.pnl += pnl
    g.count++
    if (pnl > 0) g.wins++
    groups.set(key, g)
  }
  return groups
}

/** P&L by weekday the trade was opened; Mon–Fri always present, weekends only if traded. */
export function pnlByWeekday(trades) {
  const groups = groupStats(trades, (t) => t.date.getDay())
  const days = [1, 2, 3, 4, 5, ...[6, 0].filter((d) => groups.has(d))]
  return days.map((d) => {
    const g = groups.get(d) ?? { pnl: 0, count: 0, wins: 0 }
    return { key: d, label: WEEKDAYS[d], pnl: g.pnl, count: g.count, winRate: g.count ? g.wins / g.count : null }
  })
}

/** P&L by hour of day the trade was opened (local time), only for hours that were traded. */
export function pnlByHour(trades) {
  const groups = groupStats(trades, (t) => t.date.getHours())
  return [...groups.values()]
    .sort((a, b) => a.key - b.key)
    .map((g) => ({
      key: g.key,
      label: `${String(g.key).padStart(2, '0')}:00`,
      pnl: g.pnl,
      count: g.count,
      winRate: g.wins / g.count,
    }))
}

/** How the next trade performs after a win vs after a loss (breakeven trades don't count as either). */
export function performanceAfterOutcome(trades) {
  const buckets = { win: [], loss: [] }
  for (let i = 1; i < trades.length; i++) {
    const prev = outcome(tradePnl(trades[i - 1]))
    if (prev !== 'even') buckets[prev].push(trades[i])
  }
  const summarize = (ts) => {
    const pnls = ts.map(tradePnl)
    return {
      count: ts.length,
      winRate: ts.length ? pnls.filter((p) => p > 0).length / ts.length : null,
      avgPnl: mean(pnls),
      avgR: mean(ts.map(rMultiple).filter((r) => r !== null)),
    }
  }
  return { afterWin: summarize(buckets.win), afterLoss: summarize(buckets.loss) }
}

/** Longest runs of consecutive wins and losses; a breakeven trade ends either run. */
export function streaks(trades) {
  let longestWin = 0
  let longestLoss = 0
  let run = 0
  let runType = null
  for (const t of trades) {
    const o = outcome(tradePnl(t))
    run = o === runType ? run + 1 : 1
    runType = o
    if (o === 'win') longestWin = Math.max(longestWin, run)
    if (o === 'loss') longestLoss = Math.max(longestLoss, run)
  }
  return { longestWin, longestLoss }
}

/**
 * How position value changes on the next trade after a win vs after a loss.
 * Uses notional (entry × size) so trades in different symbols are comparable.
 * avgChange is a fraction: 0.25 means the next position was 25% larger on average.
 */
export function sizeChanges(trades) {
  const after = { win: [], loss: [] }
  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1]
    const o = outcome(tradePnl(prev))
    if (o !== 'even') after[o].push(notional(trades[i]) / notional(prev) - 1)
  }
  const summarize = (changes) => ({
    count: changes.length,
    avgChange: mean(changes),
    sizedUpShare: changes.length ? changes.filter((c) => c > 0).length / changes.length : null,
  })
  return { afterWin: summarize(after.win), afterLoss: summarize(after.loss) }
}

/**
 * Revenge trades: opened within `windowMinutes` of a losing trade's close,
 * with size ≥ `sizeMultiple` × that previous trade's size.
 */
export function revengeTrades(trades, { windowMinutes = 30, sizeMultiple = 1.5 } = {}) {
  const flagged = []
  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1]
    const t = trades[i]
    if (tradePnl(prev) >= 0) continue
    const minutesAfter = (t.date - closeTime(prev)) / MINUTE
    if (minutesAfter < 0 || minutesAfter > windowMinutes) continue
    if (t.size < sizeMultiple * prev.size) continue
    flagged.push({ trade: t, previous: prev, minutesAfter, sizeRatio: t.size / prev.size, pnl: tradePnl(t) })
  }
  return { flagged, totalPnl: sum(flagged.map((f) => f.pnl)) }
}

/** Everything the dashboard (and the AI verdict) needs, in one pass. */
export function analyze(trades) {
  return {
    core: coreMetrics(trades),
    r: rStats(trades),
    equity: equityCurve(trades),
    byWeekday: pnlByWeekday(trades),
    byHour: pnlByHour(trades),
    afterOutcome: performanceAfterOutcome(trades),
    streaks: streaks(trades),
    sizeChanges: sizeChanges(trades),
    revenge: revengeTrades(trades),
  }
}
