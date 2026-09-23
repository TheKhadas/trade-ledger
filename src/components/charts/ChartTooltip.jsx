/**
 * Tooltip shell: value first (strong), label and details after.
 * `render` receives the hovered datum and returns { title, value, rows }.
 */
export default function ChartTooltip({ active, payload, render }) {
  if (!active || !payload?.length) return null
  const { title, value, valueClass = 'text-zinc-50', rows = [] } = render(payload[0].payload)
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl">
      <p className={`text-sm font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-zinc-400">{title}</p>
      {rows.length > 0 && (
        <dl className="mt-1.5 space-y-0.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-zinc-500">{k}</dt>
              <dd className="tabular-nums text-zinc-200">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
