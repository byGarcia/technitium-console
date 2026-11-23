import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fromNow, dateTime, minuteStamp, dateWithAge } from './dates'
import { setTimezone } from './timezone'

/* The format is moment's: `YYYY-MM-DD HH:mm:ss` in the configured timezone. The tests build
   the date with `new Date(y, m, d, …)` or explicit ISO timestamps. */

describe('dateTime / minuteStamp', () => {
  const d = new Date(2026, 7, 25, 16, 41, 12).toISOString()

  beforeEach(() => {
    setTimezone('local')
  })
  afterEach(() => {
    setTimezone('local')
  })

  it('it zero-pads months, days, hours, minutes and seconds', () => {
    expect(dateTime(new Date(2026, 0, 2, 3, 4, 5).toISOString())).toBe('2026-01-02 03:04:05')
  })

  it('the Cluster table cuts off at the minutes', () => {
    expect(dateTime(d)).toBe('2026-08-25 16:41:12')
    expect(minuteStamp(d)).toBe('2026-08-25 16:41')
  })

  it('an absent or unreadable date does not break the table: it returns an empty string', () => {
    expect(dateTime(null)).toBe('')
    expect(dateTime(undefined)).toBe('')
    expect(dateTime('not a date')).toBe('')
    expect(minuteStamp(null)).toBe('')
  })

  it('formats UTC timestamps accurately across supported timezones', () => {
    const utcIso = '2026-08-25T16:41:12.000Z'
    expect(dateTime(utcIso, 'Asia/Kolkata')).toBe('2026-08-25 22:11:12')
    expect(minuteStamp(utcIso, 'Asia/Kolkata')).toBe('2026-08-25 22:11')

    expect(dateTime(utcIso, 'UTC')).toBe('2026-08-25 16:41:12')
    expect(minuteStamp(utcIso, 'UTC')).toBe('2026-08-25 16:41')

    expect(dateTime(utcIso, 'America/New_York')).toBe('2026-08-25 12:41:12')
    expect(dateTime(utcIso, 'Europe/London')).toBe('2026-08-25 17:41:12')
    expect(dateTime(utcIso, 'Asia/Tokyo')).toBe('2026-08-26 01:41:12')
    expect(minuteStamp(utcIso, 'Asia/Tokyo')).toBe('2026-08-26 01:41')
  })

  it('respects dynamic timezone changes from setTimezone', () => {
    const utcIso = '2026-08-25T16:41:12.000Z'
    setTimezone('UTC')
    expect(dateTime(utcIso)).toBe('2026-08-25 16:41:12')

    setTimezone('Asia/Kolkata')
    expect(dateTime(utcIso)).toBe('2026-08-25 22:11:12')
  })

  it('formats dateWithAge with timezone', () => {
    const utcIso = '2026-08-25T16:41:12.000Z'
    const now = Date.parse('2026-08-25T16:42:12.000Z')
    expect(dateWithAge(utcIso, now, 'UTC')).toBe('2026-08-25 16:41:12 (a minute ago)')
    expect(dateWithAge(utcIso, now, 'Asia/Kolkata')).toBe('2026-08-25 22:11:12 (a minute ago)')
  })

  it('formats .NET default date 0001-01-01 properly without throwing', () => {
    expect(dateTime('0001-01-01T00:00:00')).toBe('0001-01-01 00:00:00')
    expect(minuteStamp('0001-01-01T00:00:00')).toBe('0001-01-01 00:00')
    expect(dateTime('0001-01-01T00:00:00Z', 'UTC')).toBe('0001-01-01 00:00:00')
    expect(dateTime('0001-01-01T00:00:00Z', 'America/New_York')).toBe('0000-12-31 19:03:58')
    expect(minuteStamp('0001-01-01T00:00:00Z', 'UTC')).toBe('0001-01-01 00:00')
    expect(minuteStamp('0001-01-01T00:00:00Z', 'America/New_York')).toBe('0000-12-31 19:03')
  })
})

describe('fromNow: the moment literals', () => {
  const now = Date.UTC(2026, 7, 25, 12, 0, 0)
  const ago = (ms: number) => fromNow(new Date(now - ms).toISOString(), now)

  it('under 45 s it always says \"a few seconds ago\"', () => {
    expect(ago(0)).toBe('a few seconds ago')
    expect(ago(1000)).toBe('a few seconds ago')
    expect(ago(44_000)).toBe('a few seconds ago')
  })

  it('the threshold for \"a minute\" is at 45 s, not at 60', () => {
    expect(ago(45_000)).toBe('a minute ago')
    expect(ago(89_000)).toBe('a minute ago')
    expect(ago(91_000)).toBe('2 minutes ago')
  })

  it('minutes, hours and days', () => {
    expect(ago(8 * 60_000)).toBe('8 minutes ago')
    expect(ago(44 * 60_000)).toBe('44 minutes ago')
    expect(ago(60 * 60_000)).toBe('an hour ago')
    expect(ago(3 * 3600_000)).toBe('3 hours ago')
    expect(ago(24 * 3600_000)).toBe('a day ago')
    expect(ago(5 * 24 * 3600_000)).toBe('5 days ago')
  })

  it('months and years', () => {
    expect(ago(40 * 24 * 3600_000)).toBe('a month ago')
    expect(ago(120 * 24 * 3600_000)).toBe('4 months ago')
    expect(ago(400 * 24 * 3600_000)).toBe('a year ago')
    expect(ago(3 * 365 * 24 * 3600_000)).toBe('3 years ago')
  })

  it('a future date carries the \"in\" prefix, not the \"ago\" suffix', () => {
    expect(fromNow(new Date(now + 3 * 3600_000).toISOString(), now)).toBe('in 3 hours')
  })

  it('`0001-01-01T00:00:00` is the .NET \"never\" and comes out as years, it does not blow up', () => {
    expect(fromNow('0001-01-01T00:00:00', now)).toMatch(/ years ago$/)
  })
})

describe('toIso / toLocalInput timezone support', () => {
  it('converts datetime-local input to UTC ISO string in Asia/Kolkata', async () => {
    const { toIso, toLocalInput } = await import('../screens/logs/dates')
    // 08:00 AM IST on 2026-11-15 is 02:30 AM UTC
    expect(toIso('2026-11-15T08:00:00', 'Asia/Kolkata')).toBe('2026-11-15T02:30:00.000Z')
    // Roundtrip back from UTC instant
    const instant = Date.parse('2026-11-15T02:30:00.000Z')
    expect(toLocalInput(instant, 'Asia/Kolkata')).toBe('2026-11-15T08:00:00')
  })

  it('converts datetime-local input in UTC mode', async () => {
    const { toIso, toLocalInput } = await import('../screens/logs/dates')
    expect(toIso('2026-11-15T08:00:00', 'UTC')).toBe('2026-11-15T08:00:00.000Z')
    const instant = Date.parse('2026-11-15T08:00:00.000Z')
    expect(toLocalInput(instant, 'UTC')).toBe('2026-11-15T08:00:00')
  })

  it('disambiguates wall-clock times on clock-change transitions matching browser native semantics', async () => {
    const { toIso } = await import('../screens/logs/dates')
    // Skipped time (Spring Forward): In America/New_York on 2026-03-08, 02:30 is skipped -> advances forward to 03:30 EDT = 07:30Z
    expect(toIso('2026-03-08T02:30:00', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z')

    // Repeated time (Fall Back): In Europe/Madrid on 2026-10-25, 02:30 occurs twice -> selects earlier UTC instant = 00:30Z
    expect(toIso('2026-10-25T02:30:00', 'Europe/Madrid')).toBe('2026-10-25T00:30:00.000Z')

    // Skipped midnight: In Asia/Beirut on 2026-03-29, midnight is skipped -> starts at 01:00 local = 22:00Z on March 28
    expect(toIso('2026-03-29T00:00:00', 'Asia/Beirut')).toBe('2026-03-28T22:00:00.000Z')
  })
})
