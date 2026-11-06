import type { TopEntry } from '../../api/dashboard'
import type { QueryLogEntry } from '../../api/logs'
import { BLOCKED_TYPES } from '../../api/blocking'
import type { Keys } from '../../ui/Table'
import { countByClient, countByType, type TypeCount } from '../blocking/blocked-sample'

/*
What the Clients page (CONVENTIONS.md, deviation 25) works out from what the server
sends. Nothing here asks the server, and nothing here writes words.

Two sources, never mixed in one figure:

  · the PERIOD: `dashboard/stats/get` (the count of clients) and
    `dashboard/stats/getTop` with `statsType=TopClients` (one entry per client, its
    queries in the period), the calls upstream's Dashboard and its "More" make;
  · the LOG SAMPLE: the newest `SAMPLE` queries of `logs/query`, every response
    type, through the query logs app. The log has no counts per period, so whatever
    is counted from it (blocked per client, the blocked share, one client's
    domains) is counted over the sample and the screen says which.

Blocked is the three response types `totalBlocked` adds up (`BLOCKED_TYPES`), as
Blocking › Overview counts them.
*/

/** How many clients the table asks for: what upstream's "More" asks (index.html:336). */
export const LIMIT = 1000

/** How many of one client's newest queries its details count. */
export const DETAIL_SAMPLE = 500

/** Rows on one page of the table. */
export const PER_PAGE = 25

/** How many domains each of a client's two lists shows: the Dashboard's top lists show five. */
export const DETAIL_ROWS = 5

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
  /**
   * Its blocked queries in the log sample; `null` when there is no sample, or when
   * the client is not in it at all (none of the newest queries are its own), which
   * is not the same as none of them blocked.
   */
  blocked: number | null
}

/**
 * The table's rows: the period's Top Clients in the server's order (most queries
 * first), each with what the sample says it had blocked.
 */
export function clientRows(top: readonly TopEntry[], sample: readonly QueryLogEntry[] | null): ClientRow[] {
  const seen = new Set<string>()
  const blocked = new Map<string, number>()
  if (sample != null) {
    for (const e of sample) if (e.clientIpAddress != null && e.clientIpAddress !== '') seen.add(e.clientIpAddress)
    for (const c of countByClient(sample.filter((e) => isBlocked(e.responseType)))) blocked.set(c.ip, c.count)
  }
  return top.map((t) => ({
    ip: t.name,
    name: t.domain != null && t.domain !== '' ? t.domain : null,
    hits: t.hits,
    rateLimited: t.rateLimited === true,
    blocked: sample == null || !seen.has(t.name) ? null : (blocked.get(t.name) ?? 0),
  }))
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

export interface DomainCount {
  domain: string
  count: number
}

export interface ClientDetail {
  /** Queries read. */
  total: number
  /** The newest query's time, as the log writes it; `null` with none. */
  last: string | null
  /** The domains it asked for most, all response types. */
  domains: DomainCount[]
  /** The domains it got blocked most. */
  blocked: DomainCount[]
  /** Its query types, most frequent first. */
  types: TypeCount[]
  /** Its response types, most frequent first. */
  responses: TypeCount[]
}

/** Counts by name, most first; a tie keeps the order met (newest first). */
function countBy(values: readonly string[]): DomainCount[] {
  const seen = new Map<string, number>()
  for (const v of values) seen.set(v, (seen.get(v) ?? 0) + 1)
  return [...seen.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count)
}

/** A query's domain, or `null` for an entry without a question. */
function asked(e: QueryLogEntry): string | null {
  return e.qname == null || e.qname === '' ? null : e.qname
}

/** One client's newest queries, counted for its details. */
export function clientDetail(entries: readonly QueryLogEntry[], rows = DETAIL_ROWS): ClientDetail {
  let last: string | null = null
  let lastAt = -Infinity
  for (const e of entries) {
    const at = Date.parse(e.timestamp)
    if (Number.isFinite(at) && at > lastAt) {
      lastAt = at
      last = e.timestamp
    }
  }
  const named = (list: readonly QueryLogEntry[]) =>
    list.map(asked).filter((d): d is string => d != null)
  return {
    total: entries.length,
    last,
    domains: countBy(named(entries)).slice(0, rows),
    blocked: countBy(named(entries.filter((e) => isBlocked(e.responseType)))).slice(0, rows),
    types: countByType(entries),
    responses: countBy(entries.map((e) => e.responseType).filter((t) => t != null && t !== '')).map((r) => ({
      type: r.domain,
      count: r.count,
    })),
  }
}

/*
SORTING. The table's order is in the address bar (`?sort=`): the column's name for
ascending, with a `-` before it for descending, and nothing for the server's own
order (most queries first). A column sorts as upstream's tables do, ascending unless
it is already ascending as drawn, and then descending (`ui/Table`, `useSort`); but
figures compare as figures and addresses as addresses (`10.0.0.2` before
`10.0.0.10`), where upstream's text comparison would put `100` before `20`.
*/
export interface ClientSort {
  field: string
  desc: boolean
}

export function readSort(value: string | null, keys: Keys<ClientRow>): ClientSort | null {
  if (value == null || value === '') return null
  const desc = value.startsWith('-')
  const field = desc ? value.slice(1) : value
  return keys[field] == null ? null : { field, desc }
}

export function writeSort(sort: ClientSort | null): string | null {
  return sort == null ? null : `${sort.desc ? '-' : ''}${sort.field}`
}

type Value = string | number | null | undefined

/** Empty values first, then figures by size, then text in natural order. */
function compare(x: Value, y: Value): number {
  const xe = x == null || x === ''
  const ye = y == null || y === ''
  if (xe || ye) return xe === ye ? 0 : xe ? -1 : 1
  if (typeof x === 'number' && typeof y === 'number') return x - y
  return String(x).toLowerCase().localeCompare(String(y).toLowerCase(), 'en', { numeric: true })
}

export function sortClients(rows: readonly ClientRow[], sort: ClientSort | null, keys: Keys<ClientRow>): ClientRow[] {
  const read = sort == null ? undefined : keys[sort.field]
  if (sort == null || read == null) return [...rows]
  const sign = sort.desc ? -1 : 1
  return [...rows].sort((a, b) => compare(read(a), read(b)) * sign)
}

/** The sort after a click on `field`, looking at the rows as they are drawn. */
export function nextSort(field: string, drawn: readonly ClientRow[], keys: Keys<ClientRow>): ClientSort | null {
  const read = keys[field]
  if (read == null) return null
  const alreadyAsc = drawn.every((r, i) => i === 0 || compare(read(drawn[i - 1]), read(r)) <= 0)
  return { field, desc: alreadyAsc }
}
