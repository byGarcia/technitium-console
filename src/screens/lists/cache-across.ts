import { listNode, type DnsRecord } from '../../api/zonelists'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import { noticeFromFailure } from '../../lib/notice'

/*
ONE CACHE NODE ACROSS THE CLUSTER (deviation 35 in CONVENTIONS.md, 2026-11-06).
Each node of a cluster keeps its own cache, and upstream shows one node at a time
(other-zones.js:106, `optCachedZonesClusterNode`). Cache's `All nodes` view reads
the domain on screen from every node, with the same `cache/list` the screen sends
and that node's `node`, and lays the answers side by side, record by record.

Two facts about the server that this reads, checked against WebServiceOtherZonesApi.cs
on 2026-11-06:

  · `cache/list` for a domain a node does not hold answers that domain with no
    records and no zones: it is an empty node, not a failure.
  · A node whose own cache has no records at that domain and exactly one child
    walks down to the child on its own (lines 88-120), and then answers ANOTHER
    domain. That node holds nothing at the domain asked for, so its answer counts
    as no records, never as records of the domain on screen.
*/

/** One node's answer for the domain on screen. */
export type NodeCache =
  | { node: string; kind: 'ok'; records: DnsRecord[]; zones: string[] }
  | { node: string; kind: 'failed'; message: string }

/** A record as the cluster holds it: the same name, type and data, and each
 *  node's copy of it (its TTL is that node's own). */
export interface AcrossRow {
  key: string
  record: DnsRecord
  held: Map<string, DnsRecord>
}

export type Spread = 'all' | 'every' | 'some'

/** What makes two cached records the same record: name, type and value. */
export function recordKey(r: DnsRecord): string {
  return `${r.name.toLowerCase()}\n${r.type}\n${JSON.stringify(r.rData ?? {})}`
}

/** Reads the domain from every node, once each, with that node's `node`. The node
 *  the screen has just read (`known`) is not asked again: its answer is used. */
export async function readAcross(
  token: string | null,
  domain: string,
  nodes: readonly ClusterNode[],
  known?: { node: string; records: DnsRecord[]; zones: string[] },
): Promise<NodeCache[]> {
  return Promise.all(
    nodes.map(async (n): Promise<NodeCache> => {
      if (known != null && known.node !== '' && known.node === n.name) {
        return { node: n.name, kind: 'ok', records: known.records, zones: known.zones }
      }
      const outcome = await listNode('cache', token, domain, undefined, n.name)
      if (outcome.kind !== 'ok') {
        return { node: n.name, kind: 'failed', message: noticeFromFailure(outcome).text }
      }
      const here = outcome.data.domain.toLowerCase() === domain.toLowerCase()
      return {
        node: n.name,
        kind: 'ok',
        records: here ? (outcome.data.records ?? []) : [],
        zones: here ? (outcome.data.zones ?? []) : [],
      }
    }),
  )
}

/** The records of every node that answered, merged by name, type and value, in
 *  the order the nodes first write them (the server groups them by type). */
export function mergeAcross(reads: readonly NodeCache[]): AcrossRow[] {
  const rows = new Map<string, AcrossRow>()
  for (const read of reads) {
    if (read.kind !== 'ok') continue
    for (const r of read.records) {
      const key = recordKey(r)
      let row = rows.get(key)
      if (row == null) {
        row = { key, record: r, held: new Map() }
        rows.set(key, row)
      }
      if (!row.held.has(read.node)) row.held.set(read.node, r)
    }
  }
  return [...rows.values()]
}

/** The nodes whose answer arrived: a node that failed cannot say what it holds. */
export function answered(reads: readonly NodeCache[]): string[] {
  return reads.flatMap((r) => (r.kind === 'ok' ? [r.node] : []))
}

/** Whether a record is on every node that answered, or on some of them only. */
export function spreadOf(row: AcrossRow, nodes: readonly string[]): Exclude<Spread, 'all'> {
  return nodes.every((n) => row.held.has(n)) ? 'every' : 'some'
}

export function filterRows(rows: readonly AcrossRow[], spread: Spread, nodes: readonly string[]): AcrossRow[] {
  return spread === 'all' ? [...rows] : rows.filter((r) => spreadOf(r, nodes) === spread)
}

/** The zones under the domain on any node, each once, sorted as the server sorts them. */
export function zonesAcross(reads: readonly NodeCache[]): string[] {
  const all = new Set<string>()
  for (const r of reads) if (r.kind === 'ok') for (const z of r.zones) all.add(z)
  return [...all].sort()
}
