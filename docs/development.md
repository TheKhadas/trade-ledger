# Development

## Setup

Requires Node.js 20.19+ or 22.12+ (Vite 8).

```bash
git clone https://github.com/TheKhadas/trade-ledger.git
cd trade-ledger
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY to use the AI verdict locally
npm run dev                  # http://localhost:5173
```

Open `http://localhost:5173/?demo` to jump straight to the dashboard with the sample data.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload; also serves `/api/verdict` |
| `npm test` | Run all Vitest suites once |
| `npx vitest` | Run tests in watch mode |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build (no API route) |

## Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `api/verdict.js` only | Server-side. Put it in `.env.local` locally and in Vercel project settings in production. **Never** prefix it with `VITE_`, which would ship it to the browser. |

Without a key, everything works except the AI verdict, which returns "not configured on this server".

## The API route in local dev

Vercel serves `api/verdict.js` in production. Locally, a small plugin in `vite.config.js` mounts the same module at
`/api/verdict`: it converts the Node request into a standard `Request`, calls the exported `POST`, and writes the
`Response` back. It loads `ANTHROPIC_API_KEY` from `.env.local` into the dev server process only. Edits to
`server/verdict.js` take effect on the next request, with no restart needed.

The rate limiter (5 verdicts per 10 minutes per IP) also applies in dev. Restart `npm run dev` to reset it.

## Tests

Tests run in Node with Vitest and sit next to the code they cover:

| File | Covers |
| --- | --- |
| `src/lib/parseTrades.test.js` | Header normalization, number and date parsing, every row error, line numbers, fatal errors |
| `src/lib/metrics.test.js` | Every metric against hand-computed fixtures, edge cases (no trades, breakeven, boundaries), and the patterns planted in the sample data |
| `src/lib/verdictPayload.test.js` | The payload builder and the server-side validator, including prompt-injection attempts |
| `server/verdict.test.js` | The handler end to end with a fake Anthropic client: success, every error status, size cap on streamed bodies, error mapping, refusals, malformed output; plus the rate limiter and IP extraction |

The handler tests make no network calls, and nothing in the suite needs an API key.

## Sample data

`public/sample-trades.csv` holds 60 trades from 6 Jul to 11 Aug 2026 across 9 US tickers, with realistic prices,
hold times of 6–50 minutes, and fees on most rows. It was generated with a seeded script, then tuned so the demo
tells a clear story:

- Net profitable (+$1,435), with a 47% win rate and bigger winners than losers.
- Four revenge trades, each opened 2–5 minutes after a loss at 2–2.4× size; three lose, for −$365 combined.
- Worse results after losses than after wins, with positions sized up more often after losses.
- Thursday and Friday net negative.

`metrics.test.js` asserts the core of this story (60 clean rows, net profitable, 28/60 win rate, the four revenge
trades with three losers), so an edit to the sample that breaks the demo fails the tests.

## Deployment

The app deploys to Vercel from the `main` branch of `TheKhadas/trade-ledger`. Every push redeploys automatically.

1. Import the repo at [vercel.com/new](https://vercel.com/new). The Vite preset and defaults are correct.
2. Add `ANTHROPIC_API_KEY` under **Project → Settings → Environment Variables**.
3. Set a monthly spend limit in the Anthropic Console.

`api/verdict.js` becomes a Node.js function with a 60 s limit (`vercel.json`). Everything else is served as static
files from `dist/`.

## Conventions

- JavaScript (no TypeScript), React function components, Tailwind utility classes.
- Metric logic belongs in `src/lib/metrics.js` as pure functions with tests. Components only format and display.
- Chart colors come from `src/components/charts/theme.js`. Keep positive/negative as the validated blue/red pair.
- Small, descriptive commits.
