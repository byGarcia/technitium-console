import { useState } from 'react'
import { SubTabs } from '../../ui/SubTabs'
import { ClusterNodeSelect } from '../../ui/ClusterNodeSelect'
import { QueryLogs } from './QueryLogs'
import { ViewLogs } from './ViewLogs'

/*
Logs. Two sub-tabs, with upstream's literal labels (index.html:3243-3244): "View
Logs" and "Query Logs".

As in DHCP, the sub-navigation lives in the Shell's side panel and arrives
through the `sub` prop. The two sub-tabs are independent screens: in upstream
they are `refreshLogFilesList` and `refreshQueryLogsTab`, with no shared state.

The section's permissions are NOT a single one. The whole tab shows with
`Logs.canView`, but inside there are three delete actions and one of them belongs
to another section: "delete all stats" deletes the Dashboard's statistics and
asks for `Dashboard.canDelete` (`WebServiceLogsApi.cs:135`).
*/

export const SUB_TABS = ['View Logs', 'Query Logs'] as const
export type SubTab = (typeof SUB_TABS)[number]

export interface LogsProps {
  /** The cluster nodes, for the node selector. Spec F10. */
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean

  token: string | null
  /** The active sub-tab, the one the Shell's side panel marks. */
  sub?: string | null
  /** It exists for symmetry with Settings; this screen never forces a change. */
  onSubChange?: (sub: SubTab) => void
  /** `Logs.canDelete`: deleting a log file and deleting them all. */
  canDeleteLogs?: boolean
  /** `Dashboard.canDelete`: deleting all the statistics. */
  canDeleteStats?: boolean
  /** The cluster node. Empty means "this server". */
  node?: string
}

export function Logs({
  onSubChange,
  nodes = [],
  clusterInitialised = false,
  token,
  sub,
  canDeleteLogs = true,
  canDeleteStats = true,
}: LogsProps) {
  /* Which node this screen reads. Upstream mounts a selector here
     and the parameter was already travelling empty; spec F10. */
  const [node, setNode] = useState<string>(() => '')
  const requested = (sub ?? 'View Logs') as SubTab
  const active: SubTab = SUB_TABS.includes(requested) ? requested : 'View Logs'

  /*
  The bar is built once here and handed to whichever sub-screen is drawn: the same
  object on both, so they cannot drift apart.
  */
  const tabs = (
    <SubTabs
      label="Logs sections"
      section="logs"
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
      {active === 'Query Logs' ? (
        <QueryLogs tabs={tabs} token={token} node={node} />
      ) : (
        <ViewLogs tabs={tabs}
          token={token}
          node={node}
          canDeleteLogs={canDeleteLogs}
          canDeleteStats={canDeleteStats}
        />
      )}
    </>
  )
}
