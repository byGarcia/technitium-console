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
The section and tab names (`Blocking`, `Overview`, `Rules`, `Lists`) are OURS.
*/

export const BLOCKING_TABS = ['Overview', 'Rules', 'Lists'] as const
type Tab = (typeof BLOCKING_TABS)[number]

/** Takes `?rule=` out of the bar, replacing the entry: it is not a navigation. */
function dropRule(): void {
  const search = ruleSearch(window.location.search, 'all')
  if (search !== window.location.search) {
    window.history.replaceState(null, '', window.location.pathname + search)
  }
}

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
    if (active !== 'Rules') dropRule()
  }, [active])

  /*
  And out of the section. Leaving Blocking from the sidebar, the Shell writes the
  new route with whatever search the bar holds — `/zones/?rule=blocked`, and back
  to Rules with the filter still on. This cleanup runs first: React runs the
  cleanups of an unmounted tree before the effects of the tree that stays, and
  the Shell's `writeRoute` is one of those.

  Unmount only, not on every tab change: keyed on the tab it would also run when
  the back button returns to `/blocking/rules/?rule=…`, and strip the filter Rules
  is showing. StrictMode's rehearsal unmount does drop it, and Rules writes it
  back from what it read on its first render (its own effect, which runs again on
  the second mount).
  */
  useEffect(() => dropRule, [])

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
