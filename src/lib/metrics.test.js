import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  analyze,
  coreMetrics,
  equityCurve,
  maxDrawdown,
  performanceAfterOutcome,
  pnlByHour,
  pnlByWeekday,
  revengeTrades,
  rMultiple,
  rStats,
  sizeChanges,
  streaks,
  tradePnl,
} from './metrics'
import { parseTradesCsv } from './parseTrades'

// Mon 6 Jul 2026, local time.
const at = (day, h, m = 0) => new Date(2026, 6, day, h, m)
const trade = (overrides) => ({
  date: at(6, 10),
  exitDate: null,
  symbol: 'TEST',
  side: 'long',
  entry: 100,
  exit: 100,
  stop: 95,
  size: 10,
  fees: 0,
  ...overrides,
})

// Hand-computed fixture: P&L 98, -100, -50, 30; R 2, -2, -0.5, 3.
const A = trade({ id: 'A', date: at(6, 9, 30), side: 'long', entry: 100, exit: 110, stop: 95, size: 10, fees: 2 })
const B = trade({ id: 'B', date: at(6, 11), side: 'short', entry: 50, exit: 55, stop: 52.5, size: 20 })
const C = trade({ id: 'C', date: at(8, 10, 15), side: 'long', entry: 20, exit: 19, stop: 18, size: 50 })
const D = trade({ id: 'D', date: at(8, 14), side: 'short', entry: 30, exit: 27, stop: 31, size: 10 })
const FIXTURE = [A, B, C, D]

describe('tradePnl', () => {
  it('nets fees on a long', () => expect(tradePnl(A)).toBe(98))
  it('inverts direction for a short', () => {
    expect(tradePnl(B)).toBe(-100)
    expect(tradePnl(D)).toBe(30)
  })
  it('treats missing fees as zero', () => expect(tradePnl(trade({ exit: 101, fees: undefined }))).toBe(10))
})

describe('rMultiple', () => {
  it('measures move in units of risk, sign-adjusted for shorts', () => {
    expect(FIXTURE.map(rMultiple)).toEqual([2, -2, -0.5, 3])
  })
  it('returns null when risk is zero or on the wrong side', () => {
    expect(rMultiple(trade({ stop: 100 }))).toBeNull()
    expect(rMultiple(trade({ stop: 105 }))).toBeNull()
  })
})

describe('coreMetrics', () => {
  it('computes headline stats', () => {
    const m = coreMetrics(FIXTURE)
    expect(m).toMatchObject({
      tradeCount: 4,
      totalPnl: -22,
      winCount: 2,
      lossCount: 2,
      winRate: 0.5,
      avgWin: 64,
      avgLoss: -75,
      expectancy: -5.5,
      maxDrawdown: 150,
    })
    expect(m.profitFactor).toBeCloseTo(128 / 150)
  })

  it('reports Infinity profit factor with no losses and nulls with no trades', () => {
    expect(coreMetrics([A]).profitFactor).toBe(Infinity)
    expect(coreMetrics([])).toMatchObject({ tradeCount: 0, totalPnl: 0, winRate: null, profitFactor: null, expectancy: null })
  })

  it('does not count breakeven trades as wins or losses', () => {
    const m = coreMetrics([trade({ exit: 100 }), A])
    expect(m).toMatchObject({ winCount: 1, lossCount: 0, winRate: 0.5 })
  })
})

describe('maxDrawdown', () => {
  it('measures from the running peak, including below the starting balance', () => {
    expect(maxDrawdown([100, -30, 50, -200, 10])).toBe(200)
    expect(maxDrawdown([-40, -10])).toBe(50)
    expect(maxDrawdown([10, 20])).toBe(0)
  })
})

describe('equityCurve', () => {
  it('accumulates P&L and tracks drawdown from peak', () => {
    const curve = equityCurve(FIXTURE)
    expect(curve.map((p) => p.equity)).toEqual([98, -2, -52, -22])
    expect(curve.map((p) => p.drawdown)).toEqual([0, -100, -150, -120])
  })
  it('dates each point at the trade close', () => {
    const closed = at(6, 12)
    expect(equityCurve([{ ...A, exitDate: closed }])[0].date).toBe(closed)
    expect(equityCurve([A])[0].date).toBe(A.date)
  })
})

describe('rStats', () => {
  it('averages R and bins it, clamping outliers into the open-ended edges', () => {
    const s = rStats([...FIXTURE, trade({ exit: 60 }), trade({ exit: 150 })]) // R -8 and 10
    expect(s.avgR).toBeCloseTo((2 - 2 - 0.5 + 3 - 8 + 10) / 6)
    expect(s.bestR).toBe(10)
    expect(s.worstR).toBe(-8)
    const counts = Object.fromEntries(s.distribution.map((b) => [b.from, b.count]))
    expect(counts).toMatchObject({ '-2': 2, '-0.5': 1, 2: 1, 2.5: 2 })
    expect(s.distribution).toHaveLength(10)
    expect(s.distribution[0].open).toBe('below')
    expect(s.distribution.at(-1).open).toBe('above')
  })
  it('handles no trades', () => {
    expect(rStats([])).toMatchObject({ avgR: null, bestR: null, worstR: null })
  })
})

describe('pnlByWeekday', () => {
  it('always lists Mon–Fri and adds weekends only when traded', () => {
    const days = pnlByWeekday(FIXTURE)
    expect(days.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(days[0]).toMatchObject({ pnl: -2, count: 2, winRate: 0.5 })
    expect(days[1]).toMatchObject({ pnl: 0, count: 0, winRate: null })
    expect(days[2]).toMatchObject({ pnl: -20, count: 2 })

    const withSat = pnlByWeekday([...FIXTURE, trade({ date: at(11, 10), exit: 101 })])
    expect(withSat.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })
})

describe('pnlByHour', () => {
  it('groups by open hour, sorted', () => {
    expect(pnlByHour(FIXTURE)).toEqual([
      { key: 9, label: '09:00', pnl: 98, count: 1, winRate: 1 },
      { key: 10, label: '10:00', pnl: -50, count: 1, winRate: 0 },
      { key: 11, label: '11:00', pnl: -100, count: 1, winRate: 0 },
      { key: 14, label: '14:00', pnl: 30, count: 1, winRate: 1 },
    ])
  })
})

describe('performanceAfterOutcome', () => {
  it('splits the next trade by the previous outcome', () => {
    const { afterWin, afterLoss } = performanceAfterOutcome(FIXTURE)
    expect(afterWin).toMatchObject({ count: 1, winRate: 0, avgPnl: -100, avgR: -2 })
    expect(afterLoss).toMatchObject({ count: 2, winRate: 0.5, avgPnl: -10, avgR: 1.25 })
  })
  it('skips trades that follow a breakeven', () => {
    const { afterWin, afterLoss } = performanceAfterOutcome([trade({ exit: 100 }), A])
    expect(afterWin.count + afterLoss.count).toBe(0)
  })
})

describe('streaks', () => {
  it('finds the longest win and loss runs', () => {
    expect(streaks(FIXTURE)).toEqual({ longestWin: 1, longestLoss: 2 })
    expect(streaks([A, A, A, B, A])).toEqual({ longestWin: 3, longestLoss: 1 })
  })
  it('lets a breakeven trade break a run', () => {
    expect(streaks([B, trade({ exit: 100 }), B])).toEqual({ longestWin: 0, longestLoss: 1 })
  })
})

describe('sizeChanges', () => {
  it('compares position value to the previous trade', () => {
    // Notional: A 1000, B 1000, C 1000, D 300.
    const { afterWin, afterLoss } = sizeChanges(FIXTURE)
    expect(afterWin).toMatchObject({ count: 1, avgChange: 0, sizedUpShare: 0 })
    expect(afterLoss.count).toBe(2)
    expect(afterLoss.avgChange).toBeCloseTo((0 + -0.7) / 2)
  })
  it('flags sizing up after a loss', () => {
    const loss = trade({ exit: 90, size: 10 })
    const bigger = trade({ date: at(6, 11), size: 30 })
    expect(sizeChanges([loss, bigger]).afterLoss).toMatchObject({ avgChange: 2, sizedUpShare: 1 })
  })
})

describe('revengeTrades', () => {
  const loss = trade({ id: 'loss', date: at(6, 10), exitDate: at(6, 10, 20), exit: 90, size: 10 })
  const next = (minutesAfterClose, size, extra = {}) =>
    trade({ id: 'next', date: at(6, 10, 20 + minutesAfterClose), size, exit: 97, ...extra })

  it('flags a bigger trade opened soon after a losing trade closes', () => {
    const { flagged, totalPnl } = revengeTrades([loss, next(10, 15)])
    expect(flagged).toHaveLength(1)
    expect(flagged[0]).toMatchObject({ minutesAfter: 10, sizeRatio: 1.5, pnl: -45 })
    expect(totalPnl).toBe(-45)
  })

  it('includes the 30-minute boundary and excludes beyond it', () => {
    expect(revengeTrades([loss, next(30, 20)]).flagged).toHaveLength(1)
    expect(revengeTrades([loss, next(31, 20)]).flagged).toHaveLength(0)
  })

  it('requires size ≥ 1.5× the previous trade', () => {
    expect(revengeTrades([loss, next(5, 14)]).flagged).toHaveLength(0)
  })

  it('ignores trades after a win or breakeven', () => {
    expect(revengeTrades([{ ...loss, exit: 110 }, next(5, 30)]).flagged).toHaveLength(0)
    expect(revengeTrades([{ ...loss, exit: 100 }, next(5, 30)]).flagged).toHaveLength(0)
  })

  it('ignores trades opened before the losing trade closed', () => {
    expect(revengeTrades([loss, next(-5, 30)]).flagged).toHaveLength(0)
  })

  it('measures from the open time when exit_date is missing', () => {
    const noExit = { ...loss, exitDate: null } // closes "at" 10:00
    expect(revengeTrades([noExit, next(5, 30)]).flagged).toHaveLength(1) // 25 min after
    expect(revengeTrades([noExit, next(15, 30)]).flagged).toHaveLength(0) // 35 min after
  })
})

describe('sample data', () => {
  const csv = readFileSync(new URL('../../public/sample-trades.csv', import.meta.url), 'utf8')
  const { trades, rowErrors } = parseTradesCsv(csv)
  const result = analyze(trades)

  it('parses cleanly', () => {
    expect(trades).toHaveLength(60)
    expect(rowErrors).toHaveLength(0)
  })

  it('contains the four planted revenge trades, net losing', () => {
    expect(result.revenge.flagged.map((f) => f.trade.symbol)).toEqual(['AMZN', 'AMZN', 'TSLA', 'MSFT'])
    expect(result.revenge.flagged.filter((f) => f.pnl < 0)).toHaveLength(3)
    expect(result.revenge.totalPnl).toBeLessThan(-300)
  })

  it('is profitable overall with a sensible win rate', () => {
    expect(result.core.totalPnl).toBeGreaterThan(0)
    expect(result.core.winRate).toBeCloseTo(28 / 60)
    expect(result.equity).toHaveLength(60)
  })
})
