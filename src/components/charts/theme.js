// Chart tokens for the dark surface (card bg #18181b). Validated with the dataviz
// palette checker: positive/negative pair passes CVD separation (ΔE 19.2) and
// contrast; green/red was rejected because it collapses under deuteranopia.
export const chart = {
  surface: '#18181b',
  positive: '#3987e5',
  negative: '#e66767',
  line: '#3987e5',
  grid: '#27272a',
  baseline: '#3f3f46',
  tick: '#a1a1aa',
}

export const axisProps = {
  stroke: chart.baseline,
  tick: { fill: chart.tick, fontSize: 12 },
  tickLine: false,
}
