/*
`moment(x).local().format("YYYY-MM-DD HH:mm:ss")`, which is how upstream writes
the timestamp of a query log entry (logs.js:512). Without moment.

And the inverse conversion: the `<input type="datetime-local">` of the "From" and
"To" filters hands over a string with NO zone (`2026-08-25T00:00`), which
upstream passes through `moment(...).toISOString()`. Both moment and the
browser's `Date` read that form in LOCAL time, so the result is the same.
*/

/* `dateTime` was unified into `src/lib/dates.ts` when integrating phases 4, 8 and 9. */
export { dateTime } from '../../lib/dates'
import { getTimezone, type SupportedTimezone } from '../../lib/timezone'

const pad = (n: number, width = 2) => String(n).padStart(width, '0')
const pad4 = (n: number) => (n < 0 ? `-${String(Math.abs(n)).padStart(4, '0')}` : String(n).padStart(4, '0'))

/** Exact UTC epoch ms for any astronomical year (including 0..99 and negative BC years). */
function utcMs(y: number, m: number, d: number, h = 0, min = 0, s = 0): number {
  const dt = new Date(0)
  dt.setUTCFullYear(y, m, d)
  dt.setUTCHours(h, min, s, 0)
  return dt.getTime()
}

const WALL_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function getWallFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = WALL_FORMATTERS.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      era: 'short',
    })
    WALL_FORMATTERS.set(tz, fmt)
  }
  return fmt
}

function getWallParts(t: number, tz: string): { y: number; m: number; d: number; h: number; min: number; s: number } {
  const parts = getWallFormatter(tz).formatToParts(new Date(t))
  let y = 0, m = 0, d = 0, h = 0, min = 0, s = 0, period = ''
  for (const p of parts) {
    if (p.type === 'year') y = parseInt(p.value, 10)
    else if (p.type === 'month') m = parseInt(p.value, 10)
    else if (p.type === 'day') d = parseInt(p.value, 10)
    else if (p.type === 'hour') h = parseInt(p.value, 10)
    else if (p.type === 'minute') min = parseInt(p.value, 10)
    else if (p.type === 'second') s = parseInt(p.value, 10)
    else if (p.type === 'era') period = p.value
  }
  if (period.includes('B') || period.toLowerCase().includes('bc')) y = 1 - y
  return { y, m, d, h, min, s }
}

function getWallClock(t: number, tz: string): number {
  const { y, m, d, h, min, s } = getWallParts(t, tz)
  return utcMs(y, m - 1, d, h, min, s)
}

/**
 * Convert a datetime-local input string (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss) to an ISO string
 * taking the active display timezone into account.
 */
export function toIso(value: string, tz?: SupportedTimezone): string {
  if (value === '') return ''
  const resolvedTz = tz ?? getTimezone()
  if (resolvedTz === 'local') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString()
  }

  // Parse YYYY-MM-DDTHH:mm(:ss)(.sss) components (including signed 6-digit ISO years)
  const m = /^([+-]?\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/.exec(value)
  if (!m) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString()
  }

  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const second = m[6] != null ? Number(m[6]) : 0
  const millisecond = m[7] != null ? Number(m[7].padEnd(3, '0').slice(0, 3)) : 0
  const targetWall = utcMs(year, month, day, hour, minute, second)

  // Wall-clock disambiguation following browser-native semantics:
  // Probe the zone's offset 24 hours before and after the approximate UTC instant so any
  // transition shift (e.g. 30 min in Australia/Lord_Howe, 60 min standard DST) is covered.
  // 1. Repeated times (Fall Back): cBefore is the earlier UTC instant and matches first.
  // 2. Skipped times (Spring Forward): neither matches; advance forward via the pre-transition offset.
  const DAY_MS = 86_400_000
  const approx = targetWall - (getWallClock(targetWall, resolvedTz) - targetWall)
  const offsetBefore = getWallClock(approx - DAY_MS, resolvedTz) - (approx - DAY_MS)
  const offsetAfter = getWallClock(approx + DAY_MS, resolvedTz) - (approx + DAY_MS)

  const cBefore = targetWall - offsetBefore
  const cAfter = targetWall - offsetAfter

  if (getWallClock(cBefore, resolvedTz) === targetWall) {
    return new Date(cBefore + millisecond).toISOString()
  }
  if (cAfter !== cBefore && getWallClock(cAfter, resolvedTz) === targetWall) {
    return new Date(cAfter + millisecond).toISOString()
  }

  return new Date(Math.max(cBefore, cAfter) + millisecond).toISOString()
}

/**
 * Format an instant (epoch milliseconds or Date) as a `datetime-local` input string
 * in the active display timezone.
 */
export function toLocalInput(at: number | Date, tz?: SupportedTimezone): string {
  const resolvedTz = tz ?? getTimezone()
  const d = typeof at === 'number' ? new Date(at) : at

  if (resolvedTz === 'local') {
    return `${pad4(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const { y, m, d: day, h, min, s } = getWallParts(d.getTime(), resolvedTz)
  return `${pad4(y)}-${pad(m)}-${pad(day)}T${pad(h)}:${pad(min)}:${pad(s)}`
}
