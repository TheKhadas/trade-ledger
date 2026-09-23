import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import RowErrors from './components/RowErrors'
import UploadPanel from './components/UploadPanel'
import { analyze } from './lib/metrics'
import { parseTradesCsv } from './lib/parseTrades'

// Charts are the bulk of the bundle; load them only once there are trades to show.
const loadDashboard = () => import('./components/dashboard/Dashboard')
const Dashboard = lazy(loadDashboard)

const EMPTY = { trades: [], rowErrors: [], fatalError: null, source: null }
const SAMPLE = 'sample-trades.csv'

// ?demo in the URL opens straight into the sample dashboard (handy for sharing).
const IS_DEMO = new URLSearchParams(window.location.search).has('demo')

async function fetchSample() {
  const res = await fetch(`/${SAMPLE}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Reads and parses a CSV into app state; never throws. */
async function readTrades(source, getText) {
  loadDashboard() // start fetching chart code in parallel with parsing
  try {
    return { ...parseTradesCsv(await getText()), source }
  } catch (err) {
    return { ...EMPTY, source, fatalError: `Couldn't read ${source}: ${err.message}` }
  }
}

export default function App() {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(IS_DEMO)

  function show(result) {
    setData(result)
    setLoading(false)
  }

  function load(source, getText) {
    setLoading(true)
    readTrades(source, getText).then(show)
  }

  const handleFile = (file) => load(file.name, () => file.text())
  const handleSample = () => load(SAMPLE, fetchSample)

  useEffect(() => {
    if (IS_DEMO) readTrades(SAMPLE, fetchSample).then(show)
  }, [])

  const hasTrades = data.trades.length > 0
  const analysis = useMemo(() => (hasTrades ? analyze(data.trades) : null), [data.trades, hasTrades])

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">Trade Ledger</span>
          </div>
          {hasTrades && (
            <button
              type="button"
              onClick={() => setData(EMPTY)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              New upload
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {!hasTrades ? (
          <>
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find the leaks in your trading.</h1>
              <p className="mt-3 text-zinc-400">
                Upload a CSV of your trades to see your R-multiples, behavioral patterns, revenge trades, and a blunt AI
                verdict.
              </p>
            </div>
            <UploadPanel onFile={handleFile} onLoadSample={handleSample} loading={loading} />
            {data.fatalError && (
              <div className="mx-auto mt-6 max-w-2xl space-y-4">
                <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                  <span className="font-medium">{data.source}:</span> {data.fatalError}
                </p>
                <RowErrors rowErrors={data.rowErrors} />
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <RowErrors rowErrors={data.rowErrors} />
            <Suspense fallback={<p className="py-16 text-center text-sm text-zinc-400">Loading dashboard…</p>}>
              <Dashboard trades={data.trades} analysis={analysis} source={data.source} />
            </Suspense>
          </div>
        )}
      </main>
    </div>
  )
}
