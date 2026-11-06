import type { TopEntry } from '../../api/dashboard'
import type { DhcpLease } from '../../api/dhcp'
import type { QueryLogEntry } from '../../api/logs'
import { BLOCKED_TYPES } from '../../api/blocking'
import { countByClient, countByType, type TypeCount } from '../blocking/blocked-sample'

/*
What the Clients page (CONVENTIONS.md, deviation 25) works out from what the server
sends. Nothing here asks the server, and nothing here writes words.

Two sources, never mixed in one figure:

  · the PERIOD: `dashboard/stats/get` (the count of clients, the total of queries)
    and `dashboard/stats/getTop` with `statsType=TopClients` (one entry per client,
    its queries in the period), the calls upstream's Dashboard and its "More" make;
  · the LOG SAMPLE: the newest queries of `logs/query`, every response type,
    through the query logs app: `SAMPLE` of every client for the list, and
    `DETAIL_SAMPLE` of one client for its card. The log has no counts per period,
    so whatever is counted from it says it is a sample.

Blocked is the three response types `totalBlocked` adds up (`BLOCKED_TYPES`), as
Blocking › Overview counts them.
*/

/** How many clients the list asks for: what upstream's "More" asks (index.html:336). */
export const LIMIT = 1000

/** How many of one client's newest queries its card counts. */
export const DETAIL_SAMPLE = 500

/** Rows on one page of the list. */
export const PER_PAGE = 25

/** How many domains each of a card's two lists shows: the Dashboard's top lists show five. */
export const DETAIL_ROWS = 5

/** How many clients the "Who uses your DNS" bar draws. */
export const BUSIEST = 20

/** How many of a client's newest queries its card lists one by one. */
export const LATEST = 10

/** How many time slices the card's activity chart cuts its sample into. */
export const SLICES = 24

/*
THE TWO TAGS, and why there are only two. Each is a rule over figures the page has;
nothing is tagged that the data cannot prove (there is no "New": the server does not
say when it first saw a client).

  · HEAVY BLOCKING: at least a fifth (`HEAVY_SHARE`, 20 %) of the client's queries
    in the list's log sample were blocked, counted over at least `HEAVY_MIN` (10) of
    its queries, so two blocked out of three does not make a tag.
  · QUIET: under 1 % (`QUIET_SHARE`) of the period's queries. A filter, not a tag:
    most clients of a busy network are quiet, and a list of grey labels says
    nothing.
*/
export const HEAVY_SHARE = 0.2
export const HEAVY_MIN = 10
export const QUIET_SHARE = 0.01

export function isBlocked(responseType: string): boolean {
  return (BLOCKED_TYPES as readonly string[]).includes(responseType)
}

export interface ClientRow {
  /** The client's address: the server's `name` in Top Clients. */
  ip: string
  /** The name the server resolved for it (`domain`), when it has one. */
  name: string | null
  /** Its queries in the period. */
  hits: number
  rateLimited: boolean
  /** Its queries in the log sample; `null` without a sample. */
  sampled: number | null
  /**
   * Its blocked queries in the log sample; `null` when there is no sample or the
   * client is not in it at all, which is not the same as none of them blocked.
   */
  blocked: number | null
}

/** The name a client is shown by: its resolved name, or its address. */
export function label(row: { ip: string; name: string | null }): string {
  return row.name ?? row.ip
}

/**
 * The list's rows: the period's Top Clients in the server's order (most queries
 * first), each with what the sample says of it.
 */
export function clientRows(top: readonly TopEntry[], sample: readonly QueryLogEntry[] | null): ClientRow[] {
  const seen = new Map<string, number>()
  const blocked = new Map<string, number>()
  if (sample != null) {
    for (const e of sample) {
      if (e.clientIpAddress == null || e.clientIpAddress === '') continue
      seen.set(e.clientIpAddress, (seen.get(e.clientIpAddress) ?? 0) + 1)
    }
    for (const c of countByClient(sample.filter((e) => isBlocked(e.responseType)))) blocked.set(c.ip, c.count)
  }
  return top.map((t) => {
    const n = seen.get(t.name)
    return {
      ip: t.name,
      name: t.domain != null && t.domain !== '' ? t.domain : null,
      hits: t.hits,
      rateLimited: t.rateLimited === true,
      sampled: sample == null ? null : (n ?? 0),
      blocked: sample == null || n == null ? null : (blocked.get(t.name) ?? 0),
    }
  })
}

/** Its blocked share in the sample, or `null` when it is not in it. */
export function blockedShare(row: ClientRow): number | null {
  return row.blocked == null || row.sampled == null || row.sampled === 0 ? null : row.blocked / row.sampled
}

export function isHeavy(row: ClientRow): boolean {
  const share = blockedShare(row)
  return share != null && (row.sampled ?? 0) >= HEAVY_MIN && share >= HEAVY_SHARE
}

export function isQuiet(row: ClientRow, totalQueries: number): boolean {
  return totalQueries > 0 && row.hits / totalQueries < QUIET_SHARE
}

/* THE LIST'S FILTERS (`?filter=`) and ORDERS (`?sort=`), each by its bar name; the
   first of each is the default and is left out of the bar. */
export const FILTERS = ['all', 'heavy', 'quiet'] as const
export type Filter = (typeof FILTERS)[number]
export const SORTS = ['queries', 'blocked', 'name'] as const
export type SortBy = (typeof SORTS)[number]

export function readFilter(v: string | null): Filter {
  return (FILTERS as readonly string[]).includes(v ?? '') ? (v as Filter) : 'all'
}

export function readSortBy(v: string | null): SortBy {
  return (SORTS as readonly string[]).includes(v ?? '') ? (v as SortBy) : 'queries'
}

export function matchesFilter(row: ClientRow, filter: Filter, totalQueries: number): boolean {
  if (filter === 'heavy') return isHeavy(row)
  if (filter === 'quiet') return isQuiet(row, totalQueries)
  return true
}

/** How many rows each filter keeps. */
export function filterCounts(rows: readonly ClientRow[], totalQueries: number): Record<Filter, number> {
  return {
    all: rows.length,
    heavy: rows.filter(isHeavy).length,
    quiet: rows.filter((r) => isQuiet(r, totalQueries)).length,
  }
}

/** An address or a name matches the search, case aside. */
export function matchesSearch(row: ClientRow, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (q === '') return true
  return row.ip.toLowerCase().includes(q) || (row.name ?? '').toLowerCase().includes(q)
}

function natural(a: string, b: string): number {
  return a.toLowerCase().localeCompare(b.toLowerCase(), 'en', { numeric: true })
}

/*
Most queries is the server's order (it already sends them so); Most blocked is the
blocked count in the sample, then the queries, with clients not in the sample last;
Name is the name shown, in natural order (`10.0.0.2` before `10.0.0.10`).
*/
export function sortRows(rows: readonly ClientRow[], by: SortBy): ClientRow[] {
  const out = [...rows]
  if (by === 'queries') return out.sort((a, b) => b.hits - a.hits)
  if (by === 'blocked') return out.sort((a, b) => (b.blocked ?? -1) - (a.blocked ?? -1) || b.hits - a.hits)
  return out.sort((a, b) => natural(label(a), label(b)) || natural(a.ip, b.ip))
}

export interface SampleSummary {
  /** Queries in the sample. */
  total: number
  /** Of them, blocked. */
  blocked: number
  /** The client with the most blocked queries in it, with the name Top Clients gives it. */
  mostBlocked: { ip: string; name: string | null; count: number } | null
}

export function summarise(sample: readonly QueryLogEntry[], names: readonly TopEntry[] = []): SampleSummary {
  const blockedEntries = sample.filter((e) => isBlocked(e.responseType))
  const first = countByClient(blockedEntries, names)[0]
  return {
    total: sample.length,
    blocked: blockedEntries.length,
    mostBlocked: first == null ? null : { ip: first.ip, name: first.name, count: first.count },
  }
}

export interface Busiest {
  /** The busiest clients, most first, with their share of the period's queries. */
  rows: { row: ClientRow; share: number }[]
  /** How much of the period's queries they add up to. */
  covered: number
}

/** The "Who uses your DNS" bar: the `BUSIEST` clients of the period. */
export function busiest(rows: readonly ClientRow[], totalQueries: number, n = BUSIEST): Busiest {
  const top = [...rows].sort((a, b) => b.hits - a.hits).slice(0, n)
  const share = (h: number) => (totalQueries > 0 ? h / totalQueries : 0)
  return {
    rows: top.map((row) => ({ row, share: share(row.hits) })),
    covered: share(top.reduce((s, r) => s + r.hits, 0)),
  }
}

/** The DHCP lease that hands out this address, when one does. */
export function leaseFor(leases: readonly DhcpLease[] | null, ip: string): DhcpLease | null {
  return leases?.find((l) => l.address === ip) ?? null
}

export interface DomainCount {
  domain: string
  count: number
}

export interface ClientCard {
  /** Queries read. */
  total: number
  /** The newest query's time, as the log writes it; `null` with none. */
  last: string | null
  /** Of them, blocked (the three classes). */
  blocked: number
  /** Of them, answered from the cache (`Cached`). */
  cached: number
  /** The median `responseRtt` of the entries that carry one, in ms; `null` with none. */
  medianRtt: number | null
  /** The domains it asked for most, all response types. */
  domains: DomainCount[]
  /** The domains it got blocked most. */
  blockedDomains: DomainCount[]
  /** Its query types, most frequent first. */
  types: TypeCount[]
  /** Its transport protocols, most frequent first. */
  protocols: TypeCount[]
}

/** Counts by value, most first; a tie keeps the order met (newest first). */
function countBy(values: readonly (string | null)[]): DomainCount[] {
  const seen = new Map<string, number>()
  for (const v of values) if (v != null && v !== '') seen.set(v, (seen.get(v) ?? 0) + 1)
  return [...seen.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count)
}

function asTypes(list: DomainCount[]): TypeCount[] {
  return list.map((d) => ({ type: d.domain, count: d.count }))
}

/** The middle value; with an even count, the mean of the two in the middle. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** One client's newest queries, counted for its card. */
export function clientCard(entries: readonly QueryLogEntry[], rows = DETAIL_ROWS): ClientCard {
  let last: string | null = null
  let lastAt = -Infinity
  for (const e of entries) {
    const at = Date.parse(e.timestamp)
    if (Number.isFinite(at) && at > lastAt) {
      lastAt = at
      last = e.timestamp
    }
  }
  const blockedEntries = entries.filter((e) => isBlocked(e.responseType))
  return {
    total: entries.length,
    last,
    blocked: blockedEntries.length,
    cached: entries.filter((e) => e.responseType === 'Cached').length,
    medianRtt: median(entries.map((e) => e.responseRtt).filter((r): r is number => r != null && Number.isFinite(r))),
    domains: countBy(entries.map((e) => e.qname)).slice(0, rows),
    blockedDomains: countBy(blockedEntries.map((e) => e.qname)).slice(0, rows),
    types: countByType(entries),
    protocols: asTypes(countBy(entries.map((e) => e.protocol))),
  }
}

export interface Activity {
  /** Each slice's start, as an instant. */
  starts: number[]
  total: number[]
  blocked: number[]
}

/*
The card's activity: its sample cut into `slices` equal stretches of time from its
oldest query to its newest, each counted whole and blocked. A sample whose queries
all share one instant is one slice.
*/
export function activity(entries: readonly QueryLogEntry[], slices = SLICES): Activity | null {
  const times = entries.map((e) => Date.parse(e.timestamp)).filter(Number.isFinite)
  if (times.length === 0) return null
  const from = Math.min(...times)
  const to = Math.max(...times)
  const n = to === from ? 1 : slices
  const width = (to - from) / n || 1
  const total = new Array<number>(n).fill(0)
  const blocked = new Array<number>(n).fill(0)
  for (const e of entries) {
    const at = Date.parse(e.timestamp)
    if (!Number.isFinite(at)) continue
    const i = Math.min(n - 1, Math.floor((at - from) / width))
    total[i]++
    if (isBlocked(e.responseType)) blocked[i]++
  }
  return { starts: total.map((_, i) => from + i * width), total, blocked }
}

/** The newest `n` entries, newest first. */
export function latest(entries: readonly QueryLogEntry[], n = LATEST): QueryLogEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, n)
}
