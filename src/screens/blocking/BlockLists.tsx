import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { readSettings, setSettings, forceUpdateBlockLists } from '../../api/settings'
import { getDashboardStats } from '../../api/dashboard'
import { loadQuickList, type QuickEntry } from '../../lib/quick-lists'
import { nextUpdateText } from '../settings/panes/Blocking'
import { SectionHeader } from '../../ui/SectionHeader'
import { Panel, Body } from '../../ui/Panel'
import { RowAction, Table } from '../../ui/Table'
import { Field, Input, Select } from '../../ui/Field'
import { Button } from '../../ui/Button'
import { PermissionButton } from '../../ui/PermissionButton'
import { Confirm } from '../../ui/Confirm'
import { Notifier } from '../../ui/Notifier'
import { Failure, Loading } from '../../ui/Empty'
import { RouteLink } from '../../ui/RouteLink'
import { Icon } from '../../ui/Icon'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import {
  addHeading, addListTo, applyQuickTo, canMove, canToggle, fromUrls, headingEdits, headingIndexes, headingName,
  headingProblem, listName, moveLine, removeHeading, renameHeading, saveBody, sameLines, toggleLine,
  type ListLine,
} from './list-lines'
import { Locked } from './Locked'
import { hostsOf, moreLists } from './extra-lists'
import { missing, type Permissions } from './permissions'
import shared from './Blocking.module.css'
import styles from './BlockLists.module.css'

/*
The Lists tab: the "Allow / Block List URLs" field of Settings > Blocking drawn as a
table. OURS as a table; every line is the server's own grammar (`list-lines.ts`).

Upstream's words here: `Quick Add` and its `None`, `Update Now`, the next-update
value (`nextUpdateText`, shared with Settings), the update confirmation sentence and
every alert of the update and the save. Everything else is OURS:
- the figures `Block List Domains` and `Allow List Domains`, and `Next update ·
  every N h` (upstream's label is "Block List Next Update On");
- the panel titles `Lists`, `Block Lists`, `Add a list`, and `Update Block Lists`
  with its `Update` button (upstream asks with a bare `confirm()`);
- the field label `List URL` (upstream's is "Allow / Block List URLs"), its
  placeholder, the `file://` help line, the invalid-URL hint and `This list is
  already in the table.`; `Add block list` / `Add allow list`;
- the table: the columns `Enabled`, `List` and `Type`, the types `Block` and `Allow`,
  `Remove`, `Move up` / `Move down`, `No lists`, and the row controls' aria-labels;
- the groups (2026-10-15): a comment line drawn as a group heading (`list-lines.ts`,
  GROUPS) with its `N list(s)`, `No group` for the lists before the first heading,
  `Unnamed group` for a bare `#`, `Rename`, `Ungroup`, `Add group`, `Group name`,
  `Cancel`, the field `Add to group`, and `headingProblem`'s sentences;
- the table's foot: `N list(s) · N disabled · N group(s)`;
- the unsaved-changes bar: `1 unsaved change` / `N unsaved changes` with its
  suffix `to the block list URLs`, `Discard`, and `Save`, shortened from upstream's
  "Save Settings" (index.html:2460);
- the two `Could not read …` sentences and the link to Settings › Blocking;
- Quick Add's search (`Search lists`, `No lists match`) and its second catalogue, the
  console's own (`extra-lists.ts`), under `More lists` after Technitium's.

Quick Add here lists Technitium's catalogue first, as Settings does, then ours. An
entry of ours is chosen exactly as one of theirs (`applyQuick`), and its single-URL
entries name their rows too. Its search matches the name and the URL's host.

No node selector: `blockListUrls` is a CLUSTER-WIDE parameter (`nodeScope`,
settings/model.ts:514), so it is read and saved on the cluster when there is one and
on this server when there is not, which is what Settings does with the aggregate.

Groups and moves are kept with everything else: a heading is a line like any other,
so adding, renaming or removing one, and moving a list, only changes `lines`.

Changes are KEPT until Save, as upstream's Save Settings keeps the textarea:
`Quick Add > None` empties every list, and saving on each click would make that one
click unrecoverable. One save also means one request, so quick changes cannot land
out of order.
*/

/* The value of an entry of ours in Quick Add: by position, so a name shared with an
   entry of Technitium's still picks the right one. */
const MORE = 'more:'

const KIND_LABEL = { block: 'Block', allow: 'Allow' } as const
const KIND_CLASS = { block: styles.block, allow: styles.allow } as const
/* An icon and a word, not only a colour, as the Rule column of Rules: the same two
   icons, so a block list and a blocked rule read as the same kind. */
const KIND_ICON = { block: 'blocked', allow: 'allowed' } as const

/*
The add field takes the bare URL; the buttons choose block or allow. Both sentences
are OURS. `addList` only refuses an identical line, so the table checks the rest
here: a `#` or `!` typed by hand would make the field say one thing and the button
another, and the same URL switched off or on the other list would be a second row
the server loads twice.
*/
const MSG_PREFIX = 'Enter the URL without # or !; use the buttons to choose block or allow.'
const MSG_DUPLICATE = 'This list is already in the table.'
/* OURS: `dashboard/stats/get` failed, which is not the same as zero domains. */
const COUNTS_FAILED = 'Could not read the counts.'

/*
After a Save or an Update Now the server reloads the lists in the background, and
the counts change when it has finished, not at once. Until then both figures say "Updating…" (OURS).

How the end is told, from the server (v15.5.1): `blockListNextUpdatedOn` is the last
SUCCESSFUL update plus the interval (WebServiceSettingsApi.cs:384), and the last update
only moves when a download ends well (BlockListZoneManager.cs:674-692). While it
reloads, then, the server keeps answering the OLD date (a future one, so "Updating
Now" is no signal). The value is captured when the action is taken (Save: from its
own answer; Update Now: read just before the call) and the settings are read every
POLL_MS until it differs; then the counts are read once more. POLL_LIMIT_MS bounds the
wait (a download that fails never moves the date), and at the limit the counts are read
anyway. A second Save or Update Now while waiting captures again and starts the limit
again.
*/
const UPDATING = 'Updating…'
const POLL_MS = 3000
const POLL_LIMIT_MS = 120_000

/** A reload being waited for: the date captured when it was asked for. Each one is a
    new object, so a second action restarts the wait even with the same date. */
type Reload = { from: string | null }

/*
Whether a Save makes the server reload. Only when the set of lines changed, by its
`HasSameItems` (TechnitiumLibrary CollectionExtensions.cs: same count, every item of
the one in the other, order aside; BlockListZoneManager.cs:512-523), and there is
something to reload with a timer to do it: with no lines the server flushes the zones
there and then (`Flush()`, :527), and with the interval at 0 it reloads nothing.
*/
function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

/*
How many lines the save would change. A list is identified by its URL, so switching
a list off is ONE change and not the removal of one line plus the addition of
another. Headings are counted apart, as edits between the two sequences of headings
(`headingEdits`), so renaming a group is one change too. Lines that only moved
still count as one change: the order is saved too.
*/
function pendingChanges(saved: ListLine[], lines: ListLine[]): number {
  const byKey = new Map<string, [string[], string[]]>()
  const put = (l: ListLine, side: 0 | 1) => {
    if (l.url == null) return
    const entry = byKey.get(l.url) ?? [[], []]
    entry[side].push(l.raw)
    byKey.set(l.url, entry)
  }
  saved.forEach((l) => put(l, 0))
  lines.forEach((l) => put(l, 1))
  const heads = (all: ListLine[]) => all.filter((l) => l.kind === 'comment').map((l) => l.raw)

  let n = 0
  for (const [before, after] of byKey.values()) {
    const rest = [...after]
    let gone = 0
    for (const raw of before) {
      const i = rest.indexOf(raw)
      if (i < 0) gone++
      else rest.splice(i, 1)
    }
    n += Math.max(gone, rest.length)
  }
  n += headingEdits(heads(saved), heads(lines))
  return n === 0 && !sameLines(saved, lines) ? 1 : n
}

/** A heading being written: an existing group by its ordinal, or a new one. */
type Editing = { group: number | 'new'; value: string; problem: string | null }

const UNNAMED = 'Unnamed group'
const nameOf = (line: ListLine) => headingName(line) || UNNAMED
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/*
The heading editor: one field, its verb and `Cancel`. Enter takes it and Escape
leaves it, as a field in a row should; the sentence that refuses a name goes under
the field, once (the design rule).
*/
function HeadingEditor({
  editing,
  verb,
  onChange,
  onSubmit,
  onCancel,
}: {
  editing: Editing
  verb: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const problemId = useId()
  return (
    <form
      className={styles.editor}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <Input
        autoFocus
        aria-label="Group name"
        className={`${styles.bad} ${styles.editorField}`}
        value={editing.value}
        aria-invalid={editing.problem != null || undefined}
        aria-describedby={editing.problem != null ? problemId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
      />
      <Button size="sm" variant="primary" type="submit">{verb}</Button>
      <Button size="sm" type="button" onClick={onCancel}>Cancel</Button>
      {editing.problem != null && (
        <p id={problemId} className={styles.invalid}>{editing.problem}</p>
      )}
    </form>
  )
}

export function BlockLists({
  tabs,
  token,
  permissions,
  clusterInitialised = false,
}: {
  tabs?: ReactNode
  token: string | null
  permissions: Permissions
  clusterInitialised?: boolean
}) {
  const node = clusterInitialised ? 'cluster' : ''
  const viewNeed = missing(permissions, 'Settings.canView')
  const modifyNeed = missing(permissions, 'Settings.canModify')
  const statsNeed = missing(permissions, 'Dashboard.canView')
  const invalidId = useId()

  const [saved, setSaved] = useState<ListLine[] | null>(null)
  const [readFailed, setReadFailed] = useState(false)
  const [lines, setLines] = useState<ListLine[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [interval, setIntervalHours] = useState<number | null>(null)
  const [hasSaved, setHasSaved] = useState(false)
  const [counts, setCounts] = useState<{ block: number; allow: number } | null>(null)
  const [countsFailed, setCountsFailed] = useState(false)
  const [catalog, setCatalog] = useState<QuickEntry[]>([])
  /** The console's own entries, once Technitium's are known to leave out repeats. */
  const [more, setMore] = useState<QuickEntry[]>([])
  const [field, setField] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [askUpdate, setAskUpdate] = useState(false)
  /** The group "Add a list" and Quick Add put lists into: a heading's ordinal, -1 for none. */
  const [group, setGroup] = useState(-1)
  const [editing, setEditing] = useState<Editing | null>(null)
  /* Closing the editor removes the field that held the focus: it goes back to the
     button that opened it, found by its name once the table is drawn again. */
  const table = useRef<HTMLDivElement>(null)
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    const name = focusAfter.current
    if (name == null || editing != null) return
    focusAfter.current = null
    const target = [...(table.current?.querySelectorAll('button') ?? [])].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent) === name,
    )
    target?.focus()
  }, [editing, lines])
  /** The server is reloading the lists: the counts on screen are not current yet. */
  const [reloading, setReloading] = useState<Reload | null>(null)
  /** The lines as the server last answered them, to tell whether a Save reloads. */
  const serverUrls = useRef<string[]>([])
  /** `blockListNextUpdatedOn` as the server last answered it. */
  const serverNext = useRef<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (viewNeed != null) return
    let live = true
    void readSettings(token, node).then((r) => {
      if (!live) return
      /* As every other tab: with nothing on screen, the notice carries the server's
         message, and the table slot says the read failed. */
      if (r.kind !== 'ok') {
        setReadFailed(true)
        setNotice(noticeFromFailure(r))
        return
      }
      const s = r.data
      const read = fromUrls(s.blockListUrls)
      setSaved(read)
      setLines(read)
      // `settings/get` OMITS this key when it is null (CONVENTIONS.md): absent is "Not Scheduled".
      setNext(s.blockListNextUpdatedOn ?? null)
      serverNext.current = s.blockListNextUpdatedOn ?? null
      serverUrls.current = s.blockListUrls ?? []
      setIntervalHours(s.blockListUpdateIntervalHours)
      setHasSaved(s.blockListUrls != null)
    })
    return () => {
      live = false
    }
  }, [token, node, viewNeed])

  useEffect(() => {
    let live = true
    void loadQuickList('quick-block-lists').then((e) => {
      if (!live) return
      setCatalog(e)
      setMore(moreLists(e))
    })
    return () => {
      live = false
    }
  }, [])

  const readCounts = useCallback(async () => {
    if (statsNeed != null) return
    const r = await getDashboardStats(token, 'LastHour', undefined, node)
    if (!mounted.current) return
    if (r.kind !== 'ok') {
      setCountsFailed(true)
      return
    }
    setCountsFailed(false)
    setCounts({ block: r.data.stats.blockListZones, allow: r.data.stats.allowListZones })
  }, [token, node, statsNeed])

  useEffect(() => {
    void readCounts()
  }, [readCounts])

  /* The wait described at POLL_MS: armed by a Save or an Update Now. Until it ends the
     next-update line keeps what the action left there ("Updating Now" after Update
     Now, main.js:2352-2356). */
  useEffect(() => {
    if (reloading == null) return
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const started = Date.now()
    const tick = async () => {
      const r = await readSettings(token, node)
      if (!live) return
      const now = r.kind !== 'ok' ? undefined : (r.data.blockListNextUpdatedOn ?? null)
      const finished = now !== undefined && now !== reloading.from
      if (!finished && Date.now() - started < POLL_LIMIT_MS) {
        timer = setTimeout(() => void tick(), POLL_MS)
        return
      }
      if (now !== undefined) {
        setNext(now)
        serverNext.current = now
      }
      await readCounts()
      if (live) setReloading(null)
    }
    timer = setTimeout(() => void tick(), POLL_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [reloading, token, node, readCounts])

  if (viewNeed != null) {
    return (
      <>
        <SectionHeader section="Blocking" title="Lists" tabs={tabs} />
        <Locked title="Block Lists" need={viewNeed} />
      </>
    )
  }

  const pending = saved == null ? 0 : pendingChanges(saved, lines)
  const off = modifyNeed != null
  const loading = saved == null
  const heads = headingIndexes(lines)
  /* What the chosen group still means: a Discard or a Quick Add that emptied the
     headings leaves an ordinal that no longer exists, and that is no group. */
  const target = group < heads.length ? group : -1
  const edit = editing != null && (editing.group === 'new' || editing.group < heads.length) ? editing : null

  function submitHeading() {
    if (edit == null) return
    const problem = headingProblem(edit.value)
    if (problem != null) {
      setEditing({ ...edit, problem })
      return
    }
    if (edit.group === 'new') {
      setLines(addHeading(lines, edit.value))
      // The new group is the one the next list goes into.
      setGroup(heads.length)
      focusAfter.current = 'Add group'
    } else {
      setLines(renameHeading(lines, heads[edit.group], edit.value))
      focusAfter.current = `Rename group ${edit.value.trim()}`
    }
    setEditing(null)
  }

  function cancelEditing() {
    if (edit == null) return
    focusAfter.current = edit.group === 'new' ? 'Add group' : `Rename group ${nameOf(lines[heads[edit.group]])}`
    setEditing(null)
  }

  function ungroup(g: number) {
    setLines(removeHeading(lines, heads[g]))
    // Its lists joined the group above, and so does the choice of group.
    if (target >= g) setGroup(target - 1)
    if (edit != null && edit.group !== 'new' && edit.group >= g) setEditing(null)
  }

  function add(kind: 'block' | 'allow') {
    const url = field.trim()
    if (url === '') return
    if (url.startsWith('#') || url.startsWith('!')) {
      setInvalid(MSG_PREFIX)
      return
    }
    if (lines.some((l) => l.url === url)) {
      setInvalid(MSG_DUPLICATE)
      return
    }
    setLines(addListTo(lines, url, kind, target))
    setField('')
    setInvalid(null)
  }

  async function save() {
    setBusy(true)
    const r = await setSettings(token, saveBody(lines, node))
    setBusy(false)
    if (r.kind !== 'ok') {
      setNotice(noticeFromFailure(r))
      return
    }
    const read = fromUrls(r.data.response.blockListUrls)
    setSaved(read)
    setLines(read)
    setHasSaved(r.data.response.blockListUrls != null)
    // The response carries the server's schedule, as Settings redraws from it: emptying
    // the lists stops the timer, and the key then comes back omitted ("Not Scheduled").
    const answered = r.data.response.blockListNextUpdatedOn ?? null
    setNext(answered)
    setIntervalHours(r.data.response.blockListUpdateIntervalHours)
    // Settings.tsx:253-257, title and sentence.
    setNotice({ type: 'success', title: 'Settings Saved!', text: 'DNS Server settings were saved successfully.' })
    // See `sameItems`: whether, and how, the counts change.
    const urls = r.data.response.blockListUrls ?? []
    const changed = !sameItems(urls, serverUrls.current)
    serverUrls.current = urls
    serverNext.current = answered
    const interval = r.data.response.blockListUpdateIntervalHours ?? 0
    if (!changed) return
    if (urls.length > 0 && interval > 0) setReloading({ from: answered })
    else {
      setReloading(null)
      void readCounts()
    }
  }

  async function updateNow() {
    setAskUpdate(false)
    setBusy(true)
    // The date to wait on, read just before the call (see POLL_MS); the last answer
    // known if the read fails.
    const before = await readSettings(token, node)
    const from = before.kind !== 'ok' ? serverNext.current : (before.data.blockListNextUpdatedOn ?? null)
    const ok = await forceUpdateBlockLists(token)
    setBusy(false)
    if (!ok) return
    // main.js:2356. The label becomes "Updating Now" without reloading the settings.
    setNext(new Date(0).toISOString())
    setNotice({ type: 'success', title: 'Updating Block List!', text: 'Block list update was triggered successfully.' })
    setReloading({ from })
  }

  /* What names a row: Technitium's entries first, so theirs wins a shared URL. */
  const named = [...catalog, ...more]

  const listsCount = lines.filter((l) => l.kind !== 'comment').length
  const disabledCount = lines.filter((l) => l.kind !== 'comment' && !l.enabled).length
  const groupCount = heads.length

  /* The lists of each group, to say how many it holds. */
  const groupSize = (g: number) => (heads[g + 1] ?? lines.length) - (g < 0 ? 0 : heads[g] + 1)

  function headingRow(key: string, name: string, count: number, controls: ReactNode) {
    return (
      <tr key={key} className={styles.groupRow}>
        <th colSpan={4} scope="colgroup">
          <div className={styles.groupHead}>
            <span className={styles.groupName}>{name}</span>
            <span className={styles.groupCount}>{plural(count, 'list', 'lists')}</span>
            {controls != null && <span className={styles.spacer} />}
            {controls}
          </div>
        </th>
      </tr>
    )
  }

  /* One row per line. A key that follows the line and not its place, so a list that
     moves or switches keeps its row, and the focus stays on the button pressed. */
  const seen = new Map<string, number>()
  const rows: ReactNode[] = []
  if (heads.length > 0 && heads[0] > 0) rows.push(headingRow('none', 'No group', groupSize(-1), null))
  lines.forEach((l, i) => {
    if (l.kind === 'comment') {
      const g = heads.indexOf(i)
      const name = nameOf(l)
      rows.push(
        edit != null && edit.group === g ? (
          <tr key={`H:${g}`} className={styles.groupRow}>
            <th colSpan={4} scope="colgroup">
              <HeadingEditor
                editing={edit}
                verb="Rename"
                onChange={(value) => setEditing({ ...edit, value, problem: null })}
                onSubmit={submitHeading}
                onCancel={cancelEditing}
              />
            </th>
          </tr>
        ) : (
          headingRow(`H:${g}`, name, groupSize(g), (
            <>
              <PermissionButton size="sm" permission={modifyNeed} aria-label={`Rename group ${name}`}
                onClick={() => setEditing({ group: g, value: headingName(l), problem: null })}>
                Rename
              </PermissionButton>
              <PermissionButton size="sm" permission={modifyNeed} aria-label={`Ungroup ${name}`}
                onClick={() => ungroup(g)}>
                Ungroup
              </PermissionButton>
            </>
          ))
        ),
      )
      return
    }
    const id = `${l.kind}:${l.url}`
    const n = seen.get(id) ?? 0
    seen.set(id, n + 1)
    const name = l.url == null ? null : listName(l.url, named)
    const faded = !l.enabled ? styles.off : undefined
    const what = `${l.kind} list ${l.url ?? ''}`
    rows.push(
      <tr key={`L:${id}:${n}`}>
        <td>
          {canToggle(l) && (
            <label className={styles.switch}>
              <input
                type="checkbox"
                aria-label={`Enabled ${what}`}
                checked={l.enabled}
                disabled={off}
                onChange={() => setLines((all) => all.map((x, j) => (j === i ? toggleLine(x) : x)))}
              />
            </label>
          )}
        </td>
        <td className={faded}>
          {name != null && <div className={styles.name}>{name}</div>}
          <div className={styles.url}>{l.url ?? l.raw}</div>
          {/* The kind under the URL where the Type column is folded away. */}
          <span className={`${styles.kind} ${styles.kindInline} ${KIND_CLASS[l.kind]}`}>
            <Icon name={KIND_ICON[l.kind]} size={14} />
            {KIND_LABEL[l.kind]}
          </span>
        </td>
        <td className={`${faded ?? ''} ${styles.kindCell}`}>
          <span className={`${styles.kind} ${KIND_CLASS[l.kind]}`}>
            <Icon name={KIND_ICON[l.kind]} size={14} />
            {KIND_LABEL[l.kind]}
          </span>
        </td>
        <td className={styles.actions}>
          <div className={styles.rowActions}>
            <RowAction icon="moveUp" name="Move up" aria-label={`Move up ${what}`}
              disabled={off || !canMove(lines, i, -1)} onClick={() => setLines((all) => moveLine(all, i, -1))} />
            <RowAction icon="moveDown" name="Move down" aria-label={`Move down ${what}`}
              disabled={off || !canMove(lines, i, 1)} onClick={() => setLines((all) => moveLine(all, i, 1))} />
            <PermissionButton size="sm" variant="danger" permission={modifyNeed}
              aria-label={`Remove ${l.url ?? l.raw}`}
              onClick={() => setLines((all) => all.filter((_, j) => j !== i))}>
              Remove
            </PermissionButton>
          </div>
        </td>
      </tr>,
    )
  })
  if (edit != null && edit.group === 'new') {
    rows.push(
      <tr key="H:new" className={styles.groupRow}>
        <th colSpan={4} scope="colgroup">
          <HeadingEditor
            editing={edit}
            verb="Add group"
            onChange={(value) => setEditing({ ...edit, value, problem: null })}
            onSubmit={submitHeading}
            onCancel={cancelEditing}
          />
        </th>
      </tr>,
    )
  }

  return (
    <>
      <SectionHeader section="Blocking" title="Lists" tabs={tabs} />
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={shared.stack}>
        <div className={shared.kpis3}>
          {statsNeed != null ? (
            <>
              <Locked title="Block List Domains" need={statsNeed} />
              <Locked title="Allow List Domains" need={statsNeed} />
            </>
          ) : (
            <>
              <Panel className={shared.centred}><Body>
                <div className={shared.kpiText}>
                  {countsFailed ? (
                    <Failure>{COUNTS_FAILED}</Failure>
                  ) : (
                    <span className={`${shared.kpiValue}${reloading != null ? ` ${styles.stale}` : ''}`}>
                      {counts ? counts.block.toLocaleString() : '—'}
                    </span>
                  )}
                  {reloading != null ? (
                    <span className={styles.pending}>{UPDATING}</span>
                  ) : (
                    <span className={shared.kpiSub}>{'\u00a0'}</span>
                  )}
                  <span className={shared.kpiLabel}>Block List Domains</span>
                </div>
              </Body></Panel>
              <Panel className={shared.centred}><Body>
                <div className={shared.kpiText}>
                  {countsFailed ? (
                    <Failure>{COUNTS_FAILED}</Failure>
                  ) : (
                    <span className={`${shared.kpiValue}${reloading != null ? ` ${styles.stale}` : ''}`}>
                      {counts ? counts.allow.toLocaleString() : '—'}
                    </span>
                  )}
                  {reloading != null ? (
                    <span className={styles.pending}>{UPDATING}</span>
                  ) : (
                    <span className={shared.kpiSub}>{'\u00a0'}</span>
                  )}
                  <span className={shared.kpiLabel}>Allow List Domains</span>
                </div>
              </Body></Panel>
            </>
          )}
          <Panel className={shared.centred}><Body>
            <div className={shared.kpi}>
              <div className={shared.kpiText}>
                <span className={shared.kpiValue}>{loading ? '—' : nextUpdateText(next)}</span>
                <span className={shared.kpiSub}>{'\u00a0'}</span>
                <span className={shared.kpiLabel}>
                  Next update{interval != null && interval > 0 ? ` · every ${interval} h` : ''}
                </span>
              </div>
              <PermissionButton
                permission={modifyNeed}
                disabled={busy || !hasSaved}
                onClick={() => setAskUpdate(true)}
              >
                Update Now
              </PermissionButton>
            </div>
          </Body></Panel>
        </div>

        <Panel title="Add a list">
          <Body>
            {/* Above both ways in, the URL and Quick Add, because it serves both. */}
            <div className={styles.target}>
              <Field label="Add to group">
                {(id) => (
                  <Select
                    id={id}
                    disabled={off || loading || heads.length === 0}
                    value={String(target)}
                    onChange={(ev) => setGroup(Number(ev.target.value))}
                  >
                    <option value="-1">No group</option>
                    {heads.map((h, g) => (
                      <option key={g} value={String(g)}>{nameOf(lines[h])}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className={styles.add}>
              <Field label="List URL">
                {(id) => (
                  <Input
                    id={id}
                    mono
                    className={styles.bad}
                    placeholder="https://…/hosts"
                    value={field}
                    disabled={off || loading}
                    aria-invalid={invalid != null || undefined}
                    aria-describedby={invalid != null ? invalidId : undefined}
                    onChange={(e) => {
                      setField(e.target.value)
                      setInvalid(null)
                    }}
                  />
                )}
              </Field>
              <PermissionButton variant="primary" permission={modifyNeed} disabled={loading} onClick={() => add('block')}>
                Add block list
              </PermissionButton>
              <PermissionButton permission={modifyNeed} disabled={loading} onClick={() => add('allow')}>
                Add allow list
              </PermissionButton>
              {/* The URL's own sentences stay under it, in the URL's column. */}
              {invalid != null && (
                <p id={invalidId} className={styles.invalid}>
                  {invalid}
                </p>
              )}
              <p className={styles.help}>
                Use <code>file://</code> for a list stored on this server. Hosts, plain domain, wildcard or
                Adblock Plus files.
              </p>
              {/* Its own line under the URL, as wide as the URL, as upstream draws it
                  (`index.html:2156-2157`, `width: 100%`): the catalogue's names run to
                  86 characters and a trigger beside the buttons cut them to one letter. */}
              <div className={styles.quick}>
                <Field label="Quick Add">
                  {(id) => (
                    <Select
                      id={id}
                      disabled={off || loading}
                      value=""
                      searchable
                      searchLabel="Search lists"
                      noMatchText="No lists match"
                      onChange={(ev) => {
                        const chosen = ev.target.value
                        if (chosen === '') return
                        const entry = chosen === 'none'
                          ? 'none'
                          : chosen.startsWith(MORE)
                            ? more[Number(chosen.slice(MORE.length))]
                            : catalog.find((q) => q.name === chosen)
                        if (entry != null) setLines((l) => applyQuickTo(l, entry, target))
                      }}
                    >
                      <option value="" />
                      <option value="none">None</option>
                      {catalog.map((q) => (
                        <option key={q.name} value={q.name} data-search={hostsOf(q)}>{q.name}</option>
                      ))}
                      {more.length > 0 && (
                        <optgroup label="More lists">
                          {more.map((q, i) => (
                            <option key={`${MORE}${i}`} value={`${MORE}${i}`} data-search={hostsOf(q)}>
                              {q.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                  )}
                </Field>
              </div>
            </div>
          </Body>
        </Panel>

        <Panel className={shared.flush}>
          <div ref={table}>
            {readFailed ? (
              <Body><Failure>Could not read the block list settings.</Failure></Body>
            ) : saved == null ? (
              <Body><Loading /></Body>
            ) : (
              <Table
                header={<><th>Enabled</th><th>List</th><th className={styles.kindCell}>Type</th><th /></>}
                isEmpty={lines.length === 0 && edit?.group !== 'new'}
                emptyText="No lists"
                columns={4}
                className={shared.inPanel}
              >
                {rows}
              </Table>
            )}
            <div className={styles.foot}>
              <PermissionButton size="sm" permission={modifyNeed} disabled={loading || edit?.group === 'new'}
                onClick={() => setEditing({ group: 'new', value: '', problem: null })}>
                Add group
              </PermissionButton>
              <span>
                {plural(listsCount, 'list', 'lists')} · {disabledCount} disabled · {plural(groupCount, 'group', 'groups')}
              </span>
              <span className={styles.spacer} />
              <RouteLink to={{ section: 'settings', sub: 'Blocking' }}>More blocking settings in Settings › Blocking</RouteLink>
            </div>
          </div>
        </Panel>

        {pending > 0 && (
          <div className={styles.bar}>
            <span>{pending === 1 ? '1 unsaved change' : `${pending} unsaved changes`} to the block list URLs</span>
            <span className={styles.spacer} />
            <Button disabled={busy} onClick={() => saved && setLines(saved)}>Discard</Button>
            <PermissionButton variant="primary" disabled={busy} permission={modifyNeed} onClick={() => void save()}>
              Save
            </PermissionButton>
          </div>
        )}
      </div>

      <Confirm
        open={askUpdate}
        onClose={() => setAskUpdate(false)}
        title="Update Block Lists"
        label="Update"
        variant="primary"
        text="Are you sure to force download and update the block lists?"
        busy={busy}
        onConfirm={() => void updateNow()}
      />
    </>
  )
}
