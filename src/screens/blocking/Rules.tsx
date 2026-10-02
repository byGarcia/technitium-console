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
import { Confirm } from '../../ui/Confirm'
import { Notifier } from '../../ui/Notifier'
import { Input } from '../../ui/Field'
import { Icon } from '../../ui/Icon'
import { Failure, Loading } from '../../ui/Empty'
import { Button } from '../../ui/Button'
import { primaryNodeName } from '../../ui/ClusterNodeSelect'
import { pageWindow } from '../../lib/pagination'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { StaleData } from '../StaleData'
import { Lists, ImportDomains, type Confirmation } from '../lists/Lists'
import { LockedBody, LockedItem } from './Locked'
import { AddDomainBar } from './AddDomainBar'
import { missing, type Need, type Permissions } from './permissions'
import {
  countRules, filterRules, mergeRules, pageOf, readRuleParam, ruleSearch,
  type Rule, type RuleFilter,
} from './rules-model'
import shared from './Blocking.module.css'
import styles from './Rules.module.css'

/*
The Rules tab: the administrator's own blocked and allowed domains in one flat table,
as Pi-hole's Domains page draws them. The table is OURS —and so are its words:
the title `Rules`; the filter `All` and the counts beside each filter; `Rule` (column
and the filter group's label); the `Domain` column; `Filter domains`, `No rules`,
`No rules match this filter`, `1 rule` / `N rules`; `View`, `List` / `Tree` and the
`Tree` selector's label; `Browse domain`; the `Delete <domain>` labels; the menu
entries `Blocked zones` / `Allowed zones`; `Could not read the rules.` and its
`Retry`; and the titles of the Delete and Flush confirmations, which upstream asks
with a bare `confirm()`—. The names `Blocked` and
`Allowed` are upstream's tabs, and every verb is upstream's, with its sentences
(other-zones.js). The three verbs of the
foot do NOT behave alike, so they are not made alike: Import opens its dialog,
Export downloads at once with a single-use token, Flush asks first.

`Tree` mounts the tree that exists today, so nothing upstream has is lost. It
reports through this page's notifier, and every change —from the table, the foot,
the add bar or the tree itself— reads the table again from the primary node and
remounts the tree from there. A Block or Allow opens the tree at the added domain,
as upstream's blockZone/allowZone do; because this one bar serves both lists, the
tree also turns to the list the domain went into (ours: upstream's verbs live on
two separate pages, each with its own tree).
*/

const LABEL: Record<DomainList, string> = { blocked: 'Blocked', allowed: 'Allowed' }

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
  /* Bumped after Block, Allow, Delete, Import and Flush: the open tree is mounted
     again so it reads the lists as they are now — from the primary node, as every
     read after a change does (spec, the section on the cluster, «Clúster»). Choosing
     another list or view is a fresh read again, from the connected node. */
  const [generation, setGeneration] = useState(0)
  const [afterChange, setAfterChange] = useState(false)
  /* Where the remounted tree opens: the domain a Block or Allow just added, as
     upstream's blockZone/allowZone open it (other-zones.js:350, 185); the root after
     anything else. */
  const [treeDomain, setTreeDomain] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [importing, setImporting] = useState<DomainList | null>(null)
  const [busy, setBusy] = useState(false)

  /*
  The primary node, read through a ref for the reason Lists.tsx gives: as a
  dependency of `load`, the `nodes = []` default is a new array on every render.
  `asked` numbers the reads, as Overview does, so an older export that answers last
  cannot land over a newer one.
  */
  const primary = useRef('')
  useEffect(() => {
    primary.current = primaryNodeName(nodes, clusterInitialised)
  }, [nodes, clusterInitialised])
  const asked = useRef(0)

  /* Only the lists the session may view are read: the export of the other one
     would be refused by the server. The first read asks the connected node; after a
     change, the PRIMARY, where the change was made (other-zones.js:269, 434): a
     secondary still answers the old list until the cluster syncs. */
  const load = useCallback(async (fromPrimary = false) => {
    const node = fromPrimary ? primary.current : ''
    const mine = ++asked.current
    const read = (list: DomainList, may: boolean) => (may ? readRuleExport(list, token, node) : null)
    const [b, a] = await Promise.all([read('blocked', viewBlocked), read('allowed', viewAllowed)])
    if (mine !== asked.current) return
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

  /** A change was made: the open tree is mounted again, from the primary, at
   *  `domain` when there is one to show. */
  function changed(domain = '') {
    setGeneration((g) => g + 1)
    setAfterChange(true)
    setTreeDomain(domain)
  }

  /* A Block or Allow from the add bar. With the tree open it turns to the list the
     domain went into, when the session may view it, and opens at the domain. */
  function added(list: DomainList, domain: string) {
    if (list === 'blocked' ? viewBlocked : viewAllowed) setTreeList(list)
    changed(domain)
    void load(true)
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
    await load(true)
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
     which one is missing (`LockedItem`). */
  function entry(list: DomainList, need: Need | undefined, run: () => void, close: () => void) {
    if (need != null) {
      return (
        <LockedItem key={list} need={need} placement="left">
          {LABEL[list]} zones
        </LockedItem>
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
          onChanged={added}
        />

        {stale && <StaleData since={lastGood} onRetry={() => void load()} />}

        <Panel className={shared.flush}>
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
                  setTreeDomain('')
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
                setTreeDomain('')
                /* No read on coming back to the list: the tree says when it deleted
                   (`onChanged`) and the table was read again then, from the primary.
                   Reading the connected node here would bring back, on a secondary,
                   the row just deleted. */
              }}
            />
          </div>

          {view === 'tree' ? (
            treeNeed != null ? (
              <Body>
                <LockedBody need={treeNeed} />
              </Body>
            ) : (
              /* Inset like the rest of the panel's content: the tree and the node detail
                 are framed boxes of their own, and flush they doubled the panel's edge. */
              <div className={styles.tree}>
                <Lists
                  key={`${treeList}:${generation}`}
                  list={treeList}
                  token={token}
                  nodes={nodes}
                  clusterInitialised={clusterInitialised}
                  embedded
                  initialFromPrimary={afterChange}
                  initialDomain={treeDomain}
                  fieldName="Browse domain"
                  canDelete={missing(permissions, treeList === 'allowed' ? 'Allowed.canDelete' : 'Blocked.canDelete') == null}
                  onNotice={setNotice}
                  onChanged={() => void load(true)}
                />
              </div>
            )
          ) : viewNone ? (
            <Body>
              <LockedBody need="Blocked.canView" />
              <LockedBody need="Allowed.canView" />
            </Body>
          ) : rules == null ? (
            failed ? (
              /* The notice at the top carries the server's message; once it is
                 dismissed, the slot still says what happened and offers to read
                 again, as the blocking state does (StatusPanel). */
              <Body>
                <Failure>
                  Could not read the rules.{' '}
                  <Button
                    size="sm"
                    onClick={() => {
                      setFailed(false)
                      void load()
                    }}
                  >
                    Retry
                  </Button>
                </Failure>
              </Body>
            ) : (
              <Loading />
            )
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
                className={shared.inPanel}
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
            void load(true)
          }}
        />
      )}
    </>
  )
}
