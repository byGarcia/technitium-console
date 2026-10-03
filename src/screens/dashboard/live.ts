import { formatLabel } from '../../api/chart-labels'
import { LIVE_KEYS, type DashboardStats, type LiveCounters, type LiveKey, type Metrics } from '../../api/dashboard'

/*
Last Hour between its reloads (deviation 5 in CONVENTIONS.md). This console's
own arithmetic, not upstream's: upstream's Dashboard only moves once a minute.

`stats/get` draws the last 60 minutes and leaves the current one at 0 until it
is consolidated. The server's lifetime counters (`dashboard/metrics/json`) move
with every query, so the difference between two readings is what happened in
between. Those differences are kept per minute of the browser's clock, and laid
over the consolidated data: the current minute grows, a minute that turns enters
the chart at the right while the oldest one leaves it, and the tiles and the
Query Response Types doughnut follow the same arithmetic, so they keep adding up
with the chart's legend. Clients is never moved: distinct clients do not add up.
*/

export const zero = (): LiveCounters =>
  Object.fromEntries(LIVE_KEYS.map((k) => [k, 0])) as LiveCounters

export const sum = (a: LiveCounters, b: LiveCounters): LiveCounters =>
  Object.fromEntries(LIVE_KEYS.map((k) => [k, a[k] + b[k]])) as LiveCounters

export interface Sample {
  uptimestamp: string
  counters: LiveCounters
}

/** What one node added since its previous reading. The first reading, a restart
 *  (a new `uptimestamp`) and a counter that went back are a new baseline that
 *  adds nothing: never a negative. */
export function advance(prev: Sample | undefined, next: Metrics): { delta: LiveCounters; sample: Sample } {
  const counters = Object.fromEntries(
    LIVE_KEYS.map((k) => [k, Number(next.lifetimeCounters[k] ?? 0)]),
  ) as LiveCounters
  const sample = { uptimestamp: next.uptimestamp, counters }
  if (
    prev == null ||
    prev.uptimestamp !== next.uptimestamp ||
    LIVE_KEYS.some((k) => counters[k] < prev.counters[k])
  ) {
    return { delta: zero(), sample }
  }
  const delta = Object.fromEntries(LIVE_KEYS.map((k) => [k, counters[k] - prev.counters[k]])) as LiveCounters
  return { delta, sample }
}

export interface LiveMinute {
  /** The minute's start, in milliseconds since the epoch. */
  at: number
  counts: LiveCounters
}

const MINUTE = 60_000

/** Adds `delta` to the minute `now` falls in; a minute that turns opens a new
 *  entry even when nothing happened, so the chart keeps moving. */
export function record(minutes: LiveMinute[], delta: LiveCounters, now: number): LiveMinute[] {
  const at = Math.floor(now / MINUTE) * MINUTE
  const last = minutes[minutes.length - 1]
  if (last != null && last.at === at) {
    return [...minutes.slice(0, -1), { at, counts: sum(last.counts, delta) }]
  }
  return [...minutes, { at, counts: delta }]
}

/* The main chart's series that a counter feeds. `Clients` is not here on purpose. */
const SERIES: Record<string, LiveKey> = {
  Total: 'totalQueries',
  'No Error': 'totalNoError',
  'Server Failure': 'totalServerFailure',
  'NX Domain': 'totalNxDomain',
  Refused: 'totalRefused',
  Authoritative: 'totalAuthoritative',
  Recursive: 'totalRecursive',
  Cached: 'totalCached',
  Blocked: 'totalBlocked',
  Dropped: 'totalDropped',
}

/* The Query Response Types doughnut's slices, by their label. */
const RESPONSE: Record<string, LiveKey> = {
  Authoritative: 'totalAuthoritative',
  Recursive: 'totalRecursive',
  Cached: 'totalCached',
  Blocked: 'totalBlocked',
  Dropped: 'totalDropped',
}

export function applyLive(base: DashboardStats, minutes: LiveMinute[]): DashboardStats {
  if (minutes.length === 0) return base

  const added = minutes.reduce((acc, m) => sum(acc, m.counts), zero())
  /* What left the hour: the oldest minutes the chart dropped as new ones came in. */
  const left = zero()

  let mainChartData = base.mainChartData
  const format = base.mainChartData.labelFormat
  if (format != null) {
    const labels = [...base.mainChartData.labels]
    const datasets = base.mainChartData.datasets.map((d) => ({ ...d, data: [...d.data] }))
    for (const m of minutes) {
      const label = formatLabel(new Date(m.at).toISOString(), format)
      let i = labels.lastIndexOf(label)
      if (i === -1) {
        labels.shift()
        labels.push(label)
        for (const d of datasets) {
          const key = SERIES[d.label]
          const gone = d.data.shift()
          if (key != null) left[key] += Number(gone || 0)
          d.data.push(0)
        }
        i = labels.length - 1
      }
      for (const d of datasets) {
        const key = SERIES[d.label]
        /* A measured minute has no Clients figure: a gap, not a zero. */
        d.data[i] = key != null ? Number(d.data[i] || 0) + m.counts[key] : Number.NaN
      }
    }
    mainChartData = { ...base.mainChartData, labels, datasets }
  }

  const stats = { ...base.stats }
  for (const k of LIVE_KEYS) stats[k] = Math.max(0, base.stats[k] + added[k] - left[k])

  const response = base.queryResponseChartData
  const queryResponseChartData = {
    ...response,
    datasets: response.datasets.map((d) => ({
      ...d,
      data: d.data.map((v, i) => {
        const key = RESPONSE[response.labels[i]]
        return key != null ? Math.max(0, Number(v || 0) + added[key] - left[key]) : v
      }),
    })),
  }

  return { ...base, stats, mainChartData, queryResponseChartData }
}
