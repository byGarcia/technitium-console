import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { readSettings, setSettings, forceUpdateBlockLists } from '../../api/settings'
import { getDashboardStats } from '../../api/dashboard'
import { loadQuickList, type QuickEntry } from '../../lib/quick-lists'
import { nextUpdateText } from '../settings/panes/Blocking'
import { SectionHeader } from '../../ui/SectionHeader'
import { Panel, Body } from '../../ui/Panel'
import { Table } from '../../ui/Table'
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
  addList, applyQuick, canToggle, fromUrls, listName, saveBody, sameLines, toggleLine, type ListLine,
} from './list-lines'
import { Locked } from './Locked'
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
- the table: the columns `Enabled`, `List` and `Type`, the types `Block`, `Allow`
  and `Comment`, `Remove`, `No lists`, and the row controls' aria-labels;
- the table's foot: `N list(s) · N disabled · N comment(s)`;
- the unsaved-changes bar: `1 unsaved change` / `N unsaved changes` with its
  suffix `to the block list URLs`, `Discard`, and `Save`, shortened from upstream's
  "Save Settings" (index.html:2460);
- the two `Could not read …` sentences and the link to Settings › Blocking.

No node selector: `blockListUrls` is a CLUSTER-WIDE parameter (`nodeScope`,
settings/model.ts:514), so it is read and saved on the cluster when there is one and
on this server when there is not — what Settings does with the aggregate.

Changes are KEPT until Save, as upstream's Save Settings keeps the textarea:
`Quick Add > None` empties every list, and saving on each click would make that one
click unrecoverable. One save also means one request, so quick changes cannot land
out of order.
*/

const KIND_LABEL = { block: 'Block', allow: 'Allow', comment: 'Comment' } as const
const KIND_CLASS = { block: styles.block, allow: styles.allow, comment: styles.comment } as const
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
the counts change when it has finished, not at once (spec, «Qué se refresca»). Until
then both figures say "Updating…" (OURS).

How the end is told, from the server (v15.5.1): `blockListNextUpdatedOn` is the last
SUCCESSFUL update plus the interval (WebServiceSettingsApi.cs:384), and the last update
only moves when a download ends well (BlockListZoneManager.cs:674-692). While it
reloads, then, the server keeps answering the OLD date —a future one, so "Updating
Now" is no signal—. The value is captured when the action is taken (Save: from its
own answer; Update Now: read just before the call) and the settings are read every
POLL_MS until it differs; then the counts are read once more. POLL_LIMIT_MS bounds the
wait —a download that fails never moves the date— and at the limit the counts are read
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
Whether a Save makes the server reload. Only when the set of lines changed —its
`HasSameItems` (TechnitiumLibrary CollectionExtensions.cs: same count, every item of
the one in the other, order aside; BlockListZoneManager.cs:512-523)— and there is
something to reload with a timer to do it: with no lines the server flushes the zones
there and then (`Flush()`, :527), and with the interval at 0 it reloads nothing.
*/
function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

/*
How many lines the save would change. A line is identified by its URL (a comment by
its text), so switching a list off is ONE change and not the removal of one line
plus the addition of another. Lines that only moved —removed and added back, which
puts them last— still count as one change: the order is saved too.
*/
function pendingChanges(saved: ListLine[], lines: ListLine[]): number {
  const byKey = new Map<string, [string[], string[]]>()
  const put = (l: ListLine, side: 0 | 1) => {
    const key = l.url ?? l.raw
    const entry = byKey.get(key) ?? [[], []]
    entry[side].push(l.raw)
    byKey.set(key, entry)
  }
  saved.forEach((l) => put(l, 0))
  lines.forEach((l) => put(l, 1))

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
  return n === 0 && !sameLines(saved, lines) ? 1 : n
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
  const [field, setField] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [askUpdate, setAskUpdate] = useState(false)
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
    void loadQuickList('quick-block-lists').then((e) => live && setCatalog(e))
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
    setLines(addList(lines, url, kind))
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
    // main.js:2356 — the label becomes "Updating Now" without reloading the settings.
    setNext(new Date(0).toISOString())
    setNotice({ type: 'success', title: 'Updating Block List!', text: 'Block list update was triggered successfully.' })
    setReloading({ from })
  }

  const listsCount = lines.filter((l) => l.kind !== 'comment').length
  const disabledCount = lines.filter((l) => l.kind !== 'comment' && !l.enabled).length
  const commentCount = lines.length - listsCount

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
            <div className={shared.add}>
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
              <Field label="Quick Add">
                {(id) => (
                  <Select
                    id={id}
                    disabled={off || loading}
                    value=""
                    onChange={(ev) => {
                      const chosen = ev.target.value
                      if (chosen === '') return
                      const entry = chosen === 'none' ? 'none' : catalog.find((q) => q.name === chosen)
                      if (entry != null) setLines((l) => applyQuick(l, entry))
                    }}
                  >
                    <option value="" />
                    <option value="none">None</option>
                    {catalog.map((q) => (
                      <option key={q.name} value={q.name}>{q.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {invalid != null && (
              <p id={invalidId} className={styles.invalid}>
                {invalid}
              </p>
            )}
            <p className={styles.help}>
              Use <code>file://</code> for a list stored on this server. Hosts, plain domain, wildcard or
              Adblock Plus files.
            </p>
          </Body>
        </Panel>

        <Panel className={shared.flush}>
          {readFailed ? (
            <Body><Failure>Could not read the block list settings.</Failure></Body>
          ) : saved == null ? (
            <Body><Loading /></Body>
          ) : (
            <Table
              header={<><th>Enabled</th><th>List</th><th>Type</th><th /></>}
              isEmpty={lines.length === 0}
              emptyText="No lists"
              columns={4}
              className={shared.inPanel}
            >
              {lines.map((l, i) => {
                const name = l.url == null ? null : listName(l.url, catalog)
                const faded = l.kind !== 'comment' && !l.enabled ? styles.off : undefined
                return (
                  <tr key={`${i}:${l.raw}`}>
                    <td>
                      {canToggle(l) && (
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            aria-label={`Enabled ${l.kind} list ${l.url ?? ''}`}
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
                    </td>
                    <td className={faded}>
                      <span className={`${styles.kind} ${KIND_CLASS[l.kind]}`}>
                        {l.kind !== 'comment' && <Icon name={KIND_ICON[l.kind]} size={14} />}
                        {KIND_LABEL[l.kind]}
                      </span>
                    </td>
                    <td className={styles.actions}>
                      <PermissionButton size="sm" variant="danger" permission={modifyNeed}
                        aria-label={`Remove ${l.url ?? l.raw}`}
                        onClick={() => setLines((all) => all.filter((_, j) => j !== i))}>
                        Remove
                      </PermissionButton>
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
          <div className={styles.foot}>
            <span>
              {listsCount} {listsCount === 1 ? 'list' : 'lists'} · {disabledCount} disabled · {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
            </span>
            <span className={styles.spacer} />
            <RouteLink to={{ section: 'settings', sub: 'Blocking' }}>More blocking settings in Settings › Blocking</RouteLink>
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
