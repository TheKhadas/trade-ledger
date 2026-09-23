import { axisMoney, fmtDate, money, num, pct, rFmt, ratio, signClass, signedMoney } from '../../lib/format'
import ChartCard from '../ChartCard'
import EquityChart from '../charts/EquityChart'
import SignedBarChart from '../charts/SignedBarChart'
import TradesTable from '../TradesTable'
import BehaviorCard from './BehaviorCard'
import RevengeCard from './RevengeCard'
import StatTile from './StatTile'
import VerdictCard from './VerdictCard'

function rBinLabel(bin) {
  if (bin.open === 'below') return `<${num(bin.to, 1)}`
  if (bin.open === 'above') return `≥${num(bin.from, 1)}`
  return num(bin.from, 1)
}

function rBinRange(bin) {
  if (bin.open === 'below') return `Below ${rFmt(bin.to, 1)}`
  if (bin.open === 'above') return `${rFmt(bin.from, 1)} and above`
  return `${rFmt(bin.from, 1)} to ${rFmt(bin.to, 1)}`
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function groupTooltip(d) {
  return {
    value: signedMoney(d.value),
    valueClass: signClass(d.value),
    title: d.label,
    rows: [
      ['Trades', d.count],
      ['Win rate', pct(d.winRate)],
    ],
  }
}

const groupTable = (groups, first) => ({
  columns: [first, 'Trades', 'Win rate', 'Net P&L'],
  rows: groups.map((g) => [g.label, g.count, pct(g.winRate), signedMoney(g.pnl)]),
})

export default function Dashboard({ trades, analysis, source }) {
  const { core, r, equity, byWeekday, byHour, afterOutcome, sizeChanges, streaks, revenge } = analysis
  const first = trades[0].date
  const last = trades.at(-1).date
  const revengeIds = new Set(revenge.flagged.map((f) => f.trade.id))

  const rData = r.distribution.map((b) => ({ ...b, label: rBinLabel(b), value: b.count }))
  const weekdayData = byWeekday.map((d) => ({ ...d, value: d.pnl }))
  const hourData = byHour.map((d) => ({ ...d, value: d.pnl }))

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">Net P&amp;L</p>
          <p className={`text-5xl font-semibold tracking-tight ${signClass(core.totalPnl)}`}>{signedMoney(core.totalPnl)}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {plural(core.tradeCount, 'trade')} · {fmtDate(first)} – {fmtDate(last)} ·{' '}
            <span className="text-zinc-500">{source}</span>
          </p>
        </div>
      </section>

      <section aria-label="Core metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Win rate" value={pct(core.winRate)} hint={`${core.winCount} W · ${core.lossCount} L`} />
        <StatTile label="Profit factor" value={ratio(core.profitFactor)} hint="Gross profit ÷ gross loss" />
        <StatTile label="Expectancy" value={signedMoney(core.expectancy)} valueClass={signClass(core.expectancy)} hint="Avg net P&L per trade" />
        <StatTile
          label="Avg win / avg loss"
          value={
            <>
              <span className="text-emerald-400">{axisMoney(Math.round(core.avgWin ?? 0))}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-rose-400">{axisMoney(Math.round(core.avgLoss ?? 0))}</span>
            </>
          }
          hint={core.avgWin && core.avgLoss ? `${(core.avgWin / -core.avgLoss).toFixed(2)} payoff ratio` : undefined}
        />
        <StatTile label="Max drawdown" value={money(-core.maxDrawdown)} valueClass={core.maxDrawdown ? 'text-rose-400' : 'text-zinc-50'} hint="Peak to trough" />
        <StatTile label="Avg R" value={rFmt(r.avgR)} valueClass={signClass(r.avgR)} hint={`Total ${rFmt(r.totalR, 1)}`} />
      </section>

      <VerdictCard analysis={analysis} trades={trades} />

      <ChartCard
        title="Equity curve"
        subtitle="Cumulative net P&L after each trade"
        table={{
          columns: ['Trade', 'Closed', 'Symbol', 'P&L', 'Equity'],
          rows: equity.map((p) => [`#${p.n}`, fmtDate(p.date), p.symbol, signedMoney(p.pnl), money(p.equity)]),
        }}
      >
        <EquityChart points={equity} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="R-multiple distribution"
          subtitle={`Avg ${rFmt(r.avgR)} · best ${rFmt(r.bestR)} · worst ${rFmt(r.worstR)}`}
          table={{ columns: ['R range', 'Trades'], rows: rData.map((b) => [rBinRange(b), b.count]) }}
        >
          <SignedBarChart
            data={rData}
            colorOf={(b) => (b.from < 0 ? 'negative' : 'positive')}
            ariaLabel="Histogram of trade R-multiples"
            tooltip={(b) => ({ value: plural(b.count, 'trade'), title: rBinRange(b) })}
          />
        </ChartCard>
        <RevengeCard revenge={revenge} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="P&L by weekday" subtitle="By the day each trade opened" table={groupTable(byWeekday, 'Day')}>
          <SignedBarChart data={weekdayData} yTickFormatter={axisMoney} ariaLabel="Net P&L by weekday" tooltip={groupTooltip} />
        </ChartCard>
        <ChartCard title="P&L by hour" subtitle="By the hour each trade opened (local time)" table={groupTable(byHour, 'Hour')}>
          <SignedBarChart data={hourData} yTickFormatter={axisMoney} ariaLabel="Net P&L by hour of day" tooltip={groupTooltip} />
        </ChartCard>
      </div>

      <BehaviorCard afterOutcome={afterOutcome} sizeChanges={sizeChanges} streaks={streaks} />

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-100">All trades</h3>
        <TradesTable trades={trades} revengeIds={revengeIds} />
      </section>
    </div>
  )
}
