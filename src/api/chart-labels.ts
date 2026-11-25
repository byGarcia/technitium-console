import type { ChartData } from './dashboard'
import { getTimezone, type SupportedTimezone } from '../lib/timezone'

/*
The main chart's labels, written as upstream writes them, respecting the active display timezone.

Upstream asks `dashboard/stats/get` with `utc=true` (main.js:2619) and the server then
labels the chart with instants in UTC (`2026-10-01T11:29:00.0000000Z`) plus a
`labelFormat`. main.js:2673-2686 formats each one with moment:

  · `MM/DD`, `DD/MM`, `MM/YYYY` (day, month and year buckets) in UTC: the server
    groups them by UTC day, and shifting them to the viewer's zone would put a day's
    queries under the day before;
  · anything else (`HH:mm`, `MM/DD HH:00`, `MM/DD HH:mm`) in the active display timezone.

Without `utc` the server writes the labels itself in ITS zone, which is what this
console showed until 2026-10-01: in a harness on UTC seen from Madrid, the chart's
axis ran two hours behind every other time on the screen.

Only the moment tokens the server sends are read (YYYY, MM, DD, HH, mm); everything
else is written as it is (the `00` of `HH:00`, the `/`, the space). A label that is
not an instant (no `utc`, an older server) is left as it came, where moment would
write "Invalid date".
*/

const UTC_FORMATS = new Set(['MM/DD', 'DD/MM', 'MM/YYYY'])

const pad = (n: number, width = 2) => String(n).padStart(width, '0')
const pad4 = (n: number) => (n < 0 ? `-${String(Math.abs(n)).padStart(4, '0')}` : String(n).padStart(4, '0'))

const LABEL_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function getLabelFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = LABEL_FORMATTERS.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      era: 'short',
    })
    LABEL_FORMATTERS.set(tz, fmt)
  }
  return fmt
}

export function formatLabel(label: string, format: string, tz?: SupportedTimezone): string {
  const at = Date.parse(label)
  if (Number.isNaN(at) || !/^[+-]?\d{4,6}-\d{2}-\d{2}T/.test(label)) return label
  const d = new Date(at)
  const utc = UTC_FORMATS.has(format)
  const resolvedTz = tz ?? getTimezone()

  let parts: Record<string, string>

  if (utc || resolvedTz === 'UTC') {
    parts = {
      YYYY: pad4(d.getUTCFullYear()),
      MM: pad(d.getUTCMonth() + 1),
      DD: pad(d.getUTCDate()),
      HH: pad(d.getUTCHours()),
      mm: pad(d.getUTCMinutes()),
    }
  } else if (resolvedTz === 'local') {
    parts = {
      YYYY: pad4(d.getFullYear()),
      MM: pad(d.getMonth() + 1),
      DD: pad(d.getDate()),
      HH: pad(d.getHours()),
      mm: pad(d.getMinutes()),
    }
  } else {
    try {
      const p = getLabelFormatter(resolvedTz).formatToParts(d)
      let y = 0, month = '', day = '', hour = '', minute = '', period = ''
      for (const x of p) {
        if (x.type === 'year') y = parseInt(x.value, 10)
        else if (x.type === 'month') month = x.value
        else if (x.type === 'day') day = x.value
        else if (x.type === 'hour') hour = x.value
        else if (x.type === 'minute') minute = x.value
        else if (x.type === 'era') period = x.value
      }
      if (period.includes('B') || period.toLowerCase().includes('bc')) y = 1 - y
      parts = {
        YYYY: pad4(y),
        MM: month.padStart(2, '0'),
        DD: day.padStart(2, '0'),
        HH: hour.padStart(2, '0'),
        mm: minute.padStart(2, '0'),
      }
    } catch {
      parts = {
        YYYY: pad4(d.getFullYear()),
        MM: pad(d.getMonth() + 1),
        DD: pad(d.getDate()),
        HH: pad(d.getHours()),
        mm: pad(d.getMinutes()),
      }
    }
  }

  return format.replace(/YYYY|MM|DD|HH|mm/g, (token) => parts[token])
}

/** The chart with its labels formatted; a chart without `labelFormat` passes through. */
export function localiseLabels(chart: ChartData, tz?: SupportedTimezone): ChartData {
  const format = chart.labelFormat
  if (format == null) return chart
  /* Keep the original instants if the chart is formatted again. A legacy label
     such as "09/30" can be parsed as a date, but is not a server UTC boundary. */
  const instants = chart.instants ?? (
    chart.labels.every((l) => /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(l) && Number.isFinite(Date.parse(l)))
      ? chart.labels
      : undefined
  )
  const sourceLabels = instants ?? chart.labels
  return { ...chart, labels: sourceLabels.map((l) => formatLabel(l, format, tz)), ...(instants != null ? { instants } : {}) }
}
