import { Button } from '../../../ui/Button'
import { EditableTable } from '../../../ui/EditableTable'
import { Input, Select } from '../../../ui/Field'
import { Icon } from '../../../ui/Icon'
import { Panel, Body } from '../../../ui/Panel'
import { Tag } from '../../../ui/Tag'
import type { ClientRow, GroupModel, MapName } from './config-model'
import { FieldMessages, fieldAttrs, problemsAt } from './EditorField'
import { groupSummary } from './summary'
import type { Problem } from './validate'
import styles from './ClientsTable.module.css'

/*
Who gets which group: both of the app's maps in one table, in the order of `rows`.

Every word here is ours, because upstream only has the JSON box: `Clients`,
`Add client`, `Add server endpoint`, the help sentence, `Client or endpoint`,
`Group`, `What it gets`, `Endpoint`, `Choose a group`, `<name> (missing)`,
`Unnamed`, `New row <n>`, `Remove <row>`, `What <row> gets`. The help sentence
states the app's order of decision: endpoints first, then the most specific network
(`App.cs:283-338`), and no row means no blocking (`App.cs:570`).

A row is told apart by its `id`, never by its address and never by its group's
name: while someone types, two rows can hold the same address and two groups the
same name, and both rows and both groups have to stay what they were.
*/

/*
The name each row goes by for a screen reader. An address alone is not enough: two
rows can hold the same one (a repeat being typed, or an endpoint and a network with
the same text), and each row's controls need a name of their own.
*/
function rowNames(rows: ClientRow[]): Map<string, string> {
  const names = new Map<string, string>()
  const used = new Set<string>()
  let blanks = 0
  for (const row of rows) {
    const base = row.address.trim() || `New row ${++blanks}`
    let name = base
    for (let n = 2; used.has(name); n++) name = `${base} (${n})`
    used.add(name)
    names.set(row.id, name)
  }
  return names
}

export function ClientsTable({
  rows,
  groups,
  problems,
  showProblems,
  onAdd,
  onChange,
  onRemove,
  onOpenGroup,
}: {
  rows: ClientRow[]
  groups: GroupModel[]
  problems: Problem[]
  showProblems: boolean
  onAdd: (map: MapName) => void
  onChange: (id: string, patch: { address?: string; groupId?: string | null }) => void
  onRemove: (id: string) => void
  onOpenGroup: (groupId: string) => void
}) {
  const names = rowNames(rows)

  return (
    <Panel
      title="Clients"
      actions={
        <span className={styles.actions}>
          <Button size="sm" lead="add" onClick={() => onAdd('networkGroupMap')}>Add client</Button>
          <Button size="sm" lead="add" onClick={() => onAdd('localEndPointGroupMap')}>Add server endpoint</Button>
        </span>
      }
    >
      <Body>
        <p className={styles.help}>Server endpoints are checked first, then the most specific client network. A client that matches no row is not blocked.</p>
        {rows.length > 0 && (
          <EditableTable className={styles.table} header={<><th>Client or endpoint</th><th>Group</th><th>What it gets</th><th /></>}>
            {rows.map((row) => {
              const name = names.get(row.id) as string
              const group = groups.find((g) => g.id === row.groupId)
              const addressShown = problemsAt(problems, row.id, 'address', showProblems)
              const groupShown = problemsAt(problems, row.id, 'group', showProblems)
              return (
                <tr key={row.id}>
                  <td>
                    <div className={styles.who}>
                      <div className={styles.field}>
                        <Input
                          {...fieldAttrs(row.id, 'address', addressShown)}
                          mono
                          spellCheck={false}
                          autoComplete="off"
                          aria-label={`${name} address`}
                          value={row.address}
                          onChange={(e) => onChange(row.id, { address: e.target.value })}
                        />
                        <FieldMessages target={row.id} field="address" shown={addressShown} />
                      </div>
                      {row.map === 'localEndPointGroupMap' && <span className={styles.endpoint}><Tag>Endpoint</Tag></span>}
                    </div>
                  </td>
                  <td>
                    <Select
                      {...fieldAttrs(row.id, 'group', groupShown)}
                      aria-label={`${name} group`}
                      value={group?.id ?? ''}
                      placeholder={row.missingGroup != null ? `${row.missingGroup} (missing)` : 'Choose a group'}
                      onChange={(e) => onChange(row.id, { groupId: e.target.value })}
                    >
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name || 'Unnamed'}</option>)}
                    </Select>
                    <FieldMessages target={row.id} field="group" shown={groupShown} />
                  </td>
                  <td className={styles.what}>
                    {group != null && (
                      <button type="button" className={styles.gets} aria-label={`What ${name} gets: ${groupSummary(group)}`} onClick={() => onOpenGroup(group.id)}>
                        {groupSummary(group)}
                      </button>
                    )}
                  </td>
                  <td>
                    <Button size="sm" icon aria-label={`Remove ${name}`} onClick={() => onRemove(row.id)}><Icon name="trash" size={14} /></Button>
                  </td>
                </tr>
              )
            })}
          </EditableTable>
        )}
      </Body>
    </Panel>
  )
}
