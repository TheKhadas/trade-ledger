/**
 * Card wrapper for a chart. `table` is the chart's data as { columns, rows } and is
 * rendered as a collapsible table view so no value is reachable only by hovering.
 */
export default function ChartCard({ title, subtitle, children, table, className = '' }) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 ${className}`}>
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
      </header>
      {children}
      {table && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">View as table</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-400">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={`px-3 py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 text-zinc-300">
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} className={`px-3 py-1.5 tabular-nums ${i ? 'text-right' : 'text-left'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}
