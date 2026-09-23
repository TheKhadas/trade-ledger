import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisMoney, fmtDateTime, money, signClass, signedMoney } from '../../lib/format'
import ChartTooltip from './ChartTooltip'
import { axisProps, chart } from './theme'

/** Cumulative net P&L after each trade, with a crosshair tooltip. */
export default function EquityChart({ points, height = 280 }) {
  // Start at 0 before the first trade so the curve begins at the baseline.
  const data = [{ n: 0, equity: 0, start: true }, ...points]
  const last = points.at(-1)

  return (
    <div role="img" aria-label={`Equity curve over ${points.length} trades, ending at ${money(last?.equity ?? 0)}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis
            dataKey="n"
            type="number"
            domain={[0, points.length]}
            {...axisProps}
            tickFormatter={(n) => `#${n}`}
            allowDecimals={false}
          />
          <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={axisMoney} />
          <ReferenceLine y={0} stroke={chart.baseline} />
          <Tooltip
            cursor={{ stroke: chart.tick, strokeWidth: 1 }}
            isAnimationActive={false}
            content={
              <ChartTooltip
                render={(d) =>
                  d.start
                    ? { value: money(0), title: 'Start' }
                    : {
                        value: money(d.equity),
                        title: `After trade #${d.n} · ${fmtDateTime(d.date)}`,
                        rows: [
                          [d.symbol, <span key="p" className={signClass(d.pnl)}>{signedMoney(d.pnl)}</span>],
                          ['From peak', d.drawdown < 0 ? signedMoney(d.drawdown) : 'at peak'],
                        ],
                      }
                }
              />
            }
          />
          <Area
            type="linear"
            dataKey="equity"
            baseValue={0}
            stroke={chart.line}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={chart.line}
            fillOpacity={0.1}
            activeDot={{ r: 4, fill: chart.line, stroke: chart.surface, strokeWidth: 2 }}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
