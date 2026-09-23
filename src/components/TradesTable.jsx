import { rFmt, signClass, signedMoney } from '../lib/format'
import { rMultiple, tradePnl } from '../lib/metrics'

const price = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

// Show just the time when a trade closes on the day it opened.
function formatClose(open, close) {
  if (!close) return '—'
  return open.toDateString() === close.toDateString() ? timeFmt.format(close) : dateFmt.format(close)
}

const COLUMNS = [
  { key: 'date', label: 'Opened', align: 'left' },
  { key: 'exitDate', label: 'Closed', align: 'left' },
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'side', label: 'Side', align: 'left' },
  { key: 'entry', label: 'Entry', align: 'right' },
  { key: 'exit', label: 'Exit', align: 'right' },
  { key: 'stop', label: 'Stop', align: 'right' },
  { key: 'size', label: 'Size', align: 'right' },
  { key: 'fees', label: 'Fees', align: 'right' },
  { key: 'pnl', label: 'Net P&L', align: 'right' },
  { key: 'r', label: 'R', align: 'right' },
]

export default function TradesTable({ trades, revengeIds = new Set() }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full min-w-[58rem] text-sm">
          <thead className="sticky top-0 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">#</th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={`px-3 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {trades.map((t, i) => {
              const pnl = tradePnl(t)
              const revenge = revengeIds.has(t.id)
              return (
                <tr key={t.id} className="hover:bg-zinc-900/60">
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{i + 1}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-300">{dateFmt.format(t.date)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-400">{formatClose(t.date, t.exitDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-100">
                    {t.symbol}
                    {revenge && (
                      <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                        Revenge
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-medium uppercase text-zinc-300">
                      {t.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{price.format(t.entry)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{price.format(t.exit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{price.format(t.stop)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{qty.format(t.size)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{t.fees ? money.format(t.fees) : '—'}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums ${signClass(pnl)}`}>{signedMoney(pnl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{rFmt(rMultiple(t))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
