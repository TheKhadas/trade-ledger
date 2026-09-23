import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartTooltip from './ChartTooltip'
import { axisProps, chart } from './theme'

/** Column with a 4px rounded data-end and a square end at the zero baseline, for either sign. */
function signedBar(valueKey) {
  return function SignedBar({ x, y, width, height, fill, payload }) {
    if (!height || !width) return null
    // Height may come through negative for values below zero; normalize to top/bottom.
    const top = Math.min(y, y + height)
    const bottom = top + Math.abs(height)
    const r = Math.min(4, width / 2, bottom - top)
    const d =
      payload[valueKey] < 0
        ? `M${x},${top} V${bottom - r} Q${x},${bottom} ${x + r},${bottom} H${x + width - r} Q${x + width},${bottom} ${x + width},${bottom - r} V${top} Z`
        : `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${bottom} Z`
    return <path d={d} fill={fill} />
  }
}

/**
 * Columns colored by sign against a zero baseline (P&L by weekday / hour, R distribution).
 * data: [{ label, value, ... }]; `colorOf(d)` returns 'positive' | 'negative'.
 */
export default function SignedBarChart({
  data,
  valueKey = 'value',
  colorOf = (d) => (d[valueKey] >= 0 ? 'positive' : 'negative'),
  yTickFormatter,
  tooltip,
  height = 220,
  ariaLabel,
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={4} />
          <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={yTickFormatter} allowDecimals={false} />
          <ReferenceLine y={0} stroke={chart.baseline} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={<ChartTooltip render={tooltip} />}
            isAnimationActive={false}
          />
          <Bar dataKey={valueKey} maxBarSize={24} shape={signedBar(valueKey)} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={colorOf(d) === 'positive' ? chart.positive : chart.negative} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
