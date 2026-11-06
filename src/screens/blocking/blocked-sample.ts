import type { TopEntry } from '../../api/dashboard'
import type { QueryLogEntry } from '../../api/logs'

/*
What the latest blocked queries say about who asked and for what: the counts the
Overview's "Blocked by client" card draws (`BlockedBy.tsx`). OURS: upstream has no
such count. The entries are the ones Recently Blocked reads (`logs/query` through the
query logs app, the three blocked classes merged by `recentBlocked`), only more of
them: a sample of the newest `SAMPLE` blocked queries, which is what the card says
it is based on. Nothing here asks the server.
*/

/** How many of the newest blocked queries the card counts. */
export const SAMPLE = 1000

export interface ClientCount {
  /** The client's address, as the log writes it. */
  ip: string
  /** The name the server gave that address in its Top Clients, when it is there. */
  name: string | null
  count: number
  /** The one blocked response type all its entries share, for the jump to Query
      Logs (which filters by one); `null` when they are of more than one. */
  responseType: string | null
}

export interface TypeCount {
  type: string
  count: number
}

/**
 * The clients of the sample, most blocked first; a tie keeps the order in which they
 * were first met, newest first. `names` is the period's Top Clients (`stats/get`),
 * whose `domain` is the name the server resolved for the address.
 */
export function countByClient(entries: readonly QueryLogEntry[], names: readonly TopEntry[] = []): ClientCount[] {
  const known = new Map<string, string>()
  for (const c of names) if (c.domain != null && c.domain !== '') known.set(c.name, c.domain)

  const seen = new Map<string, { count: number; types: Set<string> }>()
  for (const e of entries) {
    const ip = e.clientIpAddress
    if (ip == null || ip === '') continue
    const row = seen.get(ip) ?? { count: 0, types: new Set<string>() }
    row.count++
    row.types.add(e.responseType)
    seen.set(ip, row)
  }
  return [...seen.entries()]
    .map(([ip, r]) => ({
      ip,
      name: known.get(ip) ?? null,
      count: r.count,
      responseType: r.types.size === 1 ? [...r.types][0] : null,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * The query types of the sample, most frequent first. An entry without a question
 * (`qtype` null) is not a type and is left out.
 */
export function countByType(entries: readonly QueryLogEntry[]): TypeCount[] {
  const seen = new Map<string, number>()
  for (const e of entries) {
    if (e.qtype == null || e.qtype === '') continue
    seen.set(e.qtype, (seen.get(e.qtype) ?? 0) + 1)
  }
  return [...seen.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
}
