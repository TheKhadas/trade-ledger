# CSV format

Trade Ledger reads one closed trade per row. Parsing and validation live in
[`src/lib/parseTrades.js`](../src/lib/parseTrades.js) and run entirely in the browser.

## Columns

| Column | Required | Type | Rules |
| --- | --- | --- | --- |
| `date` | yes | ISO datetime | When the trade **opened**. |
| `exit_date` | no | ISO datetime | When it **closed**. Must not be before `date`. Leave blank if unknown. |
| `symbol` | yes | text | Upper-cased on import (`spy` → `SPY`). |
| `side` | yes | `long` / `short` | Case-insensitive. |
| `entry` | yes | number > 0 | Entry price. |
| `exit` | yes | number > 0 | Exit price. |
| `stop` | yes | number > 0 | Initial stop. Must be **below** entry for longs and **above** entry for shorts. |
| `size` | yes | number > 0 | Quantity (shares, contracts, units). Fractions are allowed. |
| `fees` | no | number ≥ 0 | Total fees for the round trip; subtracted from P&L. Blank = 0. |

- **Headers** are matched case-insensitively and trimmed: ` Date ` and `DATE` both work. Column order doesn't matter,
  and extra columns are ignored.
- **Numbers** may include `$` and thousands separators: `"$1,000.50"` reads as `1000.5`. Quote values that contain
  commas.
- **Dates** use the form `YYYY-MM-DD`, optionally followed by `T` or a space, then `HH:MM` or `HH:MM:SS` (fractional
  seconds allowed), then optionally `Z` or an offset such as `+02:00`. Without an offset, times are local.
  `2026-07-06`, `2026-07-06 09:38` and `2026-07-06T09:38:00Z` are all valid; `07/06/2026` is not.

## Example

```csv
date,exit_date,symbol,side,entry,exit,stop,size,fees
2026-07-06T09:38:00,2026-07-06T09:54:00,SPY,long,628.26,642.93,619,10,1.00
2026-07-08T12:47:00,,MSFT,short,506.66,494.70,511.41,20,
```

## Validation behavior

**Row-level problems** skip the row and list it under "Skipped N invalid rows" with its file line number (the header
is line 1). Every problem in a row is reported, not only the first:

| Problem | Message |
| --- | --- |
| Missing value | `entry is missing` |
| Bad date | `date "07/06/2026" is not an ISO datetime (e.g. 2026-07-06T09:38:00)` |
| Close before open | `exit_date 2026-07-06T09:00:00 is before date 2026-07-06T10:00:00` |
| Bad side | `side "buy" must be "long" or "short"` |
| Non-positive or non-numeric | `size "-1" must be a positive number` |
| Bad fees | `fees "x" must be zero or a positive number` |
| Stop on the wrong side | `stop 105 is above entry 100 for a long` |
| Zero risk | `stop equals entry (risk would be zero)` |

Completely blank lines are ignored and don't shift line numbers.

**File-level problems** stop the upload with a clear message:

- The file isn't a `.csv` or is larger than 5 MB (checked before reading).
- A required column is missing: `Missing required columns: side, entry. Expected: date, symbol, …`.
- The file is empty, has only a header, or every row is invalid.

After import, valid trades are sorted by `date` (ties keep file order).
