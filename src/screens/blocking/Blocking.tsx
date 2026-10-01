import { useEffect } from 'react'
import { SubTabs } from '../../ui/SubTabs'
import { ruleSearch } from './rules-model'
import { Overview } from './Overview'
import { Rules } from './Rules'
import { BlockLists } from './BlockLists'
import type { Permissions } from './permissions'

/*
The Blocking section, OURS: it replaces Allowed and Blocked with three tabs, as
AdGuard Home and Pi-hole organise blocking. It is the second deliberate exception to
"design only, zero functionality", inside the four limits written in CONVENTIONS.md.
*/

export const BLOCKING_TABS = ['Overview', 'Rules', 'Lists'] as const
type Tab = (typeof BLOCKING_TABS)[number]

export function Blocking({
  token,
  sub,
  onSubChange,
  permissions,
  nodes = [],
  clusterInitialised = false,
  serverDomain,
}: {
  token: string | null
  sub: string | null
  onSubChange: (t: string) => void
  permissions: Permissions
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean
  serverDomain?: string
}) {
  const active: Tab = (BLOCKING_TABS as readonly string[]).includes(sub ?? '') ? (sub as Tab) : 'Overview'

  /* `?rule=` belongs to Rules. `writeRoute` keeps the search, so without this it
     would follow the user into Overview and Lists. */
  useEffect(() => {
    if (active === 'Rules') return
    const search = ruleSearch(window.location.search, 'all')
    if (search !== window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + search)
    }
  }, [active])

  const tabs = (
    <SubTabs label="Blocking sections" section="blocking" tabs={BLOCKING_TABS} active={active} onChoose={onSubChange} />
  )

  if (active === 'Rules') {
    return <Rules tabs={tabs} token={token} permissions={permissions} nodes={nodes} clusterInitialised={clusterInitialised} />
  }
  if (active === 'Lists') {
    return <BlockLists tabs={tabs} token={token} permissions={permissions} clusterInitialised={clusterInitialised} />
  }
  return (
    <Overview
      tabs={tabs}
      token={token}
      permissions={permissions}
      nodes={nodes}
      clusterInitialised={clusterInitialised}
      serverDomain={serverDomain}
    />
  )
}
