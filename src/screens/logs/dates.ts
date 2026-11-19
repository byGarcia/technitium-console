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

  // Disambiguate instant by matching the wall-clock time in the given timezone
  // Start with a UTC estimate and refine via Intl.DateTimeFormat
  const guess = Date.UTC(year, month, day, hour, minute, second, millisecond)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  })

  // Offset correction using wall-clock time difference
  let best = guess

  for (let step = 0; step < 2; step++) {
    const parts = fmt.formatToParts(new Date(best))
    const pYear = Number(parts.find((p) => p.type === 'year')?.value)
    const pMonth = Number(parts.find((p) => p.type === 'month')?.value) - 1
    const pDay = Number(parts.find((p) => p.type === 'day')?.value)
    const pHour = Number(parts.find((p) => p.type === 'hour')?.value)
    const pMinute = Number(parts.find((p) => p.type === 'minute')?.value)
    const pSecond = Number(parts.find((p) => p.type === 'second')?.value)

    const actualWallClock = Date.UTC(pYear, pMonth, pDay, pHour, pMinute, pSecond, millisecond)
    const targetWallClock = Date.UTC(year, month, day, hour, minute, second, millisecond)
    const diff = targetWallClock - actualWallClock
    if (diff === 0) break
    best += diff
  }

  return new Date(best).toISOString()
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
