import { useState } from 'react'
import { ClusterNodeSelect } from '../../ui/ClusterNodeSelect'
import { Leases } from './Leases'
import { Scopes } from './Scopes'

/*
DHCP. Two sub-tabs, with upstream's literal labels (index.html:2496-2497):
"Leases" and "Scopes".

The sub-navigation is NOT mounted here: it lives in the Shell's side panel, just
like Settings', and arrives through the `sub` prop. Unlike Settings, the two
sub-tabs are independent screens (each with its own loading and its own state), so
they can be split up: in upstream they are two different functions,
`refreshDhcpLeases` and `refreshDhcpScopes`, and they share no form.

Upstream's cluster node selector (`optDhcpClusterNode`) is not mounted: this
console has no cluster mode yet. The `node` parameter travels all the same,
empty, on all ten calls, which is what upstream sends with a single server.
*/

export const SUB_TABS = ['Leases', 'Scopes'] as const
export type SubTab = (typeof SUB_TABS)[number]

export interface DhcpProps {
  /** The cluster nodes, for the node selector. */
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean

  token: string | null
  /** The active sub-tab, the one the Shell's side panel marks. */
  sub?: string | null
  /** It exists for symmetry with Settings; this screen never forces a change. */
  onSubChange?: (sub: SubTab) => void
  /** `DhcpServer.canModify`: saving a scope, enabling it, disabling it and
   *  converting a lease (`WebServiceDhcpApi.cs:379,708,733,805,835`). */
  canModify?: boolean
  /** `DhcpServer.canDelete`: deleting a scope and removing a lease
   *  (`WebServiceDhcpApi.cs:761,775`). Careful: it is NOT `canModify`. */
  canDelete?: boolean
  /** The cluster node. Empty means "this server". */
  node?: string
}

export function Dhcp({
  onSubChange,
  nodes = [],
  clusterInitialised = false,
  token,
  sub,
  canModify = true,
  canDelete = true,
}: DhcpProps) {
  /* Which node this screen reads. Upstream mounts a selector here
     and the parameter was already travelling empty. */
  const [node, setNode] = useState<string>(() => '')
  const [nodeLocked, setNodeLocked] = useState(false)
  /* A scope's page asked for its leases (deviation 19): the Leases tab opens
     narrowed to that scope. Read once by the Leases tab it mounts. */
  const [seed, setSeed] = useState<{ scope: string; type: string } | null>(null)
  const requested = (sub ?? 'Leases') as SubTab
  const active: SubTab = SUB_TABS.includes(requested) ? requested : 'Leases'
  /* The seed is for the visit it was asked for: back on Scopes it is spent. */
  if (active === 'Scopes' && seed != null) setSeed(null)

  return (
    <>
      {/* Upstream mounts one here (`optDhcpClusterNode` / `optLogsClusterNode`).
          It draws nothing without a cluster, so it costs a single-server install
          nothing. */}
      <ClusterNodeSelect
        nodes={nodes}
        initialised={clusterInitialised}
        value={node}
        onChange={setNode}
        disabled={nodeLocked}
        label="Cluster Node"
      />
      {active === 'Scopes' ? (
        <Scopes
          token={token}
          node={node}
          canModify={canModify}
          canDelete={canDelete}
          onLockNode={setNodeLocked}
          onOpenLeases={(scope) => {
            setSeed({ scope, type: '' })
            onSubChange?.('Leases')
          }}
        />
      ) : (
        <Leases
          token={token}
          node={node}
          canModify={canModify}
          canDelete={canDelete}
          seed={seed}
        />
      )}
    </>
  )
}
