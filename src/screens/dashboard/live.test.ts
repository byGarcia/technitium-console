import { describe, expect, it } from 'vitest'
import type { DashboardStats, Metrics } from '../../api/dashboard'
import { formatLabel } from '../../api/chart-labels'
import { advance, applyLive, countedUntil, prune, record, zero, type LiveReading } from './live'

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

describe('record and prune', () => {
  const at = Date.UTC(2026, 9, 3, 19, 42, 0)
  const d = (q: number) => ({ ...zero(), totalQueries: q })

  it('keeps each reading that brought something, with its time', () => {
    const r = record(record([], d(2), at + 5_000), d(3), at + 7_000)
    expect(r).toEqual([{ at: at + 5_000, counts: d(2) }, { at: at + 7_000, counts: d(3) }])
  })

  it('a quiet reading changes nothing, not even the reference', () => {
    const r = record([], d(1), at)
    expect(record(r, zero(), at + 2_000)).toBe(r)
  })

  it('keeps uncounted readings for the displayed hour, then expires them', () => {
    const r = [{ at, counts: d(1) }, { at: at + 59 * 60_000, counts: d(1) }]
    expect(prune(r, at + 10 * 60_000)).toBe(r)
    expect(prune(r, at + 61 * 60_000)).toEqual([{ at: at + 59 * 60_000, counts: d(1) }])
    expect(prune(r, at + 60_000)).toBe(r)
  })
})

describe('applyLive', () => {
  const format = 'HH:mm'
  /* The server labels a minute by its END: 19:42 holds what happened from 19:41 to 19:42. */
  const iso = (min: number, sec = 0) => new Date(Date.UTC(2026, 9, 3, 19, min, sec)).toISOString()
  const label = (min: number) => formatLabel(iso(min), format)
  const series = (name: string, values: number[]) => ({ label: name, data: values })
  /* Three minutes drawn, up to 19:42: the server has counted everything until then. */
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
      instants: [iso(40), iso(41), iso(42)],
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
  const reading = (min: number, sec: number, counts: Partial<ReturnType<typeof zero>>): LiveReading => ({
    at: Date.parse(iso(min, sec)),
    counts: { ...zero(), ...counts },
  })

  it('reads how far the server has counted from its last label', () => {
    expect(countedUntil(base())).toBe(Date.parse(iso(42)))
  })

  it('does not mistake a legacy date label or mismatched instants for a UTC cut', () => {
    const b = base()
    expect(countedUntil({ ...b, mainChartData: { ...b.mainChartData, instants: ['09/30', '10/01', '10/02'] } })).toBeNull()
    expect(countedUntil({ ...b, mainChartData: { ...b.mainChartData, instants: [iso(42)] } })).toBeNull()
  })

  it('with nothing after the cut it returns the server data untouched', () => {
    const b = base()
    expect(applyLive(b, [])).toBe(b)
    /* Before the cut: the server has it already. */
    expect(applyLive(b, [reading(41, 30, { totalQueries: 5 })])).toBe(b)
  })

  it('what came after the cut opens the minute in course at the right; the oldest leaves', () => {
    const v = applyLive(base(), [reading(42, 20, { totalQueries: 4, totalBlocked: 1, totalRecursive: 3 })])
    expect(v.mainChartData.labels).toEqual([label(41), label(42), label(43)])
    expect(v.mainChartData.instants).toEqual([iso(41), iso(42), iso(43)])
    expect(v.mainChartData.datasets[0].data).toEqual([20, 0, 4])
    expect(v.mainChartData.datasets[1].data).toEqual([2, 0, 1])
    expect(Number.isNaN(v.mainChartData.datasets[2].data[2])).toBe(true)
    /* 30 + 4 - 10 (19:40 left the hour) */
    expect(v.stats.totalQueries).toBe(24)
    /* 3 + 1 - 1 */
    expect(v.stats.totalBlocked).toBe(3)
    expect(v.stats.totalClients).toBe(4)
    /* The doughnut: Recursive +3, Blocked +1 -1. */
    expect(v.queryResponseChartData.datasets[0].data).toEqual([10, 15, 5, 3, 0])
  })

  it('readings in the same minute add up; a later minute opens another', () => {
    const v = applyLive(base(), [
      reading(42, 10, { totalQueries: 1 }),
      reading(42, 50, { totalQueries: 2 }),
      reading(43, 5, { totalQueries: 7 }),
    ])
    expect(v.mainChartData.labels).toEqual([label(42), label(43), label(44)])
    expect(v.mainChartData.datasets[0].data).toEqual([0, 3, 7])
    /* 30 + 10 - 10 - 20 */
    expect(v.stats.totalQueries).toBe(10)
  })

  it('quiet minutes between readings still replace the minutes that left the window', () => {
    const v = applyLive(base(), [reading(42, 10, { totalQueries: 1 }), reading(44, 10, { totalQueries: 7 })])
    expect(v.mainChartData.instants).toEqual([iso(43), iso(44), iso(45)])
    expect(v.mainChartData.datasets[0].data).toEqual([1, 0, 7])
    expect(v.stats.totalQueries).toBe(8)
  })

  it('a long stale response replaces the entire chart with the measured window', () => {
    const v = applyLive(base(), [reading(42, 10, { totalQueries: 4 }), reading(58, 10, { totalQueries: 7 })])
    expect(v.mainChartData.instants).toEqual([iso(57), iso(58), iso(59)])
    expect(v.mainChartData.datasets[0].data).toEqual([0, 0, 7])
    expect(v.stats.totalQueries).toBe(7)
  })

  it('groups a reading on a minute boundary under that exact end', () => {
    const v = applyLive(base(), [reading(43, 0, { totalQueries: 4 })])
    expect(v.mainChartData.instants).toEqual([iso(41), iso(42), iso(43)])
    expect(v.mainChartData.datasets[0].data).toEqual([20, 0, 4])
  })

  /* The bug this shape exists for: a reload whose data now covers what the readings
     measured must not count it twice, and one that does not yet must not lose it. */
  it('after a reload that counted them, the same readings add nothing', () => {
    const before = base()
    const r = [reading(42, 35, { totalQueries: 3 })]
    expect(applyLive(before, r).stats.totalQueries).toBe(30 + 3 - 10)
    const reloaded: DashboardStats = {
      ...before,
      stats: { ...before.stats, totalQueries: 23 },
      mainChartData: {
        ...before.mainChartData,
        labels: [label(41), label(42), label(43)],
        instants: [iso(41), iso(42), iso(43)],
        datasets: [series('Total', [20, 0, 3]), series('Blocked', [2, 0, 0]), series('Clients', [3, 0, 1])],
      },
    }
    expect(applyLive(reloaded, r)).toBe(reloaded)
  })

  it('does not mutate the data it was given', () => {
    const b = base()
    const before = JSON.stringify(b)
    applyLive(b, [reading(43, 10, { totalQueries: 2 })])
    expect(JSON.stringify(b)).toBe(before)
  })

  it('a chart without instants keeps its chart, and counts the readings since `fallback`', () => {
    const b = base()
    b.mainChartData = { ...b.mainChartData, instants: undefined }
    const v = applyLive(b, [reading(41, 0, { totalQueries: 9 }), reading(42, 30, { totalQueries: 4 })], Date.parse(iso(42)))
    expect(v.mainChartData).toBe(b.mainChartData)
    expect(v.stats.totalQueries).toBe(34)
  })
})
