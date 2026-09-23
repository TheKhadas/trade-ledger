import { pct, rFmt, signClass, signedMoney, signedPct } from '../../lib/format'

/** Side-by-side comparison of the trade after a win vs after a loss, plus streaks. */
export default function BehaviorCard({ afterOutcome, sizeChanges, streaks }) {
  const { afterWin, afterLoss } = afterOutcome
  const rows = [
    ['Trades', afterWin.count, afterLoss.count],
    ['Win rate', pct(afterWin.winRate), pct(afterLoss.winRate)],
    [
      'Avg P&L',
      <span key="w" className={signClass(afterWin.avgPnl)}>{signedMoney(afterWin.avgPnl)}</span>,
      <span key="l" className={signClass(afterLoss.avgPnl)}>{signedMoney(afterLoss.avgPnl)}</span>,
    ],
    ['Avg R', rFmt(afterWin.avgR), rFmt(afterLoss.avgR)],
    ['Position size vs previous', signedPct(sizeChanges.afterWin.avgChange), signedPct(sizeChanges.afterLoss.avgChange)],
    ['Sized up', pct(sizeChanges.afterWin.sizedUpShare), pct(sizeChanges.afterLoss.sizedUpShare)],
  ]

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">After a win vs after a loss</h3>
        <p className="mt-0.5 text-sm text-zinc-400">How the next trade goes. Position size is entry × size.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-400">
              <th scope="col" className="pb-2 text-left font-medium">
                <span className="sr-only">Metric</span>
              </th>
              <th scope="col" className="pb-2 text-right font-medium">After a win</th>
              <th scope="col" className="pb-2 text-right font-medium">After a loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map(([label, win, loss]) => (
              <tr key={label}>
                <th scope="row" className="py-2 text-left font-normal text-zinc-400">{label}</th>
                <td className="py-2 text-right tabular-nums text-zinc-100">{win}</td>
                <td className="py-2 text-right tabular-nums text-zinc-100">{loss}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 content-start gap-3 border-t border-zinc-800 pt-4 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <p className="text-xs text-zinc-400">Longest win streak</p>
            <p className="mt-1 text-xl font-semibold text-zinc-50">{streaks.longestWin}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Longest loss streak</p>
            <p className="mt-1 text-xl font-semibold text-zinc-50">{streaks.longestLoss}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
