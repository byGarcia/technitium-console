/*
The DNS Client's recent queries (2026-11-06, deviation 18): the last ones that came
back, newest first, in this browser's storage only. A per-viewer convenience: the
storage may refuse (a private window, blocked site data), and then the list is
simply empty and nothing else changes.
*/
export interface RecentQuery {
  server: string
  domain: string
  type: string
  protocol: string
}

const KEY = 'dnsclient-recent'
const KEPT = 8

export function readRecent(): RecentQuery[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw == null ? [] : JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list
      .filter(
        (q): q is RecentQuery =>
          q != null &&
          typeof q === 'object' &&
          ['server', 'domain', 'type', 'protocol'].every((k) => typeof (q as Record<string, unknown>)[k] === 'string'),
      )
      .slice(0, KEPT)
  } catch {
    return []
  }
}

/** Puts a query at the head of the list (once) and returns the new list. */
export function rememberQuery(q: RecentQuery): RecentQuery[] {
  const same = (a: RecentQuery) =>
    a.server === q.server && a.domain === q.domain && a.type === q.type && a.protocol === q.protocol
  const next = [q, ...readRecent().filter((a) => !same(a))].slice(0, KEPT)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* No storage: the list lives for this screen only. */
  }
  return next
}
