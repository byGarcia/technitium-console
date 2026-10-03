import { describe, expect, it } from 'vitest'
import type { DashboardStats, Metrics } from '../../api/dashboard'
import { formatLabel } from '../../api/chart-labels'
import { advance, applyLive, record, zero, type LiveMinute } from './live'

const metrics = (uptimestamp: string, q: number, extra: Partial<Metrics['lifetimeCounters']> = {}): Metrics => ({
  uptimestamp,
  lifetimeCounters: { ...zero(), totalQueries: q, totalClients: 7, ...extra },
})

describe('advance', () => {
  it('the first reading is a baseline and adds nothing', () => {
    const { delta, sample } = advance(undefined, metrics('u1', 50))
    expect(delta).toEqual(zero())
    expect(sample.counters.totalQueries).toBe(50)
  })

  it('a later reading adds the difference, key by key', () => {
    const first = advance(undefined, metrics('u1', 50, { totalBlocked: 6 })).sample
    const { delta } = advance(first, metrics('u1', 53, { totalBlocked: 7 }))
    expect(delta.totalQueries).toBe(3)
    expect(delta.totalBlocked).toBe(1)
    expect(delta.totalCached).toBe(0)
  })

  it('a restart (new uptimestamp) is a new baseline, never a negative', () => {
    const first = advance(undefined, metrics('u1', 500)).sample
    const { delta, sample } = advance(first, metrics('u2', 4))
    expect(delta).toEqual(zero())
    expect(sample.counters.totalQueries).toBe(4)
  })

  it('a counter that went back is a new baseline too', () => {
    const first = advance(undefined, metrics('u1', 500)).sample
    expect(advance(first, metrics('u1', 499)).delta).toEqual(zero())
  })
})

describe('record', () => {
  const at = Date.UTC(2026, 9, 3, 19, 42, 0)
  const d = (q: number) => ({ ...zero(), totalQueries: q })

  it('adds to the minute `now` falls in, and opens a new one when the minute turns', () => {
    let m: LiveMinute[] = []
    m = record(m, d(2), at + 5_000)
    m = record(m, d(3), at + 59_000)
    m = record(m, d(1), at + 61_000)
    expect(m).toEqual([
      { at, counts: d(5) },
      { at: at + 60_000, counts: d(1) },
    ])
  })

  it('a quiet reading in the same minute changes nothing, not even the reference', () => {
    const m = record([], d(1), at)
    expect(record(m, zero(), at + 2_000)).toBe(m)
  })

  it('a quiet minute still opens, so the chart keeps moving', () => {
    const m = record(record([], d(1), at), zero(), at + 60_000)
    expect(m.map((x) => x.at)).toEqual([at, at + 60_000])
  })
})

describe('applyLive', () => {
  const format = 'HH:mm'
  const iso = (min: number) => new Date(Date.UTC(2026, 9, 3, 19, min, 0)).toISOString()
  const label = (min: number) => formatLabel(iso(min), format)
  const series = (name: string, values: number[]) => ({ label: name, data: values })
  /* Three minutes drawn by the server: 19:40, 19:41 and 19:42, the last one (the
     current minute) still at 0 because the server has not consolidated it. */
  const base = (): DashboardStats => ({
    stats: {
      totalQueries: 30, totalNoError: 20, totalServerFailure: 4, totalNxDomain: 6, totalRefused: 0,
      totalAuthoritative: 10, totalRecursive: 12, totalCached: 5, totalBlocked: 3, totalDropped: 0,
      totalClients: 4, zones: 1, cachedEntries: 2, allowedZones: 3, blockedZones: 4,
      allowListZones: 0, blockListZones: 0,
    },
    mainChartData: {
      labelFormat: format,
      labels: [label(40), label(41), label(42)],
      datasets: [
        series('Total', [10, 20, 0]),
        series('Blocked', [1, 2, 0]),
        series('Clients', [2, 3, 0]),
      ],
    },
    queryResponseChartData: {
      labels: ['Authoritative', 'Recursive', 'Cached', 'Blocked', 'Dropped'],
      datasets: [{ label: '', data: [10, 12, 5, 3, 0] }],
    },
    queryTypeChartData: { labels: ['A'], datasets: [{ label: '', data: [30] }] },
    protocolTypeChartData: { labels: ['Udp'], datasets: [{ label: '', data: [30] }] },
    topClients: [], topDomains: [], topBlockedDomains: [],
  })
  const minute = (min: number, counts: Partial<ReturnType<typeof zero>>): LiveMinute => ({
    at: Date.parse(iso(min)),
    counts: { ...zero(), ...counts },
  })

  it('with nothing measured it returns the server data untouched', () => {
    const b = base()
    expect(applyLive(b, [])).toBe(b)
  })

  it('the current minute grows; tiles and doughnut add the same counts; Clients is left alone', () => {
    const v = applyLive(base(), [minute(42, { totalQueries: 4, totalBlocked: 1, totalRecursive: 3 })])
    expect(v.mainChartData.labels).toEqual([label(40), label(41), label(42)])
    expect(v.mainChartData.datasets[0].data).toEqual([10, 20, 4])
    expect(v.mainChartData.datasets[1].data).toEqual([1, 2, 1])
    expect(Number.isNaN(v.mainChartData.datasets[2].data[2])).toBe(true)
    expect(v.stats.totalQueries).toBe(34)
    expect(v.stats.totalBlocked).toBe(4)
    expect(v.stats.totalClients).toBe(4)
    expect(v.queryResponseChartData.datasets[0].data).toEqual([10, 15, 5, 4, 0])
  })

  it('a new minute enters at the right and the oldest leaves, from the chart AND from the tiles', () => {
    const v = applyLive(base(), [minute(42, { totalQueries: 4 }), minute(43, { totalQueries: 2, totalBlocked: 1 })])
    expect(v.mainChartData.labels).toEqual([label(41), label(42), label(43)])
    expect(v.mainChartData.datasets[0].data).toEqual([20, 4, 2])
    expect(v.mainChartData.datasets[1].data).toEqual([2, 0, 1])
    /* 30 + 4 + 2 - 10 (19:40 left the hour) */
    expect(v.stats.totalQueries).toBe(26)
    /* 3 + 1 - 1 */
    expect(v.stats.totalBlocked).toBe(3)
    /* The doughnut loses the leaving minute's Blocked as well: 3 + 1 - 1. */
    expect(v.queryResponseChartData.datasets[0].data[3]).toBe(3)
  })

  it('does not mutate the data it was given', () => {
    const b = base()
    const before = JSON.stringify(b)
    applyLive(b, [minute(43, { totalQueries: 2 })])
    expect(JSON.stringify(b)).toBe(before)
  })

  it('a chart without labelFormat keeps its chart and only the figures move', () => {
    const b = base()
    b.mainChartData = { ...b.mainChartData, labelFormat: undefined }
    const v = applyLive(b, [minute(42, { totalQueries: 4 })])
    expect(v.mainChartData).toBe(b.mainChartData)
    expect(v.stats.totalQueries).toBe(34)
  })
})
