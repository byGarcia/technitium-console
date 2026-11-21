import type { ChartData } from '../../api/dashboard'
import { bucketsOf, customBuckets } from './compare'
import { getTimezone, type SupportedTimezone } from '../../lib/timezone'

/*
The week by hour: deviation 7 in CONVENTIONS.md, this console's own panel. Seven
days of the calendar in the active display timezone, today last, each split into its 24 hours,
every cell the queries the server counted in that hour.

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
    START of its hour in the active display timezone, which is where the rows and columns
    are read. In a zone a half hour off UTC, a cell is the hour starting at :30.

The hour in progress is not asked. Last Day leaves it out, and Custom gives it only
as far as it has gone (checked against v15.6.2 on 2026-11-20); the week is asked once
an hour, so that figure would be a part shown as a whole and fall behind within
minutes. Its cell is marked as running instead (`HeatRow.live`), with no figure, so a
busy Last Hour does not sit beside an hour that looks empty.
*/

const HOUR = 3_600_000
const DAY = 86_400_000
export const MAX_HOURS = 157
export const DAYS = 7

const pad = (n: number) => String(n).padStart(2, '0')

function getDatePartsInTz(epochMs: number, tz: SupportedTimezone): {
  dateKey: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
} {
  const d = new Date(epochMs)
  if (tz === 'local') {
    return {
      dateKey: `${pad(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      weekday: d.getDay(),
    }
  }
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = fmt.formatToParts(d)
    const y = Number(parts.find((p) => p.type === 'year')?.value ?? d.getUTCFullYear())
    const m = Number(parts.find((p) => p.type === 'month')?.value ?? d.getUTCMonth() + 1)
    const day = Number(parts.find((p) => p.type === 'day')?.value ?? d.getUTCDate())
    const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? d.getUTCHours())
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? d.getUTCMinutes())
    const wFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    const wStr = wFmt.format(d)
    const wIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wStr)
    return {
      dateKey: `${pad(y)}-${pad(m)}-${pad(day)}`,
      year: y,
      month: m,
      day,
      hour: hr,
      minute: min,
      weekday: wIdx >= 0 ? wIdx : d.getUTCDay(),
    }
  } catch {
    return {
      dateKey: `${pad(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      weekday: d.getDay(),
    }
  }
}

/** The span the week covers: from midnight six days ago in the active timezone to the start
 *  of the hour in progress, both on UTC hour boundaries. */
export function weekSpan(now: number, tz?: SupportedTimezone): { from: number; to: number } {
  const resolvedTz = tz ?? getTimezone()
  if (resolvedTz === 'local') {
    const today = new Date(now)
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1)).getTime()
    return { from: Math.floor(midnight / HOUR) * HOUR, to: Math.floor(now / HOUR) * HOUR }
  }
  const p = getDatePartsInTz(now, resolvedTz)
  const elapsedToday = (p.hour * 3600 + p.minute * 60) * 1000 + (now % 60000)
  const todayMidnightInTz = now - elapsedToday
  const sixDaysAgoMidnight = todayMidnightInTz - (DAYS - 1) * DAY
  return { from: Math.floor(sixDaysAgoMidnight / HOUR) * HOUR, to: Math.floor(now / HOUR) * HOUR }
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
  /** The midnight of that day in the active timezone (or day index). */
  day: number
  label: string
  short: string
  dateKey?: string
  /** 24 cells, by the active timezone's hour; `null` where there is no hour to show (later
   *  today, or an hour a clock change skipped). */
  cells: (HeatCell | null)[]
  /** The browser's hour of the hour in progress, on today's row; `null` elsewhere,
   *  and where a clock change folds it into an hour already counted. */
  live: number | null
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

/** The hours laid out by the active timezone's day and hour, today last. */
export function heatRows(hours: Map<number, number>, now: number, tz?: SupportedTimezone): HeatRow[] {
  const resolvedTz = tz ?? getTimezone()
  const rows: HeatRow[] = []

  if (resolvedTz === 'local') {
    const today = new Date(now)
    for (let back = DAYS - 1; back >= 0; back--) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back).getTime()
      rows.push({ day, label: dayLabel(day), short: dayShort(day), cells: Array.from({ length: 24 }, () => null), live: null })
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
    const running = new Date(weekSpan(now, 'local').to)
    const todayRow = byDay.get(new Date(running.getFullYear(), running.getMonth(), running.getDate()).getTime())
    if (todayRow != null && todayRow.cells[running.getHours()] == null) todayRow.live = running.getHours()
    return rows
  }

  // Timezone-aware 7-day row generation
  for (let back = DAYS - 1; back >= 0; back--) {
    const instant = now - back * DAY
    const p = getDatePartsInTz(instant, resolvedTz)
    const label = `${WEEKDAY[p.weekday]} ${pad(p.month)}/${pad(p.day)}`
    const short = `${WEEKDAY[p.weekday]} ${pad(p.day)}`
    rows.push({
      day: instant,
      label,
      short,
      dateKey: p.dateKey,
      cells: Array.from({ length: 24 }, () => null),
      live: null,
    })
  }

  const byDateKey = new Map(rows.map((r) => [r.dateKey!, r]))

  for (const [from, count] of [...hours.entries()].sort((a, b) => a[0] - b[0])) {
    const p = getDatePartsInTz(from, resolvedTz)
    const row = byDateKey.get(p.dateKey)
    if (row == null) continue
    const hr = p.hour
    if (hr < 0 || hr > 23) continue
    const cell = row.cells[hr]
    row.cells[hr] = cell == null
      ? { from, to: from + HOUR, count }
      : { from: cell.from, to: from + HOUR, count: cell.count + count }
  }

  const runningTime = weekSpan(now, resolvedTz).to
  const runningParts = getDatePartsInTz(runningTime, resolvedTz)
  const todayRow = byDateKey.get(runningParts.dateKey)
  if (todayRow != null && todayRow.cells[runningParts.hour] == null) {
    todayRow.live = runningParts.hour
  }
  return rows
}

/** A cell's shade, 0 for none and 1 to 5 by its share of the busiest hour. */
export function level(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  return Math.min(5, Math.max(1, Math.ceil((count / max) * 5)))
}
