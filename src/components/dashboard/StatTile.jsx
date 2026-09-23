export default function StatTile({ label, value, valueClass = 'text-zinc-50', hint }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
