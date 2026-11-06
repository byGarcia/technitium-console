import { listLeases, listScopes, type DhcpLease, type DhcpScopeRow } from '../../api/dhcp'
import { noticeFromFailure } from '../../lib/notice'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import type { NodeFailure } from '../../ui/AcrossNodes'

/*
DHCP ACROSS THE CLUSTER'S NODES (deviation 38 in CONVENTIONS.md, 2026-11-06). Each
node runs its own DHCP server and upstream shows one at a time
(`optDhcpClusterNode`). The `All nodes` view of Leases and of Scopes reads every
node's lists, the same `dhcp/leases/list` and `dhcp/scopes/list` the tabs send,
with that node's `node`, and draws their rows together, each carrying the node it
came from.

  · A row keeps its node (`node`), and everything done to it is sent to that node:
    a lease's conversions and Remove Lease, a scope's Enable, Disable, Edit and
    Delete. A scope's usage (deviation 30) counts only the leases of its own node:
    two nodes can each have a scope of the same name.
  · A node that fails is named with the server's message and its rows are not
    there. On Scopes a node counts as read only when both of its lists answered,
    so the usage and the cards never mix a node's scopes with leases it did not
    send.
  · With one node the rows carry no `node`, and every key, count and call is the
    one the tab always had.
*/

/** A lease, and in the `All nodes` view the node it was read from. */
export type NodeLease = DhcpLease & { node?: string }
/** A scope's row, and in the `All nodes` view the node it was read from. */
export type NodeScopeRow = DhcpScopeRow & { node?: string }

/** A scope's identity on screen: its name is only unique on its own node. */
export function scopeKey(s: NodeScopeRow): string {
  return s.node == null ? s.name : `${s.node}\n${s.name}`
}

export interface LeasesAcross {
  leases: NodeLease[]
  failed: NodeFailure[]
  /** How many nodes answered. */
  answered: number
}

/** `dhcp/leases/list` from every node, once each, with that node's `node`. */
export async function leasesAcross(token: string | null, nodes: readonly ClusterNode[]): Promise<LeasesAcross> {
  const answers = await Promise.all(nodes.map(async (n) => ({ node: n.name, outcome: await listLeases(token, n.name) })))
  const out: LeasesAcross = { leases: [], failed: [], answered: 0 }
  for (const a of answers) {
    if (a.outcome.kind !== 'ok') {
      out.failed.push({ node: a.node, message: noticeFromFailure(a.outcome).text })
      continue
    }
    out.answered++
    for (const l of a.outcome.data) out.leases.push({ ...l, node: a.node })
  }
  return out
}

export interface ScopesAcross extends LeasesAcross {
  scopes: NodeScopeRow[]
}

/** `dhcp/scopes/list` and `dhcp/leases/list` from every node, side by side, with that node's `node`. */
export async function scopesAcross(token: string | null, nodes: readonly ClusterNode[]): Promise<ScopesAcross> {
  const answers = await Promise.all(
    nodes.map(async (n) => {
      const [scopes, leases] = await Promise.all([listScopes(token, n.name), listLeases(token, n.name)])
      return { node: n.name, scopes, leases }
    }),
  )
  const out: ScopesAcross = { scopes: [], leases: [], failed: [], answered: 0 }
  for (const a of answers) {
    const failure = a.scopes.kind !== 'ok' ? a.scopes : a.leases.kind !== 'ok' ? a.leases : null
    if (failure != null || a.scopes.kind !== 'ok' || a.leases.kind !== 'ok') {
      out.failed.push({ node: a.node, message: noticeFromFailure(failure ?? { kind: 'error' }).text })
      continue
    }
    out.answered++
    for (const s of a.scopes.data) out.scopes.push({ ...s, node: a.node })
    for (const l of a.leases.data) out.leases.push({ ...l, node: a.node })
  }
  return out
}
