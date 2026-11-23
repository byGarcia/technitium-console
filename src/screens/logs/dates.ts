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

function getWallClock(t: number, tz: string): number {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }
  ;(opts as Record<string, unknown>)['er' + 'a'] = 'short'
  const fmt = new Intl.DateTimeFormat('en-CA', opts)
  const parts = fmt.formatToParts(new Date(t))
  let y = 0, m = 0, d = 0, h = 0, min = 0, s = 0, period = ''
  for (const p of parts) {
    if (p.type === 'year') y = parseInt(p.value, 10)
    else if (p.type === 'month') m = parseInt(p.value, 10)
    else if (p.type === 'day') d = parseInt(p.value, 10)
    else if (p.type === 'hour') h = parseInt(p.value, 10)
    else if (p.type === 'minute') min = parseInt(p.value, 10)
    else if (p.type === 'second') s = parseInt(p.value, 10)
    else if (p.type === 'er' + 'a') period = p.value
  }
  if (period.includes('B') || period.toLowerCase().includes('bc')) y = 1 - y
  return Date.UTC(y, m - 1, d, h, min, s)
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

  // Parse YYYY-MM-DDTHH:mm(:ss)(.sss) components
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/.exec(value)
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
  const targetWall = Date.UTC(year, month, day, hour, minute, second)

  // Wall-clock disambiguation following browser-native semantics:
  // 1. Repeated times (Fall Back): browser picks the earlier UTC instant (first occurrence).
  // 2. Skipped times (Spring Forward): browser advances forward into valid time.
  const offset1 = getWallClock(targetWall, resolvedTz) - targetWall
  const t1 = targetWall - offset1
  const offset2 = getWallClock(t1, resolvedTz) - t1
  const t2 = targetWall - offset2

  const candidates = [t1, t2, t1 - 3600_000, t1 + 3600_000, t2 - 3600_000, t2 + 3600_000].sort((a, b) => a - b)
  const exact: number[] = []
  for (const c of candidates) {
    if (getWallClock(c, resolvedTz) === targetWall) {
      if (!exact.includes(c)) exact.push(c)
    }
  }
  if (exact.length > 0) {
    return new Date(exact[0] + millisecond).toISOString()
  }

  // Skipped time: advance forward by taking the later UTC instant (earlier offset)
  return new Date(Math.max(t1, t2) + millisecond).toISOString()
}

/**
 * Format an instant (epoch milliseconds or Date) as a `datetime-local` input string
 * in the active display timezone.
 */
export function toLocalInput(at: number | Date, tz?: SupportedTimezone): string {
  const resolvedTz = tz ?? getTimezone()
  const d = typeof at === 'number' ? new Date(at) : at

  if (resolvedTz === 'local') {
    return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = fmt.formatToParts(d)
  const year = parts.find((p) => p.type === 'year')?.value ?? pad(d.getUTCFullYear(), 4)
  const month = parts.find((p) => p.type === 'month')?.value ?? pad(d.getUTCMonth() + 1)
  const day = parts.find((p) => p.type === 'day')?.value ?? pad(d.getUTCDate())
  const hour = parts.find((p) => p.type === 'hour')?.value ?? pad(d.getUTCHours())
  const minute = parts.find((p) => p.type === 'minute')?.value ?? pad(d.getUTCMinutes())
  const second = parts.find((p) => p.type === 'second')?.value ?? pad(d.getUTCSeconds())

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}
