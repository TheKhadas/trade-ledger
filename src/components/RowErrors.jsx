const MAX_SHOWN = 50

export default function RowErrors({ rowErrors }) {
  if (!rowErrors.length) return null
  const shown = rowErrors.slice(0, MAX_SHOWN)

  return (
    <details className="rounded-xl border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm" open={rowErrors.length <= 5}>
      <summary className="cursor-pointer font-medium text-amber-300">
        Skipped {rowErrors.length} invalid row{rowErrors.length === 1 ? '' : 's'}
      </summary>
      <ul className="mt-3 space-y-1.5 text-amber-100/80">
        {shown.map(({ line, messages }) => (
          <li key={line}>
            <span className="mr-2 font-mono text-amber-400">Line {line}:</span>
            {messages.join('; ')}
          </li>
        ))}
      </ul>
      {rowErrors.length > MAX_SHOWN && (
        <p className="mt-2 text-amber-200/60">…and {rowErrors.length - MAX_SHOWN} more.</p>
      )}
    </details>
  )
}
