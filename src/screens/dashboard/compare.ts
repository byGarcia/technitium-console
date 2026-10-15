import type { ChartData, Stats } from '../../api/dashboard'

/*
Each figure against the previous period of the same length: deviation 6 in
CONVENTIONS.md. This console's own arithmetic, not upstream's: the stock Dashboard
shows no change at all. The words it draws ("vs previous hour" and the rest) are
ours too, and they are built here so they say what the arithmetic really compares.

The previous period is asked of the same endpoint with `type=Custom`, and the whole
difficulty is that Custom does not group the way the fixed periods do unless it is
asked with care. What the server does, read from v15.6.1 and measured against the
harness (WebServiceDashboardApi.cs:345-372, StatsManager.cs:663-1290):

  · Custom picks its grouping from the length it is given: more than seven days
    (rounded, then plus one) is by day, more than three hours is by hour, the rest
    by minute. `Convert.ToInt32` rounds half to even, so 6.5 days is still six.
  · By minute, `start` is the LABEL of the first minute (each minute is labelled by
    its end); by hour, `start` is truncated to its hour and is the first hour's
    start; by day, `start` is the first day. The count is the rounded length plus
    one in every case.
  · Last Hour is 60 minutes and Last Day 24 hours, both labelled by their end;
    Last Week is the 7 UTC days before today, Last Month the 31 before today, Last
    Year the 12 calendar months before this one, all labelled by their start.

So, per period:

  · Last Hour, Last Day, Last Month and Custom: the previous window is asked with
    exactly its own buckets, so all eleven figures compare, Clients included.
  · Last Week: seven days by day cannot be asked (seven rounds into the hour
    branch, and seven by hour is more than it allows), so eight days are asked and
    the ten counters are summed over the seven that matter. Clients counts distinct
    clients, which do not add up, so Clients gets no change.
  · Last Year: the previous twelve months are asked by day. The ten counters add up
    the same; Clients does not, because the server reaches a distinct count of
    months and of days through different merges, which part ways once a day had
    more than the 1,000 clients it keeps (StatCounter.Merge, Truncate).
  · Last Hour's Clients is drawn from memory and the previous hour's from the stats
    files, where each minute keeps 1,000 clients at most. With a minute over that
    the two would be counted differently, so Clients then gets no change.

No change is shown either when the previous period has no queries at all (a server
keeping its statistics in memory only, or one that had not started yet: nothing to
compare against), or for a figure whose previous value is zero, where a percentage
does not exist.
*/

export type Unit = 'minute' | 'hour' | 'day' | 'month'

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** The ten figures that are sums of their buckets. Clients is not one of them. */
export const COUNTED = [
  'totalQueries', 'totalNoError', 'totalServerFailure', 'totalNxDomain', 'totalRefused',
  'totalAuthoritative', 'totalRecursive', 'totalCached', 'totalBlocked', 'totalDropped',
] as const satisfies readonly (keyof Stats)[]
export type Counted = (typeof COUNTED)[number]
export type Compared = Counted | 'totalClients'

/** The main chart's series each figure is the sum of. */
const SERIES: Record<Compared, string> = {
  totalQueries: 'Total',
  totalNoError: 'No Error',
  totalServerFailure: 'Server Failure',
  totalNxDomain: 'NX Domain',
  totalRefused: 'Refused',
  totalAuthoritative: 'Authoritative',
  totalRecursive: 'Recursive',
  totalCached: 'Cached',
  totalBlocked: 'Blocked',
  totalDropped: 'Dropped',
  totalClients: 'Clients',
}

/** The clients a stored minute or hour keeps (StatsManager.STATS_TOP_LIMIT). */
export const STORED_CLIENTS = 1000

/** The bucket a label format stands for, as WebServiceDashboardApi.cs:300-372 picks it. */
export function unitOf(labelFormat: string | undefined): Unit | null {
  if (labelFormat == null) return null
  if (labelFormat.endsWith('HH:mm')) return 'minute'
  if (labelFormat.endsWith('HH:00')) return 'hour'
  if (labelFormat === 'MM/YYYY') return 'month'
  if (labelFormat === 'MM/DD' || labelFormat === 'DD/MM') return 'day'
  return null
}

function addMonthsUtc(at: number, months: number): number {
  const d = new Date(at)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)
}

export interface Bucket {
  from: number
  /** Exclusive. */
  to: number
}

/** Minutes and hours are labelled by their END, days and months by their START. */
function bucketAt(unit: Unit, at: number): Bucket {
  switch (unit) {
    case 'minute':
      return { from: at - MINUTE, to: at }
    case 'hour':
      return { from: at - HOUR, to: at }
    case 'day':
      return { from: at, to: at + DAY }
    case 'month':
      return { from: at, to: addMonthsUtc(at, 1) }
  }
}

/** A chart's buckets in order, or `null` when they are not instants or not contiguous. */
export function bucketsOf(chart: ChartData | undefined): { unit: Unit; buckets: Bucket[] } | null {
  if (chart == null) return null
  const unit = unitOf(chart.labelFormat)
  const instants = chart.instants
  if (unit == null || instants == null || instants.length === 0 || instants.length !== chart.labels.length) return null
  const buckets: Bucket[] = []
  for (const instant of instants) {
    const at = Date.parse(instant)
    if (!Number.isFinite(at)) return null
    const b = bucketAt(unit, at)
    if (buckets.length > 0 && buckets[buckets.length - 1].to !== b.from) return null
    buckets.push(b)
  }
  return { unit, buckets }
}

export interface Window {
  unit: Unit
  from: number
  /** Exclusive. */
  to: number
  count: number
}

export function windowOf(chart: ChartData | undefined): Window | null {
  const b = bucketsOf(chart)
  if (b == null) return null
  return { unit: b.unit, from: b.buckets[0].from, to: b.buckets[b.buckets.length - 1].to, count: b.buckets.length }
}

/** The window of the same length that ends where this one starts. */
export function previousWindow(w: Window): Window {
  const from = w.unit === 'month' ? addMonthsUtc(w.from, -w.count) : w.from - (w.to - w.from)
  return { unit: w.unit, from, to: w.from, count: w.count }
}

/** .NET's `Convert.ToInt32(double)`: to the nearest, and a half to the even one. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

/** What `type=Custom` returns for two instants (WebServiceDashboardApi.cs:345-372 and
 *  the `Get…WiseStats(start, end)` overloads): its grouping, how many buckets, and
 *  where the first one starts. */
export function customBuckets(start: number, end: number): Window {
  const span = end - start
  if (roundHalfEven(span / DAY) + 1 > 7) {
    const count = roundHalfEven(span / DAY) + 1
    return { unit: 'day', from: start, to: start + count * DAY, count }
  }
  if (roundHalfEven(span / HOUR) + 1 > 3) {
    const count = roundHalfEven(span / HOUR) + 1
    const from = Math.floor(start / HOUR) * HOUR
    return { unit: 'hour', from, to: from + count * HOUR, count }
  }
  const count = roundHalfEven(span / MINUTE) + 1
  const from = start - MINUTE
  return { unit: 'minute', from, to: from + count * MINUTE, count }
}

export interface PreviousQuery {
  /** The two instants for `type=Custom`. */
  start: string
  end: string
  /** The previous window itself, which the answer must cover. */
  window: Window
  /** The answer has exactly the previous window's buckets, so the server's own
   *  distinct Clients for it compares too. */
  exact: boolean
}

/**
 * How to ask for the period before `current` so the server groups it as it grouped
 * `current`. `null` when no such request exists.
 */
export function previousQuery(current: Window | null): PreviousQuery | null {
  if (current == null) return null
  const window = previousWindow(current)
  let start: number
  let end: number
  let exact = true
  switch (current.unit) {
    case 'minute':
      start = window.from + MINUTE
      end = window.to
      break
    case 'hour':
      start = window.from
      end = window.to - HOUR
      break
    case 'day':
      /* Seven days by day cannot be asked: eight are, and summed over seven. */
      start = current.count >= 8 ? window.from : window.to - 8 * DAY
      end = window.to - DAY
      exact = current.count >= 8
      break
    case 'month':
      start = window.from
      end = window.to - DAY
      exact = false
      break
  }
  const answer = customBuckets(start, end)
  /* Whatever the server will return has to cover the window in buckets that fit it. */
  if (answer.from > window.from || answer.to < window.to) return null
  if (exact && (answer.unit !== current.unit || answer.from !== window.from || answer.count !== current.count)) return null
  if (!exact && answer.unit !== 'day') return null
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), window, exact }
}

/**
 * The ten counters summed over `[from, to)`, bucket by bucket, from whichever of the
 * charts has each bucket. `null` unless every bucket of the span is there.
 */
export function sumBetween(charts: (ChartData | undefined)[], from: number, to: number): Record<Counted, number> | null {
  const byStart = new Map<number, { bucket: Bucket; chart: ChartData; index: number }>()
  for (const chart of charts) {
    const b = bucketsOf(chart)
    if (b == null || chart == null) continue
    b.buckets.forEach((bucket, index) => {
      if (!byStart.has(bucket.from)) byStart.set(bucket.from, { bucket, chart, index })
    })
  }
  const sums = Object.fromEntries(COUNTED.map((k) => [k, 0])) as Record<Counted, number>
  let at = from
  while (at < to) {
    const hit = byStart.get(at)
    if (hit == null || hit.bucket.to > to) return null
    for (const k of COUNTED) {
      const v = Number(hit.chart.datasets.find((d) => d.label === SERIES[k])?.data[hit.index])
      if (!Number.isFinite(v)) return null
      sums[k] += v
    }
    at = hit.bucket.to
  }
  return sums
}

/** What the comparison says, in OUR words: the previous period, named by what it is. */
export function previousLabel(w: Window, range: string): string {
  switch (range) {
    case 'LastHour':
      return 'previous hour'
    case 'LastDay':
      return 'previous 24 hours'
    case 'LastWeek':
      return 'previous 7 days'
    case 'LastMonth':
      return 'previous 31 days'
    case 'LastYear':
      return 'previous 12 months'
  }
  const unit = w.unit === 'month' ? 'month' : w.unit
  return w.count === 1 ? `previous ${unit}` : `previous ${w.count.toLocaleString()} ${unit}s`
}

export type Changes = Partial<Record<Compared, number>>

/**
 * Each figure's change, as a ratio (0.25 is 25 % up), against the previous period.
 *
 * `base` is the response the screen holds; `shown` is what it draws, which in Last
 * Hour has the live minutes laid over it and so may have slid a minute or two past
 * `base`. The previous window follows `shown`: its last minutes are then the first
 * ones of `base`, which are the server's consolidated figures as well.
 * `prev` is the answer to `query`, asked for this same `base`.
 */
export function changes(
  base: { stats: Stats; mainChartData: ChartData },
  shown: { stats: Stats; mainChartData: ChartData },
  prev: { stats: Stats; mainChartData: ChartData },
  query: PreviousQuery,
): Changes | null {
  const now = windowOf(shown.mainChartData)
  if (now == null) return null
  const before = previousWindow(now)
  const sums = sumBetween([prev.mainChartData, base.mainChartData], before.from, before.to)
  if (sums == null || sums.totalQueries === 0) return null

  const out: Changes = {}
  const ratio = (current: number, previous: number) => (previous > 0 ? (current - previous) / previous : undefined)
  for (const k of COUNTED) {
    const r = ratio(shown.stats[k], sums[k])
    if (r != null) out[k] = r
  }

  /* Clients does not move live, so it answers for `base`'s window, and only the
     server's own distinct count over exactly the previous one compares with it. */
  const asked = windowOf(prev.mainChartData)
  const sameWindow = query.exact && asked != null && asked.unit === query.window.unit &&
    asked.from === query.window.from && asked.to === query.window.to
  const clients = prev.mainChartData.datasets.find((d) => d.label === SERIES.totalClients)?.data ?? []
  const counted = asked?.unit !== 'minute' || clients.every((v) => Number(v) <= STORED_CLIENTS)
  if (sameWindow && counted) {
    const r = ratio(base.stats.totalClients, prev.stats.totalClients)
    if (r != null) out.totalClients = r
  }
  return out
}

/** A change as it is written: one decimal, always signed, a real minus. */
export function formatChange(ratio: number): string {
  const pct = Math.round(ratio * 1000) / 10
  if (pct === 0) return '0.0%'
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
}
