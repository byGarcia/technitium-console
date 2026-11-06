import type { QueryLogEntry } from '../../api/logs'

/*
The Dashboard's Response Time (CONVENTIONS.md, deviation 28), worked out from the
newest entries of the query log: only the ones that carry a `responseRtt`, which the
server writes for an answer it had to ask for upstream (not one from cache, a zone or
a block). Nearest-rank percentiles over those, and how many took longer than 100 ms.
*/
/** `short` is the bucket's upper edge, for a narrow axis. */
export const BUCKETS: { label: string; short: string; upTo: number }[] = [
  { label: '<1', short: '<1', upTo: 1 },
  { label: '1-2', short: '2', upTo: 2 },
  { label: '2-5', short: '5', upTo: 5 },
  { label: '5-10', short: '10', upTo: 10 },
  { label: '10-20', short: '20', upTo: 20 },
  { label: '20-50', short: '50', upTo: 50 },
  { label: '50-100', short: '100', upTo: 100 },
  { label: '100-200', short: '200', upTo: 200 },
  { label: '>200', short: '>200', upTo: Infinity },
]

/** The buckets past this many milliseconds are the slow tail. */
export const SLOW_MS = 100

export interface ResponseTimes {
  /** Entries read. */
  sampled: number
  /** Of those, the ones with a round-trip time. */
  timed: number
  p50: number | null
  p95: number | null
  /** Share of the timed ones over `SLOW_MS`, 0 to 1. */
  slowShare: number
  counts: number[]
}

/** The value at the `p`-th percentile (0 to 100) of sorted values, nearest rank. */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]
}

export function responseTimes(entries: readonly QueryLogEntry[]): ResponseTimes {
  const rtts = (entries ?? [])
    .map((e) => e.responseRtt)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b)
  const counts = BUCKETS.map(() => 0)
  for (const v of rtts) counts[BUCKETS.findIndex((b) => v < b.upTo)]++
  return {
    sampled: entries?.length ?? 0,
    timed: rtts.length,
    p50: percentile(rtts, 50),
    p95: percentile(rtts, 95),
    slowShare: rtts.length === 0 ? 0 : rtts.filter((v) => v > SLOW_MS).length / rtts.length,
    counts,
  }
}

/** `13.4 ms`, `1.2 s`: one decimal below 100 ms, none above. */
export function ms(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1000) return `${(v / 1000).toFixed(1)} s`
  return v < 100 ? `${v.toFixed(1)} ms` : `${Math.round(v)} ms`
}
