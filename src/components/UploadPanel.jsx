import { useRef, useState } from 'react'
import { MAX_FILE_BYTES, OPTIONAL_COLUMNS, REQUIRED_COLUMNS } from '../lib/parseTrades'

export default function UploadPanel({ onFile, onLoadSample, loading }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState(null)

  function handleFiles(files) {
    const file = files?.[0]
    if (!file) return
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setLocalError(`"${file.name}" isn't a CSV file.`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setLocalError(`"${file.name}" is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`)
      return
    }
    setLocalError(null)
    onFile(file)
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV of trades"
        aria-disabled={loading}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!loading && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!loading) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!loading) handleFiles(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:py-16 ${
          dragging
            ? 'border-emerald-400 bg-emerald-400/5'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500'
        } ${loading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <svg className="mb-4 h-10 w-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        {loading ? (
          <p className="text-zinc-300">Parsing trades…</p>
        ) : (
          <>
            <p className="text-base font-medium text-zinc-100">
              Drop your trades CSV here <span className="text-zinc-400">or click to browse</span>
            </p>
            <p className="mt-2 text-sm text-zinc-500">CSV up to {MAX_FILE_BYTES / 1024 / 1024} MB · parsed in your browser</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = '' // allow re-selecting the same file
          }}
        />
      </div>

      {localError && (
        <p role="alert" className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {localError}
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <span className="text-sm text-zinc-500">No data handy?</span>
        <button
          type="button"
          onClick={onLoadSample}
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Load sample data
        </button>
      </div>

      <details className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
        <summary className="cursor-pointer text-zinc-300">Expected CSV format</summary>
        <p className="mt-3">
          Columns: {REQUIRED_COLUMNS.map((c) => <code key={c} className="mr-1 rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">{c}</code>)}
          and optional {OPTIONAL_COLUMNS.map((c) => <code key={c} className="mr-1 rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">{c}</code>)}.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300">
{`date,exit_date,symbol,side,entry,exit,stop,size,fees
2026-07-06T09:38:00,2026-07-06T09:54:00,SPY,long,628.26,642.93,619,10,1.00
2026-07-08T12:47:00,,MSFT,short,506.66,494.70,511.41,20,`}
        </pre>
        <p className="mt-3">
          <code className="text-zinc-200">side</code> is <code className="text-zinc-200">long</code> or{' '}
          <code className="text-zinc-200">short</code>. <code className="text-zinc-200">date</code> is when the trade
          opened; <code className="text-zinc-200">exit_date</code> is when it closed (if omitted, the open time is used).
          The stop must be below entry for longs and above entry for shorts. Invalid rows are skipped and listed.
        </p>
      </details>
    </section>
  )
}
