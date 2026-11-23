import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ChartData } from '../../api/dashboard'
import { customBuckets } from './compare'
import { dayLabel, heatRows, hourRequests, level, stitchHours, tzMidnight, weekSpan, MAX_HOURS } from './heatmap'
import { setTimezone } from '../../lib/timezone'

const HOUR = 3_600_000

/* An hour-wise answer as the server writes it: each label the END of its hour. */
function hours(first: number, n: number, value: (i: number) => number = () => 1): ChartData {
  const labels = Array.from({ length: n }, (_, i) => new Date(first + (i + 1) * HOUR).toISOString())
  return { labelFormat: 'MM/DD HH:00', labels, instants: labels, datasets: [{ label: 'Total', data: labels.map((_, i) => value(i)) }] }
}

describe('the week asked by hour', () => {
  beforeEach(() => setTimezone('local'))
  afterEach(() => setTimezone('local'))
  const now = new Date(2026, 9, 15, 22, 20).getTime()

  it('runs from the browser midnight six days ago to the start of the hour in progress, on UTC hours', () => {
    /* On UTC hours because the server groups by them: in a zone a half hour off UTC
       both ends move back to the UTC hour they fall in. */
    const floor = (at: number) => Math.floor(at / HOUR) * HOUR
    const span = weekSpan(now)
    expect(span.to).toBe(floor(now))
    expect(span.from).toBe(floor(new Date(2026, 9, 9).getTime()))
  })

  it('needs two requests for a week, each grouped by hour, back to back with no hour twice or missing', () => {
    const span = weekSpan(now)
    const asks = hourRequests(span.from, span.to)!
    expect(asks.length).toBe(2)
    let at = span.from
    for (const a of asks) {
      const got = customBuckets(Date.parse(a.start), Date.parse(a.end))
      expect(got.unit).toBe('hour')
      expect(got.count).toBeLessThanOrEqual(MAX_HOURS)
      expect(got.from).toBe(at)
      at = got.to
    }
    expect(at).toBe(span.to)
  })

  it('one request is enough when the span fits', () => {
    expect(hourRequests(0, 100 * HOUR)).toHaveLength(1)
  })
})

describe('stitching the answers', () => {
  it('keeps every hour once, by its start', () => {
    const a = hours(0, 84, (i) => i)
    const b = hours(84 * HOUR, 84, (i) => 100 + i)
    const got = stitchHours([a, b], 0, 168 * HOUR)!
    expect(got.size).toBe(168)
    expect(got.get(0)).toBe(0)
    expect(got.get(84 * HOUR)).toBe(100)
  })

  it('an hour that comes twice is refused, not counted twice', () => {
    expect(stitchHours([hours(0, 85), hours(84 * HOUR, 84)], 0, 168 * HOUR)).toBeNull()
  })

  it('an hour missing is refused, not drawn as a quiet hour', () => {
    expect(stitchHours([hours(0, 83), hours(84 * HOUR, 84)], 0, 168 * HOUR)).toBeNull()
  })

  it('an answer by minute or by day is refused', () => {
    const minutes = { ...hours(0, 2), labelFormat: 'MM/DD HH:mm' }
    expect(stitchHours([minutes], 0, 2 * HOUR)).toBeNull()
  })
})

describe('the grid', () => {
  beforeEach(() => setTimezone('local'))
  afterEach(() => setTimezone('local'))

  it('places each hour by the browser day and hour of its start, today last', () => {
    const now = new Date(2026, 9, 15, 22, 20).getTime()
    const span = weekSpan(now)
    const map = new Map<number, number>()
    for (let at = span.from; at < span.to; at += HOUR) map.set(at, 1)
    map.set(new Date(2026, 9, 15, 21).getTime(), 42)
    const rows = heatRows(map, now)
    expect(rows).toHaveLength(7)
    expect(rows[6].label).toBe(dayLabel(new Date(2026, 9, 15).getTime()))
    expect(rows[6].cells[21]?.count).toBe(42)
    expect(rows[6].cells[22]).toBeNull()
    expect(rows[0].cells[0]?.count).toBe(1)
  })

  it('marks the hour in progress on today, apart from the hours still to come', () => {
    const now = new Date(2026, 9, 15, 22, 20).getTime()
    const span = weekSpan(now)
    const map = new Map<number, number>()
    for (let at = span.from; at < span.to; at += HOUR) map.set(at, 1)
    const rows = heatRows(map, now)
    expect(rows[6].live).toBe(22)
    expect(rows[6].cells[22]).toBeNull()
    expect(rows[5].live).toBeNull()
  })

  it('shades by the share of the busiest hour, zero apart', () => {
    expect(level(0, 10)).toBe(0)
    expect(level(1, 10)).toBe(1)
    expect(level(10, 10)).toBe(5)
    expect(level(6, 10)).toBe(3)
  })
})

describe('clock changes and custom display timezones in heatmap', () => {
  afterEach(() => setTimezone('local'))

  it('weekSpan anchors to midnight in target timezone across fall back (25-hour day)', () => {
    // 2026-11-02 17:00Z in America/New_York (Fall Back occurred on 2026-11-01)
    const now = Date.parse('2026-11-02T17:00:00Z')
    const span = weekSpan(now, 'America/New_York')
    // 6 calendar days back from 2026-11-02 is 2026-10-27
    // Midnight on 2026-10-27 in New York (EDT, UTC-4) is exactly 04:00Z
    expect(span.from).toBe(Date.parse('2026-10-27T04:00:00Z'))
    expect(span.to).toBe(Date.parse('2026-11-02T17:00:00Z'))
  })

  it('heatRows generates 7 calendar days including the 23-hour spring-forward day', () => {
    // 2026-03-09 00:30 local time in America/New_York (EDT, UTC-4 = 04:30Z)
    // Spring Forward occurred on 2026-03-08 (23-hour day)
    const now = Date.parse('2026-03-09T04:30:00Z')
    const hoursMap = new Map<number, number>()
    const rows = heatRows(hoursMap, now, 'America/New_York')

    expect(rows).toHaveLength(7)
    const labels = rows.map((r) => r.label)
    // Must include Sunday 03/08
    expect(labels).toEqual([
      'Tue 03/03',
      'Wed 03/04',
      'Thu 03/05',
      'Fri 03/06',
      'Sat 03/07',
      'Sun 03/08',
      'Mon 03/09',
    ])
    expect(rows[5].dateKey).toBe('2026-03-08')
    expect(rows[6].dateKey).toBe('2026-03-09')
  })

  it('tzMidnight returns exact sub-hour midnight without whole-hour flooring', () => {
    // Asia/Kolkata (+5:30): midnight on 2026-03-29 is 2026-03-28T18:30:00.000Z
    const kolkata = tzMidnight(2026, 3, 29, 'Asia/Kolkata')
    expect(new Date(kolkata).toISOString()).toBe('2026-03-28T18:30:00.000Z')

    // Asia/Kathmandu (+5:45): midnight on 2026-03-29 is 2026-03-28T18:15:00.000Z
    const kathmandu = tzMidnight(2026, 3, 29, 'Asia/Kathmandu')
    expect(new Date(kathmandu).toISOString()).toBe('2026-03-28T18:15:00.000Z')

    // Australia/Lord_Howe (+10:30 standard time on 2026-07-15): midnight is 2026-07-14T13:30:00.000Z
    const lordHowe = tzMidnight(2026, 7, 15, 'Australia/Lord_Howe')
    expect(new Date(lordHowe).toISOString()).toBe('2026-07-14T13:30:00.000Z')
  })

  it('handles skipped midnight in Beirut by starting on the first valid time of the day', () => {
    // In Beirut on 2026-03-29, midnight is skipped; earliest valid time is 01:00 local = 22:00Z on March 28
    const beirutMid = tzMidnight(2026, 3, 29, 'Asia/Beirut')
    expect(new Date(beirutMid).toISOString()).toBe('2026-03-28T22:00:00.000Z')

    // weekSpan covering Sunday 2026-03-29 begins at 22:00Z (not 21:00Z)
    const span = weekSpan(Date.parse('2026-04-04T12:00:00Z'), 'Asia/Beirut')
    expect(new Date(span.from).toISOString()).toBe('2026-03-28T22:00:00.000Z')
  })
})
