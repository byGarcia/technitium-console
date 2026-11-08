import { useState, type KeyboardEvent } from 'react'
import { Button } from '../../../ui/Button'
import { CodeArea } from '../../../ui/CodeArea'
import { Input, Select } from '../../../ui/Field'
import { Icon } from '../../../ui/Icon'
import { Panel, Body } from '../../../ui/Panel'
import { Radios } from '../../../ui/PanelForm'
import { Tag } from '../../../ui/Tag'
import { UrlText } from '../../../ui/UrlText'
import type { ListKind, ListRow } from './config-model'
import type { Problem } from './validate'
import { FieldMessages, counted, fieldAttrs, fieldStyles, problemsAt } from './EditorField'
import styles from './ListsTable.module.css'

/*
The `Lists` panel of a group: the add row and one row per list URL. All of it takes
props; the group's lists are the model's, in file order inside each kind.

Every word here is OURS (upstream has only a JSON box for this app): the panel title
`Lists`; the five kinds `Block: domain list`, `Block: regex list`, `Block and allow:
AdBlock list`, `Allow: domain list`, `Allow: regex list`; `Kind of list`, `List URL`
and its placeholder, `Add`; `This group has no lists. Its domains and patterns above
still apply.`; the row's `Block`, `Allow`, `Domains`, `Regex`, `AdBlock`, `Own answer`,
`Empty URL`; `Remove <url>`, `Details for <url>`, `URL of <url>`, `Answer for <url>`,
`Addresses for <url>`, where a second row with the same URL adds ` (2)` and a row with
none says `empty URL`, so a row's name is always its own; `Use the group's answer`,
`NXDOMAIN`, `These addresses`; `An allow list only has its URL.`; the count under the
addresses.

A row with a problem it may draw opens by itself, or the message would be in a closed
row while the save bar counts it. It does not close again while it is being fixed:
the first keystroke pins it, so the field keeps its focus when the problem goes away.
*/

const KINDS: { key: ListKind; label: string; tone: 'block' | 'allow'; word: string }[] = [
  { key: 'blockListUrls', label: 'Block: domain list', tone: 'block', word: 'Domains' },
  { key: 'regexBlockListUrls', label: 'Block: regex list', tone: 'block', word: 'Regex' },
  { key: 'adblockListUrls', label: 'Block and allow: AdBlock list', tone: 'block', word: 'AdBlock' },
  { key: 'allowListUrls', label: 'Allow: domain list', tone: 'allow', word: 'Domains' },
  { key: 'regexAllowListUrls', label: 'Allow: regex list', tone: 'allow', word: 'Regex' },
]

const ANSWERS = [
  { value: 'group', label: "Use the group's answer" },
  { value: 'nx', label: 'NXDOMAIN' },
  { value: 'addresses', label: 'These addresses' },
]

/** The name each row goes by, in the order drawn. Two rows never share one. */
function rowNames(rows: ListRow[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const base = r.url.trim() === '' ? 'empty URL' : r.url
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

type RowPatch = Partial<Pick<ListRow, 'url' | 'answer' | 'addresses'>>

export function ListsTable({
  lists,
  problems,
  showProblems,
  onAddList,
  onChangeList,
  onRemoveList,
}: {
  lists: ListRow[]
  problems: Problem[]
  showProblems: boolean
  onAddList: (kind: ListKind, url: string) => void
  onChangeList: (listId: string, patch: RowPatch) => void
  onRemoveList: (listId: string) => void
}) {
  const [kind, setKind] = useState<ListKind>('blockListUrls')
  const [url, setUrl] = useState('')

  const rows = KINDS.flatMap((k) => lists.filter((l) => l.kind === k.key))
  const names = rowNames(rows)

  function add() {
    const typed = url.trim()
    if (typed === '') return
    onAddList(kind, typed)
    setUrl('')
  }

  function onUrlKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Enter must not submit whatever form the page wraps this in.
    e.preventDefault()
    add()
  }

  return (
    <Panel title="Lists">
      <Body>
        <div className={styles.add}>
          <Select aria-label="Kind of list" value={kind} onChange={(e) => setKind(e.target.value as ListKind)}>
            {KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
          <Input
            mono
            aria-label="List URL"
            placeholder="https://.../hosts"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onUrlKey}
          />
          <Button lead="add" disabled={url.trim() === ''} onClick={add}>
            Add
          </Button>
        </div>
      </Body>
      {rows.length === 0 ? (
        <div className={styles.empty}>This group has no lists. Its domains and patterns above still apply.</div>
      ) : (
        <div className={styles.rows}>
          {rows.map((row, i) => (
            <Row
              key={row.id}
              row={row}
              name={names[i]}
              problems={problems}
              showProblems={showProblems}
              onChange={(patch) => onChangeList(row.id, patch)}
              onRemove={() => onRemoveList(row.id)}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

function Row({
  row,
  name,
  problems,
  showProblems,
  onChange,
  onRemove,
}: {
  row: ListRow
  name: string
  problems: Problem[]
  showProblems: boolean
  onChange: (patch: RowPatch) => void
  onRemove: () => void
}) {
  const [asked, setAsked] = useState(false)
  const kind = KINDS.find((k) => k.key === row.kind)
  const isBlock = kind?.tone === 'block'

  const urlShown = problemsAt(problems, row.id, 'url', showProblems)
  const addressesShown = problemsAt(problems, row.id, 'addresses', showProblems)
  const open = asked || urlShown.length > 0 || addressesShown.length > 0

  /* Normally only for `These addresses`, and for anything a message has to be drawn
     under: a problem on a field that is not there is a problem nobody can see. */
  const showAddresses = (isBlock && row.answer === 'addresses') || addressesShown.length > 0

  function edit(patch: RowPatch) {
    setAsked(true)
    onChange(patch)
  }

  return (
    <div className={styles.row}>
      <div className={styles.head}>
        <span className={`${styles.kind} ${isBlock ? fieldStyles.block : fieldStyles.allow}`}>
          <Icon name={isBlock ? 'blocked' : 'allowed'} size={14} />
          {isBlock ? 'Block' : 'Allow'}
        </span>
        <span className={styles.word}>{kind?.word}</span>
        <span className={styles.url} title={row.url}>
          {row.url.trim() === '' ? 'Empty URL' : <UrlText url={row.url} />}
        </span>
        {row.answer !== 'group' && <Tag>Own answer</Tag>}
        <span className={styles.actions}>
          <Button size="sm" icon aria-label={`Remove ${name}`} onClick={onRemove}>
            <Icon name="trash" size={14} />
          </Button>
          <Button size="sm" icon aria-label={`Details for ${name}`} aria-expanded={open} onClick={() => setAsked(!open)}>
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
          </Button>
        </span>
      </div>
      {open && (
        <div className={styles.details}>
          <div>
            <Input
              mono
              aria-label={`URL of ${name}`}
              className={fieldStyles.input}
              value={row.url}
              onChange={(e) => edit({ url: e.target.value })}
              {...fieldAttrs(row.id, 'url', urlShown)}
            />
            <FieldMessages target={row.id} field="url" shown={urlShown} />
          </div>
          {isBlock ? (
            <div className={styles.radios} role="radiogroup" aria-label={`Answer for ${name}`}>
              <Radios
                name={`ab-${row.id}-answer`}
                value={row.answer}
                options={ANSWERS}
                onChange={(v) => edit({ answer: v as ListRow['answer'] })}
              />
            </div>
          ) : (
            <p className={styles.help}>An allow list only has its URL.</p>
          )}
          {showAddresses && (
            <div>
              <CodeArea
                aria-label={`Addresses for ${name}`}
                className={fieldStyles.shortArea}
                value={row.addresses}
                onChange={(e) => edit({ addresses: e.target.value })}
                status={counted(row.addresses, 'address', 'addresses')}
                {...fieldAttrs(row.id, 'addresses', addressesShown)}
              />
              <FieldMessages target={row.id} field="addresses" shown={addressesShown} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
