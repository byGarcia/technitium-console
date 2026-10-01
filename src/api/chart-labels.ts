import type { ChartData } from './dashboard'

/*
The main chart's labels, written as upstream writes them.

Upstream asks `dashboard/stats/get` with `utc=true` (main.js:2619) and the server then
labels the chart with instants in UTC (`2026-10-01T11:29:00.0000000Z`) plus a
`labelFormat`. main.js:2673-2686 formats each one with moment:

  · `MM/DD`, `DD/MM`, `MM/YYYY` — day, month and year buckets — in UTC: the server
    groups them by UTC day, and shifting them to the viewer's zone would put a day's
    queries under the day before;
  · anything else (`HH:mm`, `MM/DD HH:00`, `MM/DD HH:mm`) in the viewer's LOCAL time.

Without `utc` the server writes the labels itself in ITS zone, which is what this
console showed until 2026-10-01: in a harness on UTC seen from Madrid, the chart's
axis ran two hours behind every other time on the screen.

Only the moment tokens the server sends are read —YYYY, MM, DD, HH, mm—; everything
else is written as it is (the `00` of `HH:00`, the `/`, the space). A label that is
not an instant —no `utc`, an older server— is left as it came, where moment would
write "Invalid date".
*/

const UTC_FORMATS = new Set(['MM/DD', 'DD/MM', 'MM/YYYY'])

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

export function formatLabel(label: string, format: string): string {
  const at = Date.parse(label)
  if (Number.isNaN(at) || !/^\d{4}-\d{2}-\d{2}T/.test(label)) return label
  const d = new Date(at)
  const utc = UTC_FORMATS.has(format)
  const parts: Record<string, string> = {
    YYYY: pad(utc ? d.getUTCFullYear() : d.getFullYear(), 4),
    MM: pad((utc ? d.getUTCMonth() : d.getMonth()) + 1),
    DD: pad(utc ? d.getUTCDate() : d.getDate()),
    HH: pad(utc ? d.getUTCHours() : d.getHours()),
    mm: pad(utc ? d.getUTCMinutes() : d.getMinutes()),
  }
  return format.replace(/YYYY|MM|DD|HH|mm/g, (token) => parts[token])
}

/** The chart with its labels formatted; a chart without `labelFormat` passes through. */
export function localiseLabels(chart: ChartData): ChartData {
  const format = chart.labelFormat
  if (format == null) return chart
  return { ...chart, labels: chart.labels.map((l) => formatLabel(l, format)) }
}
