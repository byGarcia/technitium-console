import { getDashboardStats, type DashboardStats, type Range } from '../../api/dashboard'
import type { ApiOutcome } from '../../api/client'
import { noticeFromFailure } from '../../lib/notice'

/*
QUERIES ACROSS NODES (deviation 40 in CONVENTIONS.md, 2026-11-06): a period's
queries split by the cluster node that answered them. Each node counts the queries it
answered itself, so the period's `Total Queries` of `dashboard/stats/get`, read once
per node with that node's `node` (the Dashboard's read with a node chosen), is that
node's share; nothing else is asked.

The shares are of the nodes that answered: a node that did not is not a zero, it is
left out and named. The percentages are whole numbers that add up to 100, by the
largest remainder, so the list under the bar never reads 101%.
*/

export interface NodeRead {
  node: string
  outcome: ApiOutcome<DashboardStats>
}

/** The period's `stats/get`, once per node, with that node's `node`. */
export function readShares(token: string | null, range: Range, nodes: readonly string[]): Promise<NodeRead[]> {
  return Promise.all(
    nodes.map(async (node) => ({ node, outcome: await getDashboardStats(token, range, undefined, node) })),
  )
}

export interface Share {
  node: string
  count: number
  /** Of the answered total, 0 to 1, for the bar. */
  fraction: number
  /** Whole percent; the list's add up to 100 when anything was counted. */
  percent: number
}

export interface Shares {
  shares: Share[]
  total: number
  failed: { node: string; message: string }[]
}

export function sharesOf(reads: readonly NodeRead[]): Shares {
  const failed: Shares['failed'] = []
  const counted: { node: string; count: number }[] = []
  for (const r of reads) {
    if (r.outcome.kind !== 'ok') failed.push({ node: r.node, message: noticeFromFailure(r.outcome).text })
    else counted.push({ node: r.node, count: Math.max(0, Number(r.outcome.data.stats?.totalQueries) || 0) })
  }
  const total = counted.reduce((a, c) => a + c.count, 0)
  if (total === 0) return { shares: counted.map((c) => ({ ...c, fraction: 0, percent: 0 })), total, failed }

  const exact = counted.map((c) => (c.count * 100) / total)
  const percent = exact.map(Math.floor)
  let left = 100 - percent.reduce((a, p) => a + p, 0)
  /* The largest remainders take the points left, the first node first on a tie. */
  const order = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    percent[i] += 1
    left -= 1
  }
  return {
    shares: counted.map((c, i) => ({ ...c, fraction: c.count / total, percent: percent[i] })),
    total,
    failed,
  }
}
