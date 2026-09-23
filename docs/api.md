# `POST /api/verdict`

Returns Claude's assessment of a trader's summary metrics: a headline, three strengths, three leaks, and one rule for
next week. Implemented in [`server/verdict.js`](../server/verdict.js), deployed by
[`api/verdict.js`](../api/verdict.js) as a Vercel function.

## Request

```http
POST /api/verdict
Content-Type: application/json
```

### Request body

The body is the summary produced by `buildVerdictPayload(analysis, trades)` in
[`src/lib/verdictPayload.js`](../src/lib/verdictPayload.js). It holds only computed metrics, never trades, prices or
CSV text, and is about 1.7 KB for the sample data.

```jsonc
{
  "tradeCount": 60,                          // integer ≥ 1
  "firstDate": "2026-07-06",                 // YYYY-MM-DD
  "lastDate": "2026-08-11",
  "core": {
    "totalPnl": 1435.25, "winRate": 0.467,   // rates are fractions 0–1
    "avgWin": 133.09, "avgLoss": -71.6,
    "profitFactor": 1.63,                    // null when there are no losses
    "expectancy": 23.92, "maxDrawdown": 509.15
  },
  "r": {
    "avgR": 0.33, "bestR": 2.69, "worstR": -1.39,
    "distribution": [{ "from": -2, "to": -1.5, "count": 0 }]          // ≤ 40 bins
  },
  "byWeekday": [{ "day": "Mon", "pnl": 645.7, "count": 9, "winRate": 0.667 }],   // ≤ 7
  "byHour":    [{ "hour": 9, "pnl": 399.7, "count": 15, "winRate": 0.467 }],     // ≤ 24
  "afterWin":  { "count": 28, "winRate": 0.536, "avgPnl": 40.44, "avgR": 0.56,
                 "avgChange": 0.107, "sizedUpShare": 0.321 },
  "afterLoss": { "count": 31, "winRate": 0.387, "avgPnl": 5.07, "avgR": 0.08,
                 "avgChange": 0.171, "sizedUpShare": 0.581 },
  "streaks": { "longestWin": 6, "longestLoss": 5 },
  "revenge": {
    "count": 4, "totalPnl": -364.65,
    "trades": [{ "symbol": "AMZN", "minutesAfter": 5, "sizeRatio": 2.25, "pnl": -121.5 }]  // ≤ 10
  }
}
```

### Server-side validation

`sanitizeVerdictPayload` rebuilds the object from known fields only:

- Every number must be finite and within a sane range: rates in 0–1, hours 0–23, integer counts, and money values
  within ±1e9.
- Arrays have maximum lengths (shown above).
- The only strings accepted are weekday names (`Sun`–`Sat`), `YYYY-MM-DD` dates, and ticker-shaped symbols matching
  `^[A-Z0-9.\-/:^=]{1,12}$`.
- Unknown fields are silently dropped. Anything malformed is rejected with a 400 that names the field, for example
  `Invalid metrics: revenge.trades[0].symbol is not a valid symbol`.

The sanitized object is what Claude receives, inside `<metrics>` tags that the system prompt marks as data.

## Response

### 200 OK

```json
{
  "verdict": {
    "headline": "A genuinely profitable edge ... leaking roughly a quarter of its profit to post-loss tilt ...",
    "strengths": [{ "title": "Winners are much bigger than losers", "detail": "Avg win $133.09 vs avg loss ..." }],
    "leaks":     [{ "title": "Revenge trades", "detail": "4 trades opened 2-5 minutes after a loss ..." }],
    "rule": { "rule": "After any losing trade, stop for 30 minutes ...", "why": "Your four sub-30-minute ..." }
  },
  "model": "claude-opus-5"
}
```

`strengths` and `leaks` hold up to three items each. All fields are plain text. The client renders them as text, never
as HTML.

### Errors

Every error has the body `{ "error": "<message safe to show a visitor>" }`. Checks run in this order:

| Status | When | Counts against rate limit |
| --- | --- | --- |
| 405 | Method isn't `POST` (header `Allow: POST`) | no |
| 413 | `Content-Length` over 16 KB | no |
| 415 | `Content-Type` isn't `application/json` | no |
| 429 | Rate limit hit (header `Retry-After: <seconds>`) | n/a |
| 413 | Body exceeds 16 KB while reading (missing or wrong `Content-Length`) | yes |
| 400 | Body isn't valid JSON, or fails validation | yes |
| 503 | `ANTHROPIC_API_KEY` missing or rejected, or Anthropic is rate-limited or overloaded | yes |
| 502 | Connection failure, other API error, refusal, truncated or malformed model output | yes |

Upstream error details are logged server-side and never returned to the client. All responses send
`Cache-Control: no-store`.

## Limits

| Limit | Value | Where |
| --- | --- | --- |
| Request body | 16 KB, enforced while streaming | `MAX_BODY_BYTES` in `server/verdict.js` |
| Per-IP rate | 5 requests per 10 minutes | `createRateLimiter` defaults |
| Global rate | 200 requests per 10 minutes, per function instance | `createRateLimiter` defaults |
| Anthropic call | 55 s timeout, 1 retry | `api/verdict.js` |
| Function duration | 60 s | `vercel.json` |
| Client wait | 70 s, then "Claude took too long" | `VerdictCard.jsx` |

The client IP is the first entry of `X-Forwarded-For`, falling back to `X-Real-IP`. Rate limits live in memory, so
each function instance counts separately and a cold start resets them. They are a speed bump, not a quota: set a
monthly spend limit in the Anthropic Console for real cost control.

## Model call

| Setting | Value | Why |
| --- | --- | --- |
| Model | `claude-opus-5` | |
| Endpoint | `client.beta.messages.create` | Needed for `fallbacks` |
| Output | `output_config.format` JSON schema (`VERDICT_SCHEMA`) | Guarantees parseable, well-shaped output |
| Effort | `medium` | A short answer from pre-computed stats; keeps latency around 15 s |
| Refusal fallback | `fallbacks: "default"` with beta `server-side-fallback-2026-07-01` | If a safety classifier declines, Anthropic retries on its recommended fallback model |
| `max_tokens` | 16,000 | Room for adaptive thinking plus the answer |

The system prompt asks for a direct, specific assessment that cites the supporting numbers, with no generic advice or
disclaimers, and asks the model to note a small sample in the headline. Even with the schema, the server validates the
response shape, trims lists to three items, and treats `refusal` and `max_tokens` stop reasons as errors.

## Security summary

- The API key is read only from `process.env.ANTHROPIC_API_KEY` inside the function. It is not prefixed `VITE_`, so
  Vite never bundles it, and `.env*` files are gitignored.
- Raw trades never leave the browser; Claude sees a validated summary with no free-form text.
- Oversized bodies, wrong methods and wrong content types are rejected before any work is done, and repeat callers
  are rate-limited.
