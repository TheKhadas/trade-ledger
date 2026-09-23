# Trade Ledger — Project Spec

A trading journal web app: upload a CSV of trades, get behavioral metrics, R-multiples,
revenge-trade detection, and an AI "verdict" on your trading behavior from Claude.
Portfolio project for Khadas (GitHub: TheKhadas). Must look professional and work for
a recruiter who has no data of their own.

## Stack
- React + Vite (JavaScript, no TypeScript)
- Tailwind CSS for styling; clean dark UI
- PapaParse for CSV parsing, Recharts for charts
- Vercel serverless function at `/api/verdict` calls the Anthropic API
- Deployed on Vercel from GitHub (repo: TheKhadas/trade-ledger)

## Security rules (non-negotiable)
- The Anthropic API key lives ONLY in the `ANTHROPIC_API_KEY` env var, read by `/api/verdict`.
  Never put it in frontend code, never commit it. `.env*` must be in `.gitignore`.
- `/api/verdict` sends only computed summary metrics (not raw CSV) to Claude, caps input size,
  and has basic abuse protection (reject oversized bodies; simple per-IP rate limit).

## CSV format
Columns: `date` (ISO datetime), `symbol`, `side` (long/short), `entry`, `exit`, `stop`, `size`, `fees` (optional).
Validate rows, show clear errors for bad rows, skip them instead of crashing.

## Features
1. **Upload** — drag-and-drop CSV + a "Load sample data" button (ship `public/sample-trades.csv`, ~60 realistic trades
   that include a few revenge trades).
2. **Core metrics** — total P&L, win rate, avg win / avg loss, profit factor, expectancy, max drawdown.
3. **R-multiples** — R = (exit − entry) / (entry − stop), sign-adjusted for shorts. Show avg R and an R distribution chart.
4. **Behavioral metrics** — P&L by weekday and hour, performance after a win vs after a loss,
   longest win/loss streaks, position size changes after losses.
5. **Revenge-trade detection** — flag a trade opened within 30 min of a losing trade's close
   AND with size ≥ 1.5× the previous trade. List flagged trades and their combined P&L.
6. **Equity curve** chart.
7. **AI verdict** — button calls `/api/verdict`; Claude returns a short, blunt assessment:
   top 3 strengths, top 3 leaks, one rule to adopt next week.

## Quality bar
- Responsive (works on phone), loading and error states everywhere.
- Metric calculations live in `src/lib/metrics.js` as pure functions with unit tests (Vitest).
- README.md: screenshot, live link, features, how it's built (incl. that it was built with Claude Code), local setup.
- Small, clear commits with descriptive messages.
