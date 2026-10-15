import type { ChartData } from '../../api/dashboard'
import { bucketsOf, customBuckets } from './compare'

/*
The week by hour: deviation 6 in CONVENTIONS.md, this console's own panel. Seven
days of the browser's calendar, today last, each split into its 24 hours, every
cell the queries the server counted in that hour.

What the server gives, measured against v15.6.1 (WebServiceDashboardApi.cs:345-372):
`type=Custom` is grouped by hour only while the span rounds to six days or less,
which is 157 hours at most, and 168 do not fit. So the week is asked in pieces of
whole hours, each one by hour, and stitched together:

  · each piece asks `start` = its first hour and `end` = its last hour, which by hour
    gives exactly its hours (the count is the rounded length plus one);
  · the pieces are consecutive and do not overlap, and the stitching checks it: an
    hour that comes twice or not at all leaves the panel without data rather than
    with a double count or a hole;
  · the labels are UTC instants, each the END of its hour; a cell is placed by the
    START of its hour in the browser's zone, which is where the rows and columns
    are read. In a zone a half hour off UTC, a cell is the hour starting at :30.

The hour in progress is not asked: the server counts an hour as it closes (Last
Day leaves it out for the same reason), so it would be a part shown as a whole.
*/

const HOUR = 3_600_000
export const MAX_HOURS = 157
export const DAYS = 7

/** The span the week covers: from the browser's midnight six days ago to the start
 *  of the hour in progress, both on UTC hour boundaries. */
export function weekSpan(now: number): { from: number; to: number } {
  const d = new Date(now)
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (DAYS - 1)).getTime()
  return { from: Math.floor(midnight / HOUR) * HOUR, to: Math.floor(now / HOUR) * HOUR }
}

/** The requests that cover `[from, to)` by hour, in as few even pieces as fit.
 *  `null` when a piece would not come back by hour. */
export function hourRequests(from: number, to: number): { start: string; end: string }[] | null {
  const hours = Math.round((to - from) / HOUR)
  if (hours <= 0) return []
  const pieces = Math.ceil(hours / MAX_HOURS)
  const size = Math.ceil(hours / pieces)
  const out: { start: string; end: string }[] = []
  for (let first = 0; first < hours; first += size) {
    const n = Math.min(size, hours - first)
    const start = from + first * HOUR
    const end = start + (n - 1) * HOUR
    const got = customBuckets(start, end)
    if (got.unit !== 'hour' || got.from !== start || got.count !== n) return null
    out.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() })
  }
  return out
}

/** Each hour of `[from, to)` by its start, with its `Total`. `null` if any hour is
 *  missing or comes twice. */
export function stitchHours(charts: ChartData[], from: number, to: number): Map<number, number> | null {
  const out = new Map<number, number>()
  for (const chart of charts) {
    const b = bucketsOf(chart)
    if (b == null || b.unit !== 'hour') return null
    const total = chart.datasets.find((d) => d.label === 'Total')?.data ?? []
    for (const [i, bucket] of b.buckets.entries()) {
      if (bucket.from < from || bucket.to > to) continue
      if (out.has(bucket.from)) return null
      const v = Number(total[i])
      if (!Number.isFinite(v)) return null
      out.set(bucket.from, v)
    }
  }
  for (let at = from; at < to; at += HOUR) if (!out.has(at)) return null
  return out
}

export interface HeatCell {
  /** The hour's start, or the first of two when a clock change folds two into one. */
  from: number
  to: number
  count: number
}

export interface HeatRow {
  /** The browser's midnight of that day. */
  day: number
  label: string
  short: string
  /** 24 cells, by the browser's hour; `null` where there is no hour to show (later
   *  today, or an hour a clock change skipped). */
  cells: (HeatCell | null)[]
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')

/** A day as a cell names it: OUR words, the weekday in English and the date as the
 *  server's `MM/DD`. */
export function dayLabel(day: number): string {
  const d = new Date(day)
  return `${WEEKDAY[d.getDay()]} ${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

/** A day as its row heads it, short enough for 390 px: the weekday and the day. */
export function dayShort(day: number): string {
  const d = new Date(day)
  return `${WEEKDAY[d.getDay()]} ${pad(d.getDate())}`
}

/** The hours laid out by the browser's day and hour, today last. */
export function heatRows(hours: Map<number, number>, now: number): HeatRow[] {
  const today = new Date(now)
  const rows: HeatRow[] = []
  for (let back = DAYS - 1; back >= 0; back--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back).getTime()
    rows.push({ day, label: dayLabel(day), short: dayShort(day), cells: Array.from({ length: 24 }, () => null) })
  }
  const byDay = new Map(rows.map((r) => [r.day, r]))
  for (const [from, count] of [...hours.entries()].sort((a, b) => a[0] - b[0])) {
    const d = new Date(from)
    const row = byDay.get(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
    if (row == null) continue
    const cell = row.cells[d.getHours()]
    row.cells[d.getHours()] = cell == null
      ? { from, to: from + HOUR, count }
      : { from: cell.from, to: from + HOUR, count: cell.count + count }
  }
  return rows
}

/** A cell's shade, 0 for none and 1 to 5 by its share of the busiest hour. */
export function level(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  return Math.min(5, Math.max(1, Math.ceil((count / max) * 5)))
}
