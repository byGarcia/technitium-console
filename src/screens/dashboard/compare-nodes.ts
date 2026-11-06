import { getDashboardStats, type ChartData, type DashboardStats, type Range } from '../../api/dashboard'
import type { ApiOutcome } from '../../api/client'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import { nodeToken, type Series } from './palette'

/*
THE QUERIES COMPARED BY NODE (deviation 36 in CONVENTIONS.md, 2026-11-06). On an
initialised cluster with the aggregate chosen, `Compare nodes` draws the Queries
card as one line per node: each node's own `Total`, read with the request the
Dashboard already makes (`dashboard/stats/get`, the same period) and that node's
`node`, once per node.

The chart's axis is the aggregate's answer on screen, and each node's line is laid
on it by the instants the server wrote (`instants`, the UTC end of each bucket), so
a node that answered a minute later does not slide its readings one slot over; a
bucket a node has no reading for is a gap, not a zero. Without instants (an older
server) the readings are laid by position.
*/

export interface NodeStats {
  node: string
  outcome: ApiOutcome<DashboardStats>
}

/** The period's `stats/get`, once per node, with that node's `node`. */
export function readNodes(
  token: string | null,
  range: Range,
  requested: { start: string; end: string } | null,
  nodes: readonly ClusterNode[],
): Promise<NodeStats[]> {
  return Promise.all(
    nodes.map(async (n) => ({ node: n.name, outcome: await getDashboardStats(token, range, requested ?? undefined, n.name) })),
  )
}

/** The `Total` of one answer, laid on the axis's buckets. */
function totalOn(axis: ChartData, own: ChartData | undefined): number[] {
  const total = own?.datasets?.find((d) => d.label === 'Total')?.data ?? []
  const slots = axis.labels.length
  if (axis.instants != null && own?.instants != null) {
    const at = new Map<number, number>()
    own.instants.forEach((t, i) => at.set(Date.parse(t), Number(total[i] ?? Number.NaN)))
    const laid = axis.instants.map((t) => at.get(Date.parse(t)) ?? Number.NaN)
    /* Not one bucket in common is not a node that was quiet: the two answers are
       labelled differently, and the readings are laid by position instead. */
    if (laid.some((v) => !Number.isNaN(v)) || total.length === 0) return laid
  }
  return Array.from({ length: slots }, (_, i) => (i < total.length ? Number(total[i]) : Number.NaN))
}

/**
 * The compared chart: the aggregate's buckets, one series per node that answered,
 * named after it, and the nodes whose read failed, which are left out.
 */
export function nodesChart(axis: ChartData, reads: readonly NodeStats[]): { chart: ChartData; failed: string[] } {
  const failed: string[] = []
  const datasets: ChartData['datasets'] = []
  for (const r of reads) {
    if (r.outcome.kind !== 'ok') {
      failed.push(r.node)
      continue
    }
    datasets.push({ label: r.node, data: totalOn(axis, r.outcome.data.mainChartData) })
  }
  return {
    chart: { labelFormat: axis.labelFormat, labels: axis.labels, instants: axis.instants, datasets },
    failed,
  }
}

/** Each node's line in that node's colour, by its place in the session's list of
 *  nodes, whatever else failed: the colour Cache's `All nodes` gives it too. */
export function nodeSeries(nodes: readonly ClusterNode[]): Series {
  return (label, index) => {
    const at = nodes.findIndex((n) => n.name === label)
    return nodeToken(at === -1 ? index : at)
  }
}
