import { useCallback, useEffect, useState } from 'react'
import { getClusterState, type ClusterState } from '../../api/admin-cluster'
import { Sessions } from './Sessions'
import { Users } from './Users'
import { Groups } from './Groups'
import { Permissions } from './Permissions'
import { Sso } from './Sso'
import { Cluster } from './Cluster'
import { Notifier, type Notice } from './parts'
import { SubTabs } from '../../ui/SubTabs'

/*
Administration. Six sub-tabs and thirty endpoints: the console's second largest
block after Zones.

The sub-navigation is NOT mounted here. Just as in Settings, the sub-tabs live in
the Shell's side panel and arrive through the `sub` prop. This component only
decides which panel it draws and holds the two things all six share: the page
alert and the cluster's state.

About the permissions, and it goes against intuition: **upstream hides and
disables NOTHING inside Administration**. The only check it makes is
`permissions.Administration.canView` to show or hide the whole section
(main.js:165 and 240), and from there it shows every button and lets the server
reject whatever it should. That is why this component receives no permission
props: adding them would be adding behaviour. The permissions each action
consumes are noted in `src/api/admin.ts` and `src/api/admin-cluster.ts`.

About the cluster: upstream reads `clusterInitialized` and `clusterNodes` from
`sessionData.info`, which arrives on login. The session the Shell hands out does
not expose them, so here they are asked for once with `admin/cluster/state` —the
same datum, and allowed with the same `canView` needed to see the section— and
shared with the six sub-tabs. The Cluster sub-tab refreshes it every time it
changes, just as `reloadAdminClusterView` does.
*/

export const SUB_TABS = ['Sessions', 'Users', 'Groups', 'Permissions', 'SSO', 'Cluster'] as const

export type SubTab = (typeof SUB_TABS)[number]

export interface AdminProps {
  token: string | null
  /** The active sub-tab, the one the Shell's side panel marks. */
  sub?: string | null
  /** The sub-navigation now lives under the title, so this IS invoked: it is what
   *  the bar calls when a tab is chosen. */
  onSubChange?: (sub: SubTab) => void
}

export function Admin({ token, sub, onSubChange }: AdminProps) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const [cluster, setCluster] = useState<ClusterState | null>(null)
  /*
  Upstream mounts two selectors in this section, `optAdminSessionsClusterNode`
  and `optAdminClusterNode`. One state serves both: it is the same question asked
  from two sub-tabs. No aggregate, no persistence. Spec F10.

  The nodes come from this screen's own `getClusterState` rather than from the
  session, because it already loads them. The control itself stays in the header
  of Sessions or Cluster: mounting it here as well would put a dead duplicate on
  all six sub-tabs.
  */
  const [node, setNode] = useState<string>('')

  useEffect(() => {
    let live = true
    void getClusterState(token).then((outcome) => {
      if (!live || outcome.kind !== 'ok') return
      const state = outcome.data.response
      setCluster(state)
      /*
      The selector starts on THIS server, and that is a parity fix, not taste.

      `updateClusterNodeDropDown` (cluster.js:1026) selects `dnsServerDomain` when
      nothing has been chosen, and falls back to the first node if that name is not
      in the list. Ours left the value empty, so the control came up showing the
      "—" placeholder: a dropdown that names no node while the table under it lists
      two. Measured on the harness with the two-node cluster up, `Sessions` and
      `Cluster` both showed it.

      The value that travels also becomes upstream's: it sent the node's name where
      we sent the empty string. The server treats both as this node, so nothing
      changes about which server answers — what changes is that the request now
      says which one it means.
      */
      setNode((current) => {
        if (current !== '') return current
        const nodes = state.clusterNodes ?? []
        return nodes.find((n) => n.state === 'Self')?.name ?? nodes[0]?.name ?? ''
      })
    })
    return () => {
      live = false
    }
  }, [token])

  // Stable across renders: the sub-tabs put it in the dependencies of their
  // loading `useCallback`, and a new function per render would reload them in
  // bucle.
  const notify = useCallback((a: Notice) => setNotice(a), [])
  const toCluster = useCallback((s: ClusterState) => setCluster(s), [])

  const requested = (sub ?? 'Sessions') as SubTab
  const active: SubTab = SUB_TABS.includes(requested) ? requested : 'Sessions'

  /*
  The bar is built ONCE here and handed to whichever sub-screen is drawn: it is
  the same object on the six, and building it in each of them is how six copies
  end up drifting apart.
  */
  const tabs = (
    <SubTabs
      label="Administration sections"
      section="admin"
      tabs={SUB_TABS}
      active={active}
      onChoose={(t) => onSubChange?.(t as SubTab)}
    />
  )

  return (
    <div>
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {active === 'Sessions' && (
        <Sessions tabs={tabs}
          token={token}
          cluster={cluster}
          node={node}
          onNodeChange={setNode}
          onNotice={notify}
        />
      )}
      {active === 'Users' && <Users tabs={tabs} token={token} cluster={cluster} onNotice={notify} />}
      {active === 'Groups' && <Groups tabs={tabs} token={token} onNotice={notify} />}
      {active === 'Permissions' && (
        <Permissions tabs={tabs} token={token} cluster={cluster} onNotice={notify} />
      )}
      {active === 'SSO' && <Sso tabs={tabs} token={token} onNotice={notify} />}
      {active === 'Cluster' && (
        <Cluster tabs={tabs}
          token={token}
          cluster={cluster}
          node={node}
          onNodeChange={setNode}
          onCluster={toCluster}
          onNotice={notify}
        />
      )}
    </div>
  )
}
