import type { AdminSession } from '../../api/admin'
import { sessionKind, type SessionKind } from '../profile/profile'

/* What the Sessions strip counts (`SessionsSummary.tsx`, deviation 23). */

const ORDER = ['Standard', 'ApiToken', 'ClusterApiToken', 'Unknown']

export function kindsOf(sessions: readonly AdminSession[]): { kind: SessionKind; count: number }[] {
  const counts = new Map<string, { kind: SessionKind; count: number }>()
  for (const s of sessions) {
    const k = sessionKind(s.type)
    const entry = counts.get(k.key) ?? { kind: k, count: 0 }
    entry.count++
    counts.set(k.key, entry)
  }
  return ORDER.filter((k) => counts.has(k)).map((k) => counts.get(k)!)
}

/** The values most seen first, ties in the order they first came. */
export function tally(values: readonly string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
}
