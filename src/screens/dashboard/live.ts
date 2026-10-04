import { formatLabel } from '../../api/chart-labels'
import { LIVE_KEYS, type DashboardStats, type LiveCounters, type LiveKey, type Metrics } from '../../api/dashboard'

/*
Last Hour between its reloads (deviation 5 in CONVENTIONS.md). This console's
own arithmetic, not upstream's: upstream's Dashboard only moves once a minute.

What the server says, measured against v15.6.0:

  · `stats/get` labels each minute by its END (StatsManager.cs:675-704;
    queries at 21:02:35 are under
    21:03) and only draws minutes already closed: its last label is how far it
    has counted. The minute in course is not there at all.
  · The lifetime counters (`dashboard/metrics/json`) move with every query, so the
    difference between two readings is what happened in between.

So each reading is kept with its time, and only the readings AFTER the server's
last label are laid over its data: they are exactly what it has not counted yet.
A reload moves that cut forward and the readings it now covers stop counting by
themselves, so nothing is counted twice and nothing is lost before the server has
it. A reading that straddles the cut is assigned to its end; the next reload
replaces that approximation with the server's measured minutes. Slow requests
can make this interval longer than the normal two-second polling cadence.

The readings after the cut become new minutes at the right of the chart, the
oldest ones leaving at the left, and the tiles and the Query Response Types
doughnut follow the same arithmetic, so they keep adding up with the chart's
legend. Clients is never moved: distinct clients do not add up.

A chart without instants (an older server, or no `utc`) has no cut to read: then
the readings since `fallback` count, and the chart itself is left alone.
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

export interface LiveReading {
  /** When it was read, in milliseconds since the epoch. */
  at: number
  /** What the counters added since the reading before. */
  counts: LiveCounters
}

const MINUTE = 60_000

/** Keeps a reading that brought something. A quiet one returns the SAME list, so
 *  nothing is drawn again. */
export function record(readings: LiveReading[], delta: LiveCounters, now: number): LiveReading[] {
  if (LIVE_KEYS.every((k) => delta[k] === 0)) return readings
  return [...readings, { at: now, counts: delta }]
}

/** Bounds the history to the displayed hour, even if statistics reloads fail.
 *  Nothing to drop returns the SAME list. */
export function prune(readings: LiveReading[], now: number, keep = 60): LiveReading[] {
  const from = now - keep * MINUTE
  return readings.some((r) => r.at < from) ? readings.filter((r) => r.at >= from) : readings
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

/** How far the server has counted: its last label, if it is an instant. */
export function countedUntil(base: DashboardStats): number | null {
  const instants = base.mainChartData.instants
  if (instants == null || instants.length !== base.mainChartData.labels.length) return null
  const last = instants?.[instants.length - 1]
  const at = last != null && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(last)
    ? Date.parse(last)
    : Number.NaN
  return Number.isNaN(at) ? null : at
}

export function applyLive(base: DashboardStats, readings: LiveReading[], fallback = 0): DashboardStats {
  if (readings.length === 0) return base
  const cut = countedUntil(base)
  const after = readings.filter((r) => r.at > (cut ?? fallback))
  if (after.length === 0) return base

  let extra = after.reduce((acc, r) => sum(acc, r.counts), zero())
  /* What left the hour: the oldest minutes the chart dropped as new ones came in. */
  const left = zero()

  let mainChartData = base.mainChartData
  const format = base.mainChartData.labelFormat
  if (cut != null && format != null) {
    /* By minute, each under the END of its minute, as the server labels them. */
    const byEnd = new Map<number, LiveCounters>()
    for (const r of after) {
      const end = Math.ceil(r.at / MINUTE) * MINUTE
      byEnd.set(end, sum(byEnd.get(end) ?? zero(), r.counts))
    }
    const labels = [...base.mainChartData.labels]
    const instants = [...(base.mainChartData.instants ?? [])]
    const datasets = base.mainChartData.datasets.map((d) => ({ ...d, data: [...d.data] }))
    const lastEnd = Math.max(...byEnd.keys())
    const windowFrom = lastEnd - labels.length * MINUTE
    extra = after.filter((r) => r.at > windowFrom).reduce((acc, r) => sum(acc, r.counts), zero())
    /* Quiet minutes between measured ones still occupy a slot. Jumping straight
       to a later reading would keep older minutes that have left the hour. */
    const firstEnd = Math.max(cut + MINUTE, lastEnd - (labels.length - 1) * MINUTE)
    for (let end = firstEnd; end <= lastEnd; end += MINUTE) {
      const counts = byEnd.get(end) ?? zero()
      const instant = new Date(end).toISOString()
      labels.shift()
      labels.push(formatLabel(instant, format))
      instants.shift()
      instants.push(instant)
      for (const d of datasets) {
        const key = SERIES[d.label]
        const gone = d.data.shift()
        if (key != null) left[key] += Number(gone || 0)
        /* A minute the server has not counted has no Clients figure: a gap, not a zero. */
        d.data.push(key != null ? counts[key] : Number.NaN)
      }
    }
    mainChartData = { ...base.mainChartData, labels, instants, datasets }
  }

  const stats = { ...base.stats }
  for (const k of LIVE_KEYS) stats[k] = Math.max(0, base.stats[k] + extra[k] - left[k])

  const response = base.queryResponseChartData
  const queryResponseChartData = {
    ...response,
    datasets: response.datasets.map((d) => ({
      ...d,
      data: d.data.map((v, i) => {
        const key = RESPONSE[response.labels[i]]
        return key != null ? Math.max(0, Number(v || 0) + extra[key] - left[key]) : v
      }),
    })),
  }

  return { ...base, stats, mainChartData, queryResponseChartData }
}
