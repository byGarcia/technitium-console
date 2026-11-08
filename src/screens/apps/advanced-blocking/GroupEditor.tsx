import { useState } from 'react'
import { Button } from '../../../ui/Button'
import { Check } from '../../../ui/Check'
import { CodeArea } from '../../../ui/CodeArea'
import { Input } from '../../../ui/Field'
import { GroupRow, Row } from '../../../ui/Form'
import { Icon } from '../../../ui/Icon'
import { Panel, Body } from '../../../ui/Panel'
import { Radios } from '../../../ui/PanelForm'
import type { GroupModel, ListKind, ListRow, TextList } from './config-model'
import type { Problem } from './validate'
import { FieldMessages, counted, fieldAttrs, fieldStyles, problemsAt } from './EditorField'
import { ListsTable } from './ListsTable'
import styles from './GroupEditor.module.css'

/*
One group of the Advanced Blocking config, drawn from props: its panels in the order
the page reads them, then the line about the properties the editor keeps untouched.
`Delete group` only reports the click: the confirmation is the page's.

Every word here is OURS (upstream has only a JSON box for this app):
- `Unnamed`, for the title of a group with no name; `Delete group`;
- the rows `Group Name`, `Enable Blocking` under `Blocking`, `Clients` with `No client
  uses this group yet.`, `Answer With` with `NXDOMAIN` and `These addresses`,
  `Blocking Addresses`, `Allow TXT Blocking Report` under `Blocking Report`, and the
  help of each;
- the panels `Blocked answer`, `Domains and patterns` with its sentence, the four
  fields `Allowed domains`, `Blocked domains`, `Allowed regex`, `Blocked regex`, their
  counts, and `Add regex patterns`;
- `Also in this group, not shown here and kept as it is: <names>.`

The multi-line fields show the model's text as it is and hand back what was typed:
what a line means is the model's business, and a trim here would change the document
for a user who only looked.
*/

const AREAS: { key: TextList; label: string; one: string; many: string; allow: boolean; regex: boolean }[] = [
  { key: 'allowed', label: 'Allowed domains', one: 'domain', many: 'domains', allow: true, regex: false },
  { key: 'blocked', label: 'Blocked domains', one: 'domain', many: 'domains', allow: false, regex: false },
  { key: 'allowedRegex', label: 'Allowed regex', one: 'pattern', many: 'patterns', allow: true, regex: true },
  { key: 'blockedRegex', label: 'Blocked regex', one: 'pattern', many: 'patterns', allow: false, regex: true },
]

const ANSWERS = [
  { value: 'nx', label: 'NXDOMAIN' },
  { value: 'addresses', label: 'These addresses' },
]

export function GroupEditor({
  group,
  clients,
  problems,
  showProblems,
  onChange,
  onDelete,
  onShowClients,
  onAddList,
  onChangeList,
  onRemoveList,
}: {
  group: GroupModel
  clients: string[]
  problems: Problem[]
  showProblems: boolean
  onChange: (patch: Partial<Omit<GroupModel, 'id' | 'loadedIndex' | 'lists' | 'unknownKeys'>>) => void
  onDelete: () => void
  onShowClients: () => void
  onAddList: (kind: ListKind, url: string) => void
  onChangeList: (listId: string, patch: Partial<Pick<ListRow, 'url' | 'answer' | 'addresses'>>) => void
  onRemoveList: (listId: string) => void
}) {
  const [regexAsked, setRegexAsked] = useState(false)
  const shownAt = (field: string) => problemsAt(problems, group.id, field, showProblems)

  const nameShown = shownAt('name')
  const addressesShown = shownAt('addresses')

  /* Hidden only while there is nothing to see in them, a message included. Once
     opened or edited they stay, so emptying one does not take the field away. */
  const regexShown =
    regexAsked ||
    group.text.allowedRegex !== '' ||
    group.text.blockedRegex !== '' ||
    shownAt('allowedRegex').length > 0 ||
    shownAt('blockedRegex').length > 0

  return (
    <div className={styles.stack}>
      <Panel
        title={group.name === '' ? 'Unnamed' : group.name}
        groups2
        actions={
          <Button size="sm" variant="danger" lead="trash" onClick={onDelete}>
            Delete group
          </Button>
        }
      >
        <Row
          label="Group Name"
          id={`ab-${group.id}-name`}
          help="Names are case sensitive and have to be unique. Renaming also updates Clients."
        >
          {() => (
            <>
              <Input
                className={fieldStyles.input}
                value={group.name}
                onChange={(e) => onChange({ name: e.target.value })}
                {...fieldAttrs(group.id, 'name', nameShown)}
              />
              <FieldMessages target={group.id} field="name" shown={nameShown} />
            </>
          )}
        </Row>
        <GroupRow label="Blocking" help="Off lets every query from this group's clients through.">
          <Check toggle label="Enable Blocking" checked={group.enabled} onChange={(v) => onChange({ enabled: v })} />
        </GroupRow>
        <GroupRow label="Clients" help="Who gets this group. Change it in Clients.">
          <div className={styles.chips}>
            {clients.map((client, i) => (
              <Button key={i} size="sm" className={styles.chip} onClick={onShowClients}>
                {client}
              </Button>
            ))}
            {clients.length === 0 && <span className={styles.none}>No client uses this group yet.</span>}
          </div>
        </GroupRow>
      </Panel>

      <Panel title="Blocked answer" groups2>
        <GroupRow label="Answer With" role="radiogroup" help="What a client receives for a blocked domain. A list can override it.">
          <Radios
            name={`ab-${group.id}-answer`}
            value={group.nxDomain ? 'nx' : 'addresses'}
            options={ANSWERS}
            onChange={(v) => onChange({ nxDomain: v === 'nx' })}
          />
        </GroupRow>
        <Row
          label="Blocking Addresses"
          id={`ab-${group.id}-addresses`}
          help="One IPv4 or IPv6 address per line, for A and AAAA queries."
          dependsOn={group.nxDomain ? 'These addresses' : undefined}
        >
          {() => (
            <>
              <CodeArea
                className={fieldStyles.shortArea}
                disabled={group.nxDomain}
                value={group.addresses}
                onChange={(e) => onChange({ addresses: e.target.value })}
                status={counted(group.addresses, 'address', 'addresses')}
                {...fieldAttrs(group.id, 'addresses', addressesShown)}
              />
              <FieldMessages target={group.id} field="addresses" shown={addressesShown} />
            </>
          )}
        </Row>
        <GroupRow label="Blocking Report" help="Says why a domain was blocked, in TXT answers and in Extended DNS Errors.">
          <Check toggle label="Allow TXT Blocking Report" checked={group.txtReport} onChange={(v) => onChange({ txtReport: v })} />
        </GroupRow>
      </Panel>

      <Panel title="Domains and patterns">
        <Body>
          <p className={styles.help}>One per line. A domain also covers its subdomains. Allowed always beats blocked.</p>
          <div className={styles.matrix}>
            {AREAS.filter((a) => !a.regex || regexShown).map((a) => {
              const shown = shownAt(a.key)
              const attrs = fieldAttrs(group.id, a.key, shown)
              return (
                <div key={a.key} className={styles.cell}>
                  <label className={styles.cellHead} htmlFor={attrs.id}>
                    <span className={a.allow ? fieldStyles.allow : fieldStyles.block}>
                      <Icon name={a.allow ? 'allowed' : 'blocked'} size={14} />
                    </span>
                    {a.label}
                  </label>
                  <CodeArea
                    className={fieldStyles.mediumArea}
                    value={group.text[a.key]}
                    onChange={(e) => {
                      if (a.regex) setRegexAsked(true)
                      onChange({ text: { ...group.text, [a.key]: e.target.value } })
                    }}
                    status={counted(group.text[a.key], a.one, a.many)}
                    {...attrs}
                  />
                  <FieldMessages target={group.id} field={a.key} shown={shown} />
                </div>
              )
            })}
          </div>
          {!regexShown && (
            <div className={styles.addRegex}>
              <Button size="sm" lead="add" onClick={() => setRegexAsked(true)}>
                Add regex patterns
              </Button>
            </div>
          )}
        </Body>
      </Panel>

      <ListsTable
        lists={group.lists}
        problems={problems}
        showProblems={showProblems}
        onAddList={onAddList}
        onChangeList={onChangeList}
        onRemoveList={onRemoveList}
      />

      {group.unknownKeys.length > 0 && (
        <p className={styles.kept}>Also in this group, not shown here and kept as it is: {group.unknownKeys.join(', ')}.</p>
      )}
    </div>
  )
}
