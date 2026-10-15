import type { ChartData } from '../../api/dashboard'
import { PROTOCOLS, RESPONSE_TYPES } from '../../api/logs'
import type { QueryLogsFilters } from '../../app/handoff'
import { bucketsOf, type Window } from './compare'

/*
From a Dashboard chart to Query Logs: deviation 6 in CONVENTIONS.md, this console's
own. The jump is the one the Top lists' row menus already make (`showQueryLogs`,
logs.js:624-655): Query Logs opens with its form reset, these fields filled in and
the query run, and with no query-logging app installed it says so exactly as it
does from a row menu. What a chart adds is only which fields are filled:

  · a point of the Queries chart: `From` and `To`, the minute, hour, day or month
    that point counts;
  · a slice or a bar: the value, where Query Logs has a field for it, and the
    period the chart counts, so the list answers for the same span.

`From` and `To` are `datetime-local` fields, read in the browser's zone (`toIso`,
logs/dates.ts), so the instants are written in that zone. Query Logs keeps both
ends (`timestamp >= start` and `<= end`, QueryLogsSqliteApp/App.cs:588-591), so
`To` is the last second of the span, not the first of the next one.
*/

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** An instant as a `datetime-local` value in the browser's zone, to the second. */
export function localInput(at: number): string {
  const d = new Date(at)
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** `From` and `To` for a span `[from, to)`. */
export function spanFilters(from: number, to: number): QueryLogsFilters {
  return { start: localInput(from), end: localInput(to - 1000) }
}

/** The span a point of the main chart counts, or `null` when its labels are not
 *  instants (an older server). */
export function bucketWindow(chart: ChartData | undefined, index: number): QueryLogsFilters | null {
  const b = bucketsOf(chart)?.buckets[index]
  return b != null ? spanFilters(b.from, b.to) : null
}

/** The whole period a chart counts. */
export function periodFilters(w: Window | null): QueryLogsFilters {
  return w != null ? spanFilters(w.from, w.to) : {}
}

/*
Which slice or bar has a field to land in. Query Logs filters ONE response type, so
`Blocked` lands on `Blocked`, while the slice also counts the two upstream-blocked
types (StatsManager.cs:329-341): Query Logs lists those under their own names.
`Dropped` has no response type there, and `Others`, the rest of Query Types, is not
a type: neither offers the jump.
*/
export function responseTypeFilter(label: string): string | null {
  return RESPONSE_TYPES.some((r) => r.value !== '' && r.value === label) ? label : null
}

export function protocolFilter(label: string): string | null {
  return PROTOCOLS.some((p) => p.value !== '' && p.value === label) ? label : null
}

export function queryTypeFilter(label: string): string | null {
  return label !== '' && label !== 'Others' ? label : null
}
