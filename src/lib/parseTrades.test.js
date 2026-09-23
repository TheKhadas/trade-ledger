import { describe, expect, it } from 'vitest'
import { parseTradesCsv } from './parseTrades'

const HEADER = 'date,exit_date,symbol,side,entry,exit,stop,size,fees'

describe('parseTradesCsv', () => {
  it('parses valid rows and normalizes headers, symbols, sides and numbers', () => {
    const { trades, rowErrors, fatalError } = parseTradesCsv(
      ` Date ,EXIT_DATE,Symbol,Side,Entry,Exit,Stop,Size,Fees
2026-07-06T10:00:00,2026-07-06T10:30:00,spy,LONG,"$1,000.50",1010,990,2,1.5
2026-07-06 09:00,,msft,short,500,490,510,5,`,
    )
    expect(fatalError).toBeNull()
    expect(rowErrors).toEqual([])
    expect(trades.map((t) => t.symbol)).toEqual(['MSFT', 'SPY']) // sorted by open time
    expect(trades[1]).toMatchObject({ side: 'long', entry: 1000.5, fees: 1.5, line: 2 })
    expect(trades[1].exitDate).toEqual(new Date(2026, 6, 6, 10, 30))
    expect(trades[0]).toMatchObject({ exitDate: null, fees: 0 })
  })

  it('skips invalid rows, reporting file line numbers and every problem', () => {
    const { trades, rowErrors } = parseTradesCsv(`${HEADER}
2026-07-06T10:00:00,,A,long,10,11,9,1,

07/06/2026,,B,long,10,11,9,1,
2026-07-06T10:00:00,,,buy,abc,11,9,-1,x
2026-07-06T10:00:00,,C,long,10,11,12,1,
2026-07-06T10:00:00,,D,short,10,9,8,1,
2026-07-06T10:00:00,2026-07-06T09:00:00,E,long,10,11,9,1,
2026-07-06T10:00:00,,F,long,10`)
    expect(trades.map((t) => t.symbol)).toEqual(['A'])
    expect(rowErrors.map((e) => e.line)).toEqual([4, 5, 6, 7, 8, 9])
    expect(rowErrors[0].messages[0]).toMatch(/not an ISO datetime/)
    expect(rowErrors[1].messages).toHaveLength(5)
    expect(rowErrors[2].messages).toEqual(['stop 12 is above entry 10 for a long'])
    expect(rowErrors[3].messages).toEqual(['stop 8 is below entry 10 for a short'])
    expect(rowErrors[4].messages[0]).toMatch(/exit_date .* is before date/)
    expect(rowErrors[5].messages).toEqual(['exit is missing', 'stop is missing', 'size is missing'])
  })

  it('accepts files without the optional columns', () => {
    const { trades } = parseTradesCsv('date,symbol,side,entry,exit,stop,size\n2026-07-06T10:00:00,A,long,10,11,9,1')
    expect(trades[0]).toMatchObject({ exitDate: null, fees: 0 })
  })

  it('returns a fatal error for missing columns, empty files and no valid rows', () => {
    expect(parseTradesCsv('date,symbol\n2026-07-06,A').fatalError).toMatch(/Missing required columns: side, entry/)
    expect(parseTradesCsv('').fatalError).toMatch(/empty/)
    expect(parseTradesCsv(`${HEADER}\n`).fatalError).toMatch(/no trades/)
    expect(parseTradesCsv(`${HEADER}\nbad,,A,long,1,1,0.5,1,`).fatalError).toMatch(/every row has errors/)
  })
})
