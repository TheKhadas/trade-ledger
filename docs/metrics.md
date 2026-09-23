# Metrics reference

Every number on the dashboard comes from a pure function in [`src/lib/metrics.js`](../src/lib/metrics.js).
This page defines each one precisely, including edge cases. Tests live in `src/lib/metrics.test.js`.

## Conventions

- **Order.** Trades are processed in order of their open time (`date`); ties keep file order. "Previous trade" and
  "next trade" always refer to this order.
- **Outcome.** A trade is a **win** if its net P&L is > 0, a **loss** if < 0, and **breakeven** if exactly 0.
  Breakeven trades count toward the trade total but are neither wins nor losses.
- **Close time.** `exit_date` when provided, otherwise `date`.
- **Local time.** Weekday and hour use the browser's local time zone. ISO datetimes without an offset are read as
  local time; datetimes with `Z` or an offset are converted to local time.
- **Empty inputs.** Averages over zero trades are `null` and render as "—".

## Per-trade values

| Value | Formula |
| --- | --- |
| **Net P&L** (`tradePnl`) | long: `(exit − entry) × size − fees`; short: `(entry − exit) × size − fees`. Missing fees count as 0. |
| **R-multiple** (`rMultiple`) | long: `(exit − entry) / (entry − stop)`; short: `(entry − exit) / (stop − entry)`. |
| **Notional** (`notional`) | `entry × size`, the position's value at entry. |

R-multiples **exclude fees**: they measure execution against the planned risk, before costs. R is `null` if risk is
zero or the stop is on the wrong side, which parsing already rejects.

## Core metrics (`coreMetrics`)

| Metric | Definition | Edge cases |
| --- | --- | --- |
| Total P&L | Sum of net P&L | 0 with no trades |
| Win rate | wins ÷ all trades (breakeven trades count in the denominator) | `null` with no trades |
| Avg win | Mean net P&L of winning trades | `null` with no wins |
| Avg loss | Mean net P&L of losing trades (**negative**) | `null` with no losses |
| Payoff ratio (dashboard) | avg win ÷ \|avg loss\| | hidden when either is missing |
| Profit factor | gross profit ÷ gross loss (both as positive sums) | `Infinity` (shown as ∞) with profits and no losses; `null` with neither |
| Expectancy | Mean net P&L per trade | `null` with no trades |
| Max drawdown | Largest peak-to-trough drop of cumulative P&L, as a positive amount | Starts from a 0 balance, so an immediate loss counts as drawdown |

## Equity curve (`equityCurve`)

One point per trade: cumulative net P&L after that trade, the trade's own P&L, and `drawdown`, the distance below the
running peak (0 at a new high, negative otherwise). The chart prepends a starting point at 0. Points are ordered by
open time and dated by close time.

## R statistics (`rStats`)

- **Avg R**, **total R**, **best R**, **worst R** over trades with a defined R.
- **Distribution:** 10 bins of 0.5R from −2R to +3R. The outer bins are open-ended: the first holds everything below
  −1.5R and the last everything at or above +2.5R, so outliers never fall off the chart. Bins that start below 0 are
  drawn red, the rest blue.

## Time patterns

| Function | Groups by | Notes |
| --- | --- | --- |
| `pnlByWeekday` | Weekday the trade **opened** | Mon–Fri are always listed, even with no trades (P&L 0, win rate `null`); Sat/Sun appear only if traded. |
| `pnlByHour` | Hour of day the trade **opened** (00–23) | Only hours with trades are listed, sorted. |

Each group reports net P&L, trade count and win rate.

## After a win vs. after a loss

**`performanceAfterOutcome`.** Looks at every trade that has a previous trade and buckets it by the previous trade's
outcome. Trades after a breakeven are skipped. For each bucket: count, win rate, average net P&L and average R.

**`sizeChanges`.** For the same pairs, the change in notional value versus the previous trade:
`notional(next) / notional(previous) − 1`. Reports the average change (0.17 = 17% larger) and the share of trades
that were larger than the one before ("sized up"). Notional is used instead of share count so trades in different
symbols compare fairly.

## Streaks (`streaks`)

Longest run of consecutive wins and of consecutive losses. A breakeven trade ends either run.

## Revenge trades (`revengeTrades`)

A trade is flagged when **all** of these hold for it and the trade immediately before it:

1. The previous trade was a **loss** (net P&L < 0, after fees).
2. It opened **0 to 30 minutes after the previous trade closed**, inclusive. A trade opened before the previous one
   closed (overlapping) is not flagged.
3. Its **size ≥ 1.5 ×** the previous trade's size, comparing the `size` column (share counts), as the spec defines.

The card shows the combined net P&L of flagged trades, how many lost, and for each one the gap in minutes, the
losing trade it followed, and the size ratio. Flagged rows also get a **Revenge** badge in the trades table.

Only the immediately preceding trade is considered, so a revenge trade that follows an unrelated trade in between
isn't caught. Without `exit_date`, the gap is measured from the previous trade's open time, which makes gaps look
longer than they were.

Both thresholds are parameters (`{ windowMinutes, sizeMultiple }`); the app uses the defaults.

## `analyze(trades)`

Runs all of the above and returns:

```js
{ core, r, equity, byWeekday, byHour, afterOutcome, sizeChanges, streaks, revenge }
```

This object feeds both the dashboard and [`buildVerdictPayload`](api.md#request-body).
