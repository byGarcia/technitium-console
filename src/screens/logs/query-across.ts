import { queryLogs, type QueryLogEntry, type QueryLogPage, type QueryLogsParams } from '../../api/logs'
import { noticeFromFailure } from '../../lib/notice'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import type { NodeFailure } from '../../ui/AcrossNodes'

/*
QUERY LOGS ACROSS THE CLUSTER'S NODES (deviation 37 in CONVENTIONS.md, 2026-11-06).
Each node keeps its own query log and upstream reads one at a time
(`optLogsClusterNode`). The `All nodes` view sends the form's query to every node,
the same `logs/query` the screen sends with that node's `node`, and lays the
answers out as one list.

  · Each node is asked for its FIRST page, newest first, with the entries per page
    chosen: whatever the form says about the page and the order, because only the
    newest page can be merged honestly. Page 2 of a merge would need every node's
    entries down to an instant no node can be asked for.
  · The answers are merged by their timestamp, newest first, and cut to the page
    size: the newest N across the nodes. Two entries of the same instant keep the
    order of the nodes in the session's list, then each node's own order.
  · Each node's total is its own `totalEntries` for the filters; the page's total
    is their sum. A node that fails is named with the server's message and takes no
    part in either.
*/

/** An entry with the node it was read from. */
export type NodeEntry = QueryLogEntry & { node: string }

export type NodeLogs =
  | { node: string; kind: 'ok'; total: number; entries: QueryLogEntry[] }
  | { node: string; kind: 'failed'; message: string }

/** A row's identity on screen: its row number is only unique on its own node. */
export function rowKey(e: QueryLogEntry & { node?: string }): string {
  return `${e.node ?? ''}\n${e.rowNumber}`
}

/** The query the view sends each node: the form's, on page 1, newest first. */
export function acrossParams(params: QueryLogsParams, node: string): QueryLogsParams {
  return { ...params, pageNumber: '1', descendingOrder: 'true', node }
}

/** Sends the query to every node, once each, with that node's `node`. */
export async function queryAcross(
  token: string | null,
  params: QueryLogsParams,
  nodes: readonly ClusterNode[],
): Promise<NodeLogs[]> {
  return Promise.all(
    nodes.map(async (n): Promise<NodeLogs> => {
      const outcome = await queryLogs(token, acrossParams(params, n.name))
      if (outcome.kind !== 'ok') return { node: n.name, kind: 'failed', message: noticeFromFailure(outcome).text }
      const page = outcome.data.response
      return { node: n.name, kind: 'ok', total: page?.totalEntries ?? 0, entries: page?.entries ?? [] }
    }),
  )
}

/** The newest `limit` entries of every node that answered, newest first. */
export function mergeNewest(reads: readonly NodeLogs[], limit: number): NodeEntry[] {
  const all: { e: NodeEntry; at: number; node: number; i: number }[] = []
  reads.forEach((r, node) => {
    if (r.kind !== 'ok') return
    r.entries.forEach((e, i) => {
      const at = Date.parse(e.timestamp)
      all.push({ e: { ...e, node: r.node }, at: Number.isNaN(at) ? -Infinity : at, node, i })
    })
  })
  all.sort((a, b) => b.at - a.at || a.node - b.node || a.i - b.i)
  return all.slice(0, Math.max(0, limit)).map((x) => x.e)
}

/** Each answering node's total for the filters, in the session's order. */
export function nodeTotals(reads: readonly NodeLogs[]): { node: string; total: number }[] {
  return reads.flatMap((r) => (r.kind === 'ok' ? [{ node: r.node, total: r.total }] : []))
}

export function failures(reads: readonly NodeLogs[]): NodeFailure[] {
  return reads.flatMap((r) => (r.kind === 'failed' ? [{ node: r.node, message: r.message }] : []))
}

/** The merge as the page the screen draws: one page, the nodes' totals summed. */
export function mergedPage(reads: readonly NodeLogs[], limit: number): QueryLogPage & { entries: NodeEntry[] } {
  return {
    pageNumber: 1,
    totalPages: 1,
    totalEntries: nodeTotals(reads).reduce((s, t) => s + t.total, 0),
    entries: mergeNewest(reads, limit),
  }
}

/** The status the merged view writes where one node's page says `1-25 (25) of …`. */
export function acrossStatus(shown: number): string {
  return shown === 0 ? '0 logs' : `Newest ${shown} across the nodes`
}
