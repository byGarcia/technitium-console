import { useEffect, useId, useState, type ReactNode } from 'react'
import { getSettings, setSettings, forceUpdateBlockLists } from '../../api/settings'
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

Its words are OURS where upstream has no counterpart: the figures (`Block List
Domains`, `Allow List Domains`), the panel titles (`Block Lists`, `Add a list`,
`Update Block Lists`), `Add block list` / `Add allow list`, `No lists`, `Discard`,
`This list is already in the table.`, the two `Could not read …` sentences and the
link to Settings › Blocking. `Quick Add`, `Update Now`, `Save` and every alert of
the update and the save are upstream's.

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

  useEffect(() => {
    if (viewNeed != null) return
    let live = true
    void getSettings(token, node).then((s) => {
      if (!live) return
      if (s == null) {
        setReadFailed(true)
        return
      }
      const read = fromUrls(s.blockListUrls)
      setSaved(read)
      setLines(read)
      // `settings/get` OMITS this key when it is null (CONVENTIONS.md): absent is "Not Scheduled".
      setNext(s.blockListNextUpdatedOn ?? null)
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

  useEffect(() => {
    if (statsNeed != null) return
    let live = true
    void getDashboardStats(token, 'LastHour', undefined, node).then((r) => {
      if (!live) return
      if (r.kind !== 'ok') {
        setCountsFailed(true)
        return
      }
      setCountsFailed(false)
      setCounts({ block: r.data.stats.blockListZones, allow: r.data.stats.allowListZones })
    })
    return () => {
      live = false
    }
  }, [token, node, statsNeed])

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
    setNext(r.data.response.blockListNextUpdatedOn ?? null)
    setIntervalHours(r.data.response.blockListUpdateIntervalHours)
    // Settings.tsx:253-257, title and sentence.
    setNotice({ type: 'success', title: 'Settings Saved!', text: 'DNS Server settings were saved successfully.' })
  }

  async function updateNow() {
    setAskUpdate(false)
    setBusy(true)
    const ok = await forceUpdateBlockLists(token)
    setBusy(false)
    if (!ok) return
    // main.js:2356 — the label becomes "Updating Now" without reloading the settings.
    setNext(new Date(0).toISOString())
    setNotice({ type: 'success', title: 'Updating Block List!', text: 'Block list update was triggered successfully.' })
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
              <Panel><Body>
                {countsFailed ? (
                  <Failure>{COUNTS_FAILED}</Failure>
                ) : (
                  <div className={styles.stat}>{counts ? counts.block.toLocaleString() : '—'}</div>
                )}
                <div className={styles.statLabel}>Block List Domains</div>
              </Body></Panel>
              <Panel><Body>
                {countsFailed ? (
                  <Failure>{COUNTS_FAILED}</Failure>
                ) : (
                  <div className={styles.stat}>{counts ? counts.allow.toLocaleString() : '—'}</div>
                )}
                <div className={styles.statLabel}>Allow List Domains</div>
              </Body></Panel>
            </>
          )}
          <Panel><Body>
            <div className={styles.next}>
              <div>
                <div className={styles.stat}>{loading ? '—' : nextUpdateText(next)}</div>
                <div className={styles.statLabel}>
                  Next update{interval != null && interval > 0 ? ` · every ${interval} h` : ''}
                </div>
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

        <Panel>
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
                      <span className={`${styles.kind} ${KIND_CLASS[l.kind]}`}>{KIND_LABEL[l.kind]}</span>
                    </td>
                    <td>
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
              {listsCount} lists · {disabledCount} disabled · {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
            </span>
            <span className={styles.spacer} />
            <RouteLink to={{ section: 'settings', sub: 'Blocking' }}>More blocking settings in Settings › Blocking</RouteLink>
          </div>
        </Panel>

        {pending > 0 && (
          <div className={styles.bar}>
            <span>{pending === 1 ? '1 unsaved change' : `${pending} unsaved changes`}</span>
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
