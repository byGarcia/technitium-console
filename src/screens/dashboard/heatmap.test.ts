import { describe, expect, it } from 'vitest'
import type { ChartData } from '../../api/dashboard'
import { customBuckets } from './compare'
import { dayLabel, heatRows, hourRequests, level, stitchHours, weekSpan, MAX_HOURS } from './heatmap'

const HOUR = 3_600_000

/* An hour-wise answer as the server writes it: each label the END of its hour. */
function hours(first: number, n: number, value: (i: number) => number = () => 1): ChartData {
  const labels = Array.from({ length: n }, (_, i) => new Date(first + (i + 1) * HOUR).toISOString())
  return { labelFormat: 'MM/DD HH:00', labels, instants: labels, datasets: [{ label: 'Total', data: labels.map((_, i) => value(i)) }] }
}

describe('the week asked by hour', () => {
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

  it('shades by the share of the busiest hour, zero apart', () => {
    expect(level(0, 10)).toBe(0)
    expect(level(1, 10)).toBe(1)
    expect(level(10, 10)).toBe(5)
    expect(level(6, 10)).toBe(3)
  })
})
