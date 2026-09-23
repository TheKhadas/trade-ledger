import { fmtDateTime, signClass, signedMoney } from '../../lib/format'
import { tradePnl } from '../../lib/metrics'

export default function RevengeCard({ revenge }) {
  const { flagged, totalPnl } = revenge
  const losers = flagged.filter((f) => f.pnl < 0).length

  return (
    <section className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">Revenge trades</h3>
        <p className="mt-0.5 text-sm text-zinc-400">
          Opened ≤ 30 min after a losing trade closed, at ≥ 1.5× its size
        </p>
      </header>

      {flagged.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-800 py-8 text-sm text-zinc-400">
          None detected. Nice discipline.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-baseline gap-3">
            <p className={`text-3xl font-semibold ${signClass(totalPnl)}`}>{signedMoney(totalPnl)}</p>
            <p className="text-sm text-zinc-400">
              across {flagged.length} trade{flagged.length === 1 ? '' : 's'} · {losers} lost
            </p>
          </div>
          <ul className="-mx-1 max-h-72 space-y-1 overflow-auto">
            {flagged.map(({ trade, previous, minutesAfter, sizeRatio, pnl }) => (
              <li key={trade.id} className="rounded-lg px-1 py-2 hover:bg-zinc-800/40">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium text-zinc-100">{trade.symbol}</span>{' '}
                    <span className="text-zinc-400">{trade.side}</span>{' '}
                    <span className="text-zinc-500">· {fmtDateTime(trade.date)}</span>
                  </p>
                  <p className={`text-sm font-medium tabular-nums ${signClass(pnl)}`}>{signedMoney(pnl)}</p>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {Math.round(minutesAfter)} min after a {signedMoney(tradePnl(previous))} {previous.symbol} loss ·{' '}
                  {sizeRatio.toFixed(1)}× size
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
