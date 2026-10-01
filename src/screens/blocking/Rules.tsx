import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { readRuleExport } from '../../api/blocking'
import { deleteDomain, exportDomains, flushList, type DomainList } from '../../api/zonelists'
import { SectionHeader } from '../../ui/SectionHeader'
import { Panel, Body } from '../../ui/Panel'
import { Table } from '../../ui/Table'
import { Pagination } from '../../ui/Pagination'
import { Segmented } from '../../ui/Segmented'
import { Menu } from '../../ui/Menu'
import { PermissionButton } from '../../ui/PermissionButton'
import { Tooltip } from '../../ui/Tooltip'
import { Confirm } from '../../ui/Confirm'
import { Notifier } from '../../ui/Notifier'
import { Input } from '../../ui/Field'
import { Icon } from '../../ui/Icon'
import { Empty, Loading } from '../../ui/Empty'
import { pageWindow } from '../../lib/pagination'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { StaleData } from '../StaleData'
import { Lists, ImportDomains } from '../lists/Lists'
import { AddDomainBar } from './AddDomainBar'
import { missing, requiresText, type Need, type Permissions } from './permissions'
import {
  countRules, filterRules, mergeRules, pageOf, readRuleParam, ruleSearch,
  type Rule, type RuleFilter,
} from './rules-model'
import shared from './Blocking.module.css'
import styles from './Rules.module.css'

/*
The Rules tab: the administrator's own blocked and allowed domains in one flat table,
as Pi-hole's Domains page draws them. The table is OURS —and so are its words:
`Filter domains`, `No rules`, `1 rule` / `N rules`, `List` / `Tree`—; every verb on
it is upstream's, with its sentences (other-zones.js), and the three verbs of the
foot do NOT behave alike, so they are not made alike: Import opens its dialog,
Export downloads at once with a single-use token, Flush asks first.

`Tree` mounts the tree that exists today, so nothing upstream has is lost.
*/

const LABEL: Record<DomainList, string> = { blocked: 'Blocked', allowed: 'Allowed' }

interface Confirmation {
  title: string
  text: string
  label: string
  action: () => Promise<void>
}

export function Rules({
  tabs,
  token,
  permissions,
  nodes = [],
  clusterInitialised = false,
}: {
  tabs?: ReactNode
  token: string | null
  permissions: Permissions
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean
}) {
  const viewBlocked = missing(permissions, 'Blocked.canView') == null
  const viewAllowed = missing(permissions, 'Allowed.canView') == null
  /* Neither list can be read: there is nothing to count, so nothing is counted —
     the table slot carries the padlock instead of zeros nobody read. */
  const viewNone = !viewBlocked && !viewAllowed

  const [rules, setRules] = useState<Rule[] | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  /* The first read failed and there is nothing to draw: the notice says why, and
     the slot must not keep saying "Loading…" once it has been dismissed. */
  const [failed, setFailed] = useState(false)
  /* A later read failed: the table stays, and says it is no longer current. */
  const [stale, setStale] = useState(false)
  const [lastGood, setLastGood] = useState<string | null>(null)
  const hadData = useRef(false)
  /* A filter on a list the session cannot view would open locked, pressed, over an
     empty table — `/allowed/` for someone who may only see Blocked. It opens on All. */
  const [filter, setFilter] = useState<RuleFilter>(() => {
    const asked = readRuleParam(window.location.search)
    const may = asked === 'all' || (asked === 'blocked' ? viewBlocked : viewAllowed)
    return may ? asked : 'all'
  })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [treeList, setTreeList] = useState<DomainList>(viewBlocked ? 'blocked' : 'allowed')
  /* Bumped after Delete, Import and Flush: the open tree is mounted again so it
     reads the lists as they are now — from the primary node, as every read after a
     change does (spec, «Clúster»). Choosing another list or view is a fresh read
     again, from the connected node. */
  const [generation, setGeneration] = useState(0)
  const [afterChange, setAfterChange] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [importing, setImporting] = useState<DomainList | null>(null)
  const [busy, setBusy] = useState(false)

  /* Only the lists the session may view are read: the export of the other one
     would be refused by the server. */
  const load = useCallback(async () => {
    const read = (list: DomainList, may: boolean) => (may ? readRuleExport(list, token) : null)
    const [b, a] = await Promise.all([read('blocked', viewBlocked), read('allowed', viewAllowed)])
    const failure = [b, a].find((o) => o != null && o.kind !== 'ok')
    if (failure != null) {
      if (hadData.current) setStale(true)
      else {
        setFailed(true)
        setNotice(noticeFromFailure(failure))
      }
      return
    }
    setRules(mergeRules(b?.kind === 'ok' ? b.data : null, a?.kind === 'ok' ? a.data : null))
    hadData.current = true
    setFailed(false)
    setStale(false)
    setLastGood(new Date().toISOString())
  }, [token, viewBlocked, viewAllowed])

  useEffect(() => {
    void load()
  }, [load])

  /* The bar always says the filter on screen: on choosing, and on opening when the
     one it asked for fell back to All or meant nothing (`?rule=garbage`). The RAW
     value is compared, because `readRuleParam` already reads nonsense as All. */
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('rule')
    if (raw === (filter === 'all' ? null : filter)) return
    window.history.replaceState(null, '', window.location.pathname + ruleSearch(window.location.search, filter))
  }, [filter])

  function choose(f: RuleFilter) {
    setFilter(f)
    setPage(1)
  }

  function changed() {
    setGeneration((g) => g + 1)
    setAfterChange(true)
  }

  const counts = useMemo(() => countRules(rules ?? []), [rules])
  const shown = useMemo(() => filterRules(rules ?? [], filter, query), [rules, filter, query])
  const current = pageOf(shown, page)

  async function mutate(fn: () => Promise<{ kind: string; message?: string }>, success: Notice) {
    setBusy(true)
    const outcome = await fn()
    setBusy(false)
    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    changed()
    await load()
    setNotice(success)
  }

  function askDelete(rule: Rule) {
    const isAllowed = rule.list === 'allowed'
    setConfirmation({
      title: isAllowed ? 'Delete Allowed Zone' : 'Delete Blocked Zone',
      text: isAllowed
        ? `Are you sure you want to delete the allowed zone '${rule.domain}'?`
        : `Are you sure you want to delete the blocked zone '${rule.domain}'?`,
      label: 'Delete',
      action: () =>
        mutate(
          () => deleteDomain(rule.list, token, rule.domain),
          isAllowed
            ? { type: 'success', title: 'Deleted!', text: `Domain '${rule.domain}' was deleted from Allowed Zone successfully.` }
            : { type: 'success', title: 'Deleted!', text: `Blocked zone '${rule.domain}' was deleted successfully.` },
        ),
    })
  }

  function askFlush(list: DomainList) {
    const isAllowed = list === 'allowed'
    setConfirmation({
      title: isAllowed ? 'Flush Allowed Zone' : 'Flush Blocked Zone',
      text: isAllowed
        ? 'Are you sure you want to flush the entire Allowed zone?'
        : 'Are you sure you want to flush the entire Blocked zone?',
      label: 'Flush',
      action: () =>
        mutate(
          () => flushList(list, token),
          isAllowed
            ? { type: 'success', title: 'Flushed!', text: 'Allowed zone was flushed successfully.' }
            : { type: 'success', title: 'Flushed!', text: 'Blocked zone was flushed successfully.' },
        ),
    })
  }

  async function runExport(list: DomainList) {
    setBusy(true)
    const r = await exportDomains(list, token)
    setBusy(false)
    if (!r.ok) return
    setNotice({
      type: 'success',
      title: 'Exported!',
      text: list === 'allowed' ? 'Allowed zones were exported successfully.' : 'Blocked zones were exported successfully.',
    })
  }

  /* One menu entry per list. Without its permission it stays, disabled, and says
     which one is missing —the same padlock and tooltip `PermissionButton` draws—:
     a verb that vanishes is a verb nobody knows exists. */
  function entry(list: DomainList, need: Need | undefined, run: () => void, close: () => void) {
    if (need != null) {
      return (
        <Tooltip key={list} text={requiresText(need)} placement="left">
          <button type="button" disabled>
            <Icon name="lock" size={13} />
            {LABEL[list]} zones
          </button>
        </Tooltip>
      )
    }
    return (
      <button
        key={list}
        type="button"
        onClick={() => {
          close()
          run()
        }}
      >
        {LABEL[list]} zones
      </button>
    )
  }

  /* A list the session cannot read has no count: it was never read, and zero is a
     figure. The chosen filter says so with `aria-pressed` alone, the console's pressed
     button (amber text and border, as Glue and RRSIG in Records.tsx): a primary that is
     also pressed took the pressed rule's amber TEXT over its amber fill, and the label
     vanished. */
  const filterButton = (f: RuleFilter, count: number | undefined, need?: Need) => (
    <PermissionButton
      key={f}
      size="sm"
      aria-pressed={filter === f}
      permission={need}
      onClick={() => choose(f)}
    >
      {f === 'all' ? 'All' : LABEL[f]}
      {need == null && count != null && ` ${count}`}
    </PermissionButton>
  )

  const treeNeed = missing(permissions, treeList === 'allowed' ? 'Allowed.canView' : 'Blocked.canView')

  return (
    <>
      <SectionHeader section="Blocking" title="Rules" tabs={tabs} />
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={shared.stack}>
        <AddDomainBar
          token={token}
          permissions={permissions}
          onNotice={setNotice}
          onChanged={() => void load()}
        />

        {stale && <StaleData since={lastGood} onRetry={() => void load()} />}

        <Panel>
          <div className={styles.bar}>
            {view === 'list' ? (
              <>
                <div className={styles.filter} role="group" aria-label="Rule">
                  {filterButton('all', viewNone ? undefined : counts.all)}
                  {filterButton('blocked', counts.blocked, missing(permissions, 'Blocked.canView'))}
                  {filterButton('allowed', counts.allowed, missing(permissions, 'Allowed.canView'))}
                </div>
                <Input
                  className={styles.search}
                  aria-label="Filter domains"
                  placeholder="Filter domains…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                />
              </>
            ) : (
              <Segmented
                label="Tree"
                options={[
                  { id: 'blocked' as const, label: 'Blocked' },
                  { id: 'allowed' as const, label: 'Allowed' },
                ]}
                active={treeList}
                onChoose={(l) => {
                  setTreeList(l)
                  setAfterChange(false)
                }}
              />
            )}
            <span className={styles.spacer} />
            <Segmented
              label="View"
              options={[
                { id: 'list' as const, label: 'List' },
                { id: 'tree' as const, label: 'Tree' },
              ]}
              active={view}
              onChoose={(v) => {
                setView(v)
                setAfterChange(false)
                /* The tree deletes on its own and does not tell this table: coming
                   back to the list reads it again rather than show a deleted row. */
                if (v === 'list') void load()
              }}
            />
          </div>

          {view === 'tree' ? (
            treeNeed != null ? (
              <Body>
                <Empty compact>
                  <Icon name="lock" size={14} /> {requiresText(treeNeed)}
                </Empty>
              </Body>
            ) : (
              <Lists
                key={`${treeList}:${generation}`}
                list={treeList}
                token={token}
                nodes={nodes}
                clusterInitialised={clusterInitialised}
                embedded
                initialFromPrimary={afterChange}
                fieldName="Browse domain"
                canDelete={missing(permissions, treeList === 'allowed' ? 'Allowed.canDelete' : 'Blocked.canDelete') == null}
              />
            )
          ) : viewNone ? (
            <Body>
              <Empty compact>
                <Icon name="lock" size={14} /> {requiresText('Blocked.canView')}
              </Empty>
              <Empty compact>
                <Icon name="lock" size={14} /> {requiresText('Allowed.canView')}
              </Empty>
            </Body>
          ) : rules == null ? (
            failed ? null : <Loading />
          ) : (
            <>
              <Table
                header={
                  <>
                    <th>Domain</th>
                    <th>Rule</th>
                    <th />
                  </>
                }
                isEmpty={current.rows.length === 0}
                emptyText={query === '' ? 'No rules' : 'No rules match this filter'}
                columns={3}
              >
                {current.rows.map((r) => (
                  <tr key={`${r.list}:${r.domain}`}>
                    <td className={styles.domain}>{r.domain}</td>
                    <td>
                      <span className={`${styles.kind} ${styles[r.list]}`}>
                        <Icon name={r.list} size={14} />
                        {LABEL[r.list]}
                      </span>
                    </td>
                    <td className={styles.actions}>
                      <PermissionButton
                        size="sm"
                        variant="danger"
                        aria-label={`Delete ${r.domain}`}
                        disabled={busy}
                        permission={missing(permissions, r.list === 'allowed' ? 'Allowed.canDelete' : 'Blocked.canDelete')}
                        onClick={() => askDelete(r)}
                      >
                        Delete
                      </PermissionButton>
                    </td>
                  </tr>
                ))}
              </Table>
              {current.totalPages > 1 && (
                <Pagination
                  window={pageWindow(current.page, current.totalPages)}
                  current={current.page}
                  last={current.totalPages}
                  onGoTo={setPage}
                />
              )}
            </>
          )}

          <div className={styles.foot}>
            {/* The count describes the table: not the tree, and not a table that
                could not be read. */}
            {view === 'list' && !viewNone && (
              <span>{shown.length === 1 ? '1 rule' : `${shown.length} rules`}</span>
            )}
            <span className={styles.spacer} />
            <Menu label="Import" text="Import">
              {(close) => (
                <>
                  {entry('blocked', missing(permissions, 'Blocked.canModify'), () => setImporting('blocked'), close)}
                  {entry('allowed', missing(permissions, 'Allowed.canModify'), () => setImporting('allowed'), close)}
                </>
              )}
            </Menu>
            <Menu label="Export" text="Export">
              {(close) => (
                <>
                  {entry('blocked', missing(permissions, 'Blocked.canView'), () => void runExport('blocked'), close)}
                  {entry('allowed', missing(permissions, 'Allowed.canView'), () => void runExport('allowed'), close)}
                </>
              )}
            </Menu>
            <Menu label="Flush" text="Flush">
              {(close) => (
                <>
                  {entry('blocked', missing(permissions, 'Blocked.canDelete'), () => askFlush('blocked'), close)}
                  {entry('allowed', missing(permissions, 'Allowed.canDelete'), () => askFlush('allowed'), close)}
                </>
              )}
            </Menu>
          </div>
        </Panel>
      </div>

      {/* The action's promise goes back to `Confirm`, which keeps the dialog busy
          while it runs and closes it when it settles — as the lists screens do. */}
      <Confirm
        open={confirmation !== null}
        title={confirmation?.title ?? ''}
        text={confirmation?.text}
        label={confirmation?.label ?? ''}
        onClose={() => setConfirmation(null)}
        onConfirm={() => confirmation?.action()}
      />

      {importing != null && (
        <ImportDomains
          list={importing}
          open
          token={token}
          onClose={() => setImporting(null)}
          onDone={(n) => {
            setNotice(n)
            changed()
            void load()
          }}
        />
      )}
    </>
  )
}
