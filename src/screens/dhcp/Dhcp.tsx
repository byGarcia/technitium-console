import { useState } from 'react'
import { SubTabs } from '../../ui/SubTabs'
import { ClusterNodeSelect } from '../../ui/ClusterNodeSelect'
import { Leases } from './Leases'
import { Scopes } from './Scopes'

/*
DHCP. Two sub-tabs, with upstream's literal labels (index.html:2496-2497):
"Leases" and "Scopes".

The sub-navigation is NOT mounted here: it lives in the Shell's side panel, just
like Settings', and arrives through the `sub` prop. Unlike Settings, the two
sub-tabs are independent screens —each with its own loading and its own state— so
they can be split up: in upstream they are two different functions,
`refreshDhcpLeases` and `refreshDhcpScopes`, and they share no form.

Upstream's cluster node selector (`optDhcpClusterNode`) is not mounted: this
console has no cluster mode yet. The `node` parameter travels all the same,
empty, on all ten calls, which is what upstream sends with a single server.
*/

export const SUB_TABS = ['Leases', 'Scopes'] as const
export type SubTab = (typeof SUB_TABS)[number]

export interface DhcpProps {
  /** The cluster nodes, for the node selector. Spec F10. */
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
     and the parameter was already travelling empty; spec F10. */
  const [node, setNode] = useState<string>(() => '')
  const requested = (sub ?? 'Leases') as SubTab
  const active: SubTab = SUB_TABS.includes(requested) ? requested : 'Leases'

  /*
  The bar is built once here and handed to whichever sub-screen is drawn: the same
  object on both, so they cannot drift apart.
  */
  const tabs = (
    <SubTabs
      label="DHCP sections"
      section="dhcp"
      tabs={SUB_TABS}
      active={active}
      onChoose={(t) => onSubChange?.(t as SubTab)}
    />
  )

  return (
    <>
      {/* Upstream mounts one here (`optDhcpClusterNode` / `optLogsClusterNode`).
          It draws nothing without a cluster, so it costs a single-server install
          nothing. Spec F10. */}
      <ClusterNodeSelect
        nodes={nodes}
        initialised={clusterInitialised}
        value={node}
        onChange={setNode}
        label="Cluster Node"
      />
      {active === 'Scopes' ? (
        <Scopes tabs={tabs} token={token} node={node} canModify={canModify} canDelete={canDelete} />
      ) : (
        <Leases tabs={tabs} token={token} node={node} canModify={canModify} canDelete={canDelete} />
      )}
    </>
  )
}
