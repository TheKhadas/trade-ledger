import { useState } from 'react'
import RowErrors from './components/RowErrors'
import TradesTable from './components/TradesTable'
import UploadPanel from './components/UploadPanel'
import { parseTradesCsv } from './lib/parseTrades'

const EMPTY = { trades: [], rowErrors: [], fatalError: null, source: null }

export default function App() {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  async function load(source, getText) {
    setLoading(true)
    try {
      const text = await getText()
      setData({ ...parseTradesCsv(text), source })
    } catch (err) {
      setData({ ...EMPTY, source, fatalError: `Couldn't read ${source}: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const handleFile = (file) => load(file.name, () => file.text())

  const handleSample = () =>
    load('sample-trades.csv', async () => {
      const res = await fetch('/sample-trades.csv')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.text()
    })

  const hasTrades = data.trades.length > 0

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
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">
                {data.trades.length} trade{data.trades.length === 1 ? '' : 's'}
              </h2>
              <p className="text-sm text-zinc-400">from {data.source}</p>
            </div>
            <RowErrors rowErrors={data.rowErrors} />
            <TradesTable trades={data.trades} />
          </div>
        )}
      </main>
    </div>
  )
}
