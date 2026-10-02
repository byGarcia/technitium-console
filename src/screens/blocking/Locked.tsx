import type { ReactNode } from 'react'
import { Panel, Body } from '../../ui/Panel'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/Tooltip'
import type { Placement } from '../../ui/tooltip-place'
import { requiresText, type Need } from './permissions'
import shared from './Blocking.module.css'

/*
The padlock of the Blocking section, written once. The console's design rule: what
the session may not see or do keeps its place and says which permission is missing.
*/

/*
The body of a slot whose READ permission is missing: the padlock and the sentence.

The sentence goes as `children`, not as `title`: `Empty compact` draws its children
only and drops the title.
*/
export function LockedBody({ need }: { need: Need }) {
  return (
    <Empty compact>
      <Icon name="lock" size={14} /> {requiresText(need)}
    </Empty>
  )
}

/*
A panel whose READ permission is missing. It keeps its place and its title, so the
screen does not change shape depending on who looks.
*/
export function Locked({ title, need }: { title: string; need: Need }) {
  return (
    <Panel title={title}>
      <Body>
        <LockedBody need={need} />
      </Body>
    </Panel>
  )
}

/*
A menu entry whose permission is missing: it stays, disabled, and explains itself
the way `PermissionButton` does (padlock plus the `Tooltip` with `Requires X: Y`),
not with a native `title`: that is the one pattern the console has for "you
cannot", and a menu item is no exception. A verb that vanishes is a verb nobody
knows exists. Used by the top tables' row menus and by Rules' foot menus.
*/
export function LockedItem({
  need,
  placement,
  children,
}: {
  need: Need
  placement?: Placement
  children: ReactNode
}) {
  return (
    <Tooltip text={requiresText(need)} placement={placement}>
      <button type="button" className={shared.lockedItem} disabled>
        <Icon name="lock" size={13} />
        {children}
      </button>
    </Tooltip>
  )
}
