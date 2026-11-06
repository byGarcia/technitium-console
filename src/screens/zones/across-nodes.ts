import { zoneNameOf, type Zone } from '../../api/zones'

/*
THE ZONE LIST ACROSS CLUSTER NODES (deviation 33 in CONVENTIONS.md). Upstream
reads the zone list of one node at a time, through `optZonesClusterNode`; this
reads it once per node (`zones/list` with that node's `node`, the same call) and
lays the answers side by side, one line per zone name.

It only reads. What a line says comes from the zones the nodes answered and from
nothing else:

  · a node that answered and does not hold the zone: `not on this node`;
  · a node that did not answer: no value, and the reason is said once for the
    whole column, with the server's message. Such a node is left out of every
    comparison, because nothing is known about it: a zone is not "only on some
    nodes" because a node failed to say it holds it.

The health of a line is ONE of four words, the first that applies, in this order:

  1. `Only on N nodes`: some answering node does not hold it.
  2. `Serial differs`: two nodes that hold it give different SOA serials. Only
     the serials a node gives count: a Forwarder or a Stub may give none.
  3. `Disabled on a node`: some node holds it disabled.
  4. `Healthy`.

The filters are counted on their own rule, not on that word: a zone missing from
a node whose serials also differ counts under both `Only on some nodes` and
`Serial differs`.
*/

export interface NodeAnswer {
  node: string
  /** The zones it holds, or the reason it gave none. */
  outcome: { ok: true; zones: Zone[] } | { ok: false; message: string }
}

export type Health = 'healthy' | 'some' | 'serial' | 'disabled'

export interface AcrossRow {
  /** The zone's name as the server writes it; the root is `.`. */
  name: string
  /** The name as the list draws it (`zoneNameOf`). */
  label: string
  /** Each node's zone, `null` when that node answered without it, `undefined` when it did not answer. */
  perNode: Record<string, Zone | null | undefined>
  /** How many answering nodes hold it. */
  holders: number
  health: Health
  onEvery: boolean
  serialDiffers: boolean
  disabledSomewhere: boolean
}

export type AcrossFilter = 'all' | 'every' | 'some' | 'serial'

export const ACROSS_FILTERS: AcrossFilter[] = ['all', 'every', 'some', 'serial']

export const ACROSS_FILTER_LABEL: Record<AcrossFilter, string> = {
  all: 'All',
  every: 'On every node',
  some: 'Only on some nodes',
  serial: 'Serial differs',
}

export function healthText(row: Pick<AcrossRow, 'health' | 'holders'>): string {
  switch (row.health) {
    case 'some':
      return `Only on ${row.holders} ${row.holders === 1 ? 'node' : 'nodes'}`
    case 'serial':
      return 'Serial differs'
    case 'disabled':
      return 'Disabled on a node'
    default:
      return 'Healthy'
  }
}

const nameOf = (z: Zone) => (z.name === '' ? '.' : z.name)

/** Merges the answers by zone name, in name order. */
export function mergeAcrossNodes(answers: NodeAnswer[]): AcrossRow[] {
  const answering = answers.filter((a) => a.outcome.ok)
  const byName = new Map<string, { label: string; perNode: Record<string, Zone | null | undefined> }>()

  for (const a of answering) {
    if (!a.outcome.ok) continue
    for (const z of a.outcome.zones) {
      const key = nameOf(z).toLowerCase()
      let entry = byName.get(key)
      if (entry == null) {
        entry = { label: zoneNameOf(z), perNode: {} }
        byName.set(key, entry)
      }
      entry.perNode[a.node] = z
    }
  }

  const rows: AcrossRow[] = []
  for (const entry of byName.values()) {
    const perNode: Record<string, Zone | null | undefined> = {}
    for (const a of answers) perNode[a.node] = a.outcome.ok ? (entry.perNode[a.node] ?? null) : undefined
    const held = answering.flatMap((a) => (perNode[a.node] != null ? [perNode[a.node] as Zone] : []))
    const serials = new Set(held.flatMap((z) => (z.soaSerial == null ? [] : [z.soaSerial])))
    const onEvery = held.length === answering.length
    const serialDiffers = serials.size > 1
    const disabledSomewhere = held.some((z) => z.disabled)
    const health: Health = !onEvery ? 'some' : serialDiffers ? 'serial' : disabledSomewhere ? 'disabled' : 'healthy'
    rows.push({
      name: nameOf(held[0]),
      label: entry.label,
      perNode,
      holders: held.length,
      health,
      onEvery,
      serialDiffers,
      disabledSomewhere,
    })
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label))
}

export function matchesAcross(row: AcrossRow, filter: AcrossFilter): boolean {
  switch (filter) {
    case 'every':
      return row.onEvery
    case 'some':
      return !row.onEvery
    case 'serial':
      return row.serialDiffers
    default:
      return true
  }
}

export function countAcross(rows: AcrossRow[]): Record<AcrossFilter, number> {
  const out = { all: 0, every: 0, some: 0, serial: 0 }
  for (const r of rows) for (const f of ACROSS_FILTERS) if (matchesAcross(r, f)) out[f]++
  return out
}

/** A filter from the address bar, or `all` for anything it does not know. */
export function readAcrossFilter(v: string | null): AcrossFilter {
  return v != null && (ACROSS_FILTERS as string[]).includes(v) ? (v as AcrossFilter) : 'all'
}
