import { Panel, Body } from '../../ui/Panel'
import { Empty } from '../../ui/Empty'
import { Icon } from '../../ui/Icon'
import { requiresText, type Need } from './permissions'

/*
A panel whose READ permission is missing. It keeps its place and its title, so the
screen does not change shape depending on who looks, and says which permission is
missing — the padlock rule of DESIGN.md, said once for the panel.

The sentence goes as `children`, not as `title`: `Empty compact` draws its children
only and drops the title.
*/
export function Locked({ title, need }: { title: string; need: Need }) {
  return (
    <Panel title={title}>
      <Body>
        <Empty compact>
          <Icon name="lock" size={14} /> {requiresText(need)}
        </Empty>
      </Body>
    </Panel>
  )
}
