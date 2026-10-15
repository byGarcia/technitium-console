import { describe, expect, it } from 'vitest'
import type { ChartData, Stats } from '../../api/dashboard'
import {
  changes, customBuckets, formatChange, previousLabel, previousQuery, roundHalfEven, sumBetween,
  unitOf, windowOf, COUNTED,
} from './compare'

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()

/* A main chart as the server writes it with `utc=true`: instants, a label format and
   the eleven series, each bucket holding `per` queries (Clients holds `clients`). */
function chart(format: string, instants: number[], per: (i: number) => number, clients = 3): ChartData {
  const labels = instants.map(iso)
  const series = ['Total', 'No Error', 'Server Failure', 'NX Domain', 'Refused', 'Authoritative',
    'Recursive', 'Cached', 'Blocked', 'Dropped']
  return {
    labelFormat: format,
    labels,
    instants: labels,
    datasets: [
      ...series.map((label) => ({ label, data: instants.map((_, i) => (label === 'Total' || label === 'Cached' ? per(i) : 0)) })),
      { label: 'Clients', data: instants.map(() => clients) },
    ],
  }
}

function stats(total: number, clients: number): Stats {
  return {
    totalQueries: total, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
    totalAuthoritative: 0, totalRecursive: 0, totalCached: total, totalBlocked: 0, totalDropped: 0,
    totalClients: clients, zones: 0, cachedEntries: 0, allowedZones: 0, blockedZones: 0,
    allowListZones: 0, blockListZones: 0,
  }
}

const minutes = (lastLabel: number, n: number) => Array.from({ length: n }, (_, i) => lastLabel - (n - 1 - i) * MIN)
const NOW = Date.UTC(2026, 9, 15, 19, 36)

describe('the server rounding and grouping it mirrors', () => {
  it('rounds a half to the even neighbour, as Convert.ToInt32 does', () => {
    expect(roundHalfEven(6.5)).toBe(6)
    expect(roundHalfEven(7.5)).toBe(8)
    expect(roundHalfEven(2.5)).toBe(2)
    expect(roundHalfEven(2.6)).toBe(3)
  })

  it('reads the bucket from the label format', () => {
    expect(unitOf('HH:mm')).toBe('minute')
    expect(unitOf('MM/DD HH:mm')).toBe('minute')
    expect(unitOf('DD/MM HH:00')).toBe('hour')
    expect(unitOf('MM/DD')).toBe('day')
    expect(unitOf('MM/YYYY')).toBe('month')
    expect(unitOf(undefined)).toBeNull()
  })

  it('a custom range of seven days rounds into the day branch with EIGHT days', () => {
    const start = Date.UTC(2026, 9, 1)
    expect(customBuckets(start, start + 7 * DAY)).toMatchObject({ unit: 'day', count: 8 })
  })

  it('six and a half days stay by hour, 157 of them, the most one request gives', () => {
    const start = Date.UTC(2026, 9, 1)
    expect(customBuckets(start, start + 156 * HOUR)).toMatchObject({ unit: 'hour', count: 157 })
  })

  it('by minute the start is the first label and the first minute ends there', () => {
    const start = Date.UTC(2026, 9, 1, 10, 0)
    expect(customBuckets(start, start + 59 * MIN)).toEqual({ unit: 'minute', count: 60, from: start - MIN, to: start + 59 * MIN })
  })
})

describe('the previous window, period by period', () => {
  it('Last Hour: the 60 minutes before, asked by minute, Clients included', () => {
    const w = windowOf(chart('HH:mm', minutes(NOW, 60), () => 1))!
    expect(w).toMatchObject({ unit: 'minute', count: 60, from: NOW - 60 * MIN, to: NOW })
    const q = previousQuery(w)!
    expect(q).toMatchObject({ start: iso(NOW - 119 * MIN), end: iso(NOW - 60 * MIN), exact: true })
    expect(q.window).toMatchObject({ from: NOW - 120 * MIN, to: NOW - 60 * MIN })
  })

  it('Last Day: the 24 hours before, asked by hour', () => {
    const top = Date.UTC(2026, 9, 15, 19)
    const w = windowOf(chart('MM/DD HH:00', Array.from({ length: 24 }, (_, i) => top - (23 - i) * HOUR), () => 1))!
    const q = previousQuery(w)!
    expect(q).toMatchObject({ start: iso(top - 48 * HOUR), end: iso(top - 25 * HOUR), exact: true })
    expect(customBuckets(Date.parse(q.start), Date.parse(q.end))).toMatchObject({ unit: 'hour', count: 24 })
  })

  it('Last Week: seven days cannot be asked by day, so eight are, and Clients does not compare', () => {
    const first = Date.UTC(2026, 9, 8)
    const w = windowOf(chart('MM/DD', Array.from({ length: 7 }, (_, i) => first + i * DAY), () => 1))!
    const q = previousQuery(w)!
    expect(q).toMatchObject({ start: iso(first - 8 * DAY), end: iso(first - DAY), exact: false })
    expect(q.window).toMatchObject({ from: first - 7 * DAY, to: first })
  })

  it('Last Month: the 31 days before, asked by day', () => {
    const first = Date.UTC(2026, 8, 14)
    const w = windowOf(chart('MM/DD', Array.from({ length: 31 }, (_, i) => first + i * DAY), () => 1))!
    expect(previousQuery(w)).toMatchObject({ start: iso(first - 31 * DAY), end: iso(first - DAY), exact: true })
  })

  it('Last Year: the twelve calendar months before, asked by day, leap day included', () => {
    const months = Array.from({ length: 12 }, (_, i) => Date.UTC(2024, 9 + i, 1))
    const w = windowOf(chart('MM/YYYY', months, () => 1))!
    expect(w).toMatchObject({ unit: 'month', from: Date.UTC(2024, 9, 1), to: Date.UTC(2025, 9, 1) })
    const q = previousQuery(w)!
    expect(q).toMatchObject({ start: iso(Date.UTC(2023, 9, 1)), end: iso(Date.UTC(2024, 8, 30)), exact: false })
    expect(customBuckets(Date.parse(q.start), Date.parse(q.end))).toMatchObject({ unit: 'day', count: 366 })
  })

  it('Custom: the same number of buckets right before, so the server picks the same grouping', () => {
    const first = Date.UTC(2026, 9, 9, 22)
    const w = windowOf(chart('MM/DD HH:00', Array.from({ length: 97 }, (_, i) => first + (i + 1) * HOUR), () => 1))!
    const q = previousQuery(w)!
    expect(q.exact).toBe(true)
    expect(customBuckets(Date.parse(q.start), Date.parse(q.end))).toMatchObject({ unit: 'hour', count: 97, from: first - 97 * HOUR })
  })

  it('labels that are not instants (an older server) give no request', () => {
    expect(previousQuery(windowOf({ labels: ['10:00'], datasets: [] }))).toBeNull()
  })

  it('names the previous period by what is compared', () => {
    const w = { unit: 'hour' as const, from: 0, to: 25 * HOUR, count: 25 }
    expect(previousLabel(w, 'LastHour')).toBe('previous hour')
    expect(previousLabel(w, 'LastMonth')).toBe('previous 31 days')
    expect(previousLabel(w, 'Custom')).toBe('previous 25 hours')
    expect(previousLabel({ ...w, unit: 'minute', count: 1 }, 'Custom')).toBe('previous minute')
  })
})

describe('the changes', () => {
  const now = chart('HH:mm', minutes(NOW, 60), () => 2)
  const base = { stats: stats(120, 4), mainChartData: now }
  const prevChart = chart('HH:mm', minutes(NOW - 60 * MIN, 60), () => 1)
  const prev = { stats: stats(60, 2), mainChartData: prevChart }
  const query = previousQuery(windowOf(now))!

  it('each counted figure against the sum of the previous window, and Clients against the server count', () => {
    expect(changes(base, base, prev, query)).toEqual({ totalQueries: 1, totalCached: 1, totalClients: 1 })
  })

  it('a figure whose previous value is zero has no change: there is no percentage of nothing', () => {
    const out = changes(base, base, prev, query)!
    expect(out.totalBlocked).toBeUndefined()
  })

  it('a previous period with no queries at all compares nothing', () => {
    const empty = { stats: stats(0, 0), mainChartData: chart('HH:mm', minutes(NOW - 60 * MIN, 60), () => 0) }
    expect(changes(base, base, empty, query)).toBeNull()
  })

  it('an answer that does not cover the previous window compares nothing', () => {
    const short = { ...prev, mainChartData: chart('HH:mm', minutes(NOW - 60 * MIN, 30), () => 1) }
    expect(changes(base, base, short, query)).toBeNull()
  })

  it('Clients does not compare when the request was not exactly the previous window', () => {
    expect(changes(base, base, prev, { ...query, exact: false })).toEqual({ totalQueries: 1, totalCached: 1 })
  })

  it('Clients does not compare when a stored minute kept only part of its clients', () => {
    const crowded = { ...prev, mainChartData: chart('HH:mm', minutes(NOW - 60 * MIN, 60), () => 1, 1001) }
    expect(changes(base, base, crowded, query)?.totalClients).toBeUndefined()
  })

  it('live minutes slide the window: its previous one takes the first minutes of the response itself', () => {
    /* Two live minutes after the cut: the window shown starts two minutes later, so
       the previous one ends two minutes into `base`, where each minute holds 2. */
    const shown = { stats: stats(125, 4), mainChartData: chart('HH:mm', minutes(NOW + 2 * MIN, 60), () => 2) }
    const out = changes(base, shown, prev, query)!
    // 58 minutes of `prev` at 1 plus 2 minutes of `base` at 2 = 62.
    expect(out.totalQueries).toBeCloseTo(125 / 62 - 1)
  })

  it('sums bucket by bucket from whichever chart has each one', () => {
    const sums = sumBetween([prevChart, now], NOW - 61 * MIN, NOW - 59 * MIN)!
    expect(sums.totalQueries).toBe(1 + 2)
    expect(Object.keys(sums)).toEqual([...COUNTED])
  })

  it('is written with one decimal, a sign and a real minus', () => {
    expect(formatChange(0.25)).toBe('+25.0%')
    expect(formatChange(-0.0333)).toBe('−3.3%')
    expect(formatChange(0.0001)).toBe('0.0%')
    expect(formatChange(8)).toBe('+800.0%')
  })
})
