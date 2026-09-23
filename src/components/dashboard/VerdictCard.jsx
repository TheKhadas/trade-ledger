import { useRef, useState } from 'react'
import { buildVerdictPayload } from '../../lib/verdictPayload'

const TIMEOUT_MS = 70_000

async function requestVerdict(payload, signal) {
  let res
  try {
    res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Claude took too long to answer. Try again.')
    throw new Error("Couldn't reach the server. Check your connection and try again.")
  }
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.verdict) throw new Error(body?.error ?? `The AI verdict failed (HTTP ${res.status}).`)
  return body.verdict
}

function PointList({ title, points, tone }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</h4>
      <ol className="space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tone}`}
            >
              {i + 1}
            </span>
            <p className="text-sm">
              <span className="font-medium text-zinc-100">{p.title}.</span>{' '}
              <span className="text-zinc-400">{p.detail}</span>
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function VerdictCard({ analysis, trades }) {
  const [state, setState] = useState({ status: 'idle' })
  const inFlight = useRef(null)

  async function run() {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    setState((s) => ({ status: 'loading', verdict: s.verdict }))
    try {
      const verdict = await requestVerdict(buildVerdictPayload(analysis, trades), controller.signal)
      setState({ status: 'done', verdict })
    } catch (err) {
      setState((s) => ({ status: 'error', error: err.message, verdict: s.verdict }))
    } finally {
      clearTimeout(timer)
    }
  }

  const { status, verdict, error } = state
  const loading = status === 'loading'

  return (
    <section aria-live="polite" className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">AI verdict</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            A blunt read from Claude. Only summary stats are sent, never your individual trades.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-wait disabled:opacity-70 ${
            verdict
              ? 'border border-zinc-700 text-zinc-200 hover:border-zinc-500'
              : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
          }`}
        >
          {loading && (
            <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {loading ? 'Analyzing…' : verdict ? 'Ask again' : 'Get AI verdict'}
        </button>
      </header>

      {status === 'error' && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && !verdict && (
        <div className="mt-5 space-y-3" aria-label="Loading verdict">
          {[80, 95, 70, 88].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-zinc-800" style={{ width: `${w}%` }} />
          ))}
          <p className="text-xs text-zinc-500">Usually takes 10–30 seconds.</p>
        </div>
      )}

      {verdict && (
        <div className={`mt-5 space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <p className="text-lg font-medium leading-snug text-zinc-50">{verdict.headline}</p>
          <div className="grid gap-6 md:grid-cols-2">
            <PointList title="Strengths" points={verdict.strengths} tone="bg-emerald-500/15 text-emerald-300" />
            <PointList title="Leaks" points={verdict.leaks} tone="bg-rose-500/15 text-rose-300" />
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-emerald-300">Your rule for next week</h4>
            <p className="mt-1 font-medium text-zinc-50">{verdict.rule.rule}</p>
            <p className="mt-1 text-sm text-zinc-400">{verdict.rule.why}</p>
          </div>
        </div>
      )}
    </section>
  )
}
