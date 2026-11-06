import type { QueryLogEntry } from '../../api/logs'

/*
How a query is resolved (CONVENTIONS.md, deviation 29): the newest logged queries
counted twice, by how the server answered (`responseType`) and by what it answered
(`rcode`), and the pairs between the two, which the Dashboard draws as a flow. The
three blocked kinds count as one, `Blocked`; a type or code with no name of its own
counts as `Other`.
*/
export interface FlowNode {
  /** The log's value, for Query Logs' filter; `null` for `Other` (no filter can ask for it). */
  value: string | null
  label: string
  count: number
  tone: string
}

export interface Flow {
  total: number
  how: FlowNode[]
  what: FlowNode[]
  /** `links[i][j]`: queries answered the `how[i]` way with `what[j]`. */
  links: number[][]
}

const HOW: { value: string | null; label: string; tone: string; match: (t: string) => boolean }[] = [
  { value: 'Cached', label: 'Cached', tone: '--ch-cache', match: (t) => t === 'cached' },
  { value: 'Recursive', label: 'Recursive', tone: '--ch-rec', match: (t) => t === 'recursive' },
  { value: 'Authoritative', label: 'Authoritative', tone: '--ch-auth', match: (t) => t === 'authoritative' },
  { value: 'Blocked', label: 'Blocked', tone: '--ch-block', match: (t) => t.includes('blocked') },
  { value: null, label: 'Other', tone: '--ch-drop', match: () => true },
]

const WHAT: { value: string | null; label: string; tone: string; match: (r: string) => boolean }[] = [
  { value: 'NoError', label: 'No Error', tone: '--ch-ok', match: (r) => r === 'noerror' },
  { value: 'NxDomain', label: 'NX Domain', tone: '--ch-nx', match: (r) => r === 'nxdomain' },
  { value: 'ServerFailure', label: 'Server Failure', tone: '--ch-fail', match: (r) => r === 'serverfailure' },
  { value: 'Refused', label: 'Refused', tone: '--ch-refuse', match: (r) => r === 'refused' },
  { value: null, label: 'Other', tone: '--ch-drop', match: () => true },
]

export function flowOf(entries: readonly QueryLogEntry[] | null | undefined): Flow {
  const list = entries ?? []
  const links = HOW.map(() => WHAT.map(() => 0))
  for (const e of list) {
    const i = HOW.findIndex((h) => h.match((e.responseType ?? '').toLowerCase()))
    const j = WHAT.findIndex((w) => w.match((e.rcode ?? '').toLowerCase()))
    links[i][j]++
  }
  const how = HOW.map((h, i) => ({ value: h.value, label: h.label, tone: h.tone, count: links[i].reduce((a, b) => a + b, 0) }))
  const what = WHAT.map((w, j) => ({ value: w.value, label: w.label, tone: w.tone, count: links.reduce((a, row) => a + row[j], 0) }))
  /* Empty kinds are left out, and their rows and columns with them. */
  const keepHow = how.map((n) => n.count > 0)
  const keepWhat = what.map((n) => n.count > 0)
  return {
    total: list.length,
    how: how.filter((_, i) => keepHow[i]),
    what: what.filter((_, j) => keepWhat[j]),
    links: links.filter((_, i) => keepHow[i]).map((row) => row.filter((_, j) => keepWhat[j])),
  }
}

export interface Placed {
  y: number
  h: number
}

/** Where each node of a column sits, top to bottom, `gap` apart, on a column `height` tall. */
export function place(counts: readonly number[], height: number, gap: number): Placed[] {
  const total = counts.reduce((a, b) => a + b, 0)
  const room = Math.max(0, height - gap * Math.max(0, counts.length - 1))
  let y = 0
  return counts.map((c) => {
    const h = total === 0 ? 0 : (c / total) * room
    const at = { y, h }
    y += h + gap
    return at
  })
}
