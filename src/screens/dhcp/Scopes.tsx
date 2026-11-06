import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  deleteScope,
  disableScope,
  enableScope,
  getScope,
  listLeases,
  listScopes,
  setScope,
  type DhcpScope,
} from '../../api/dhcp'
import { Confirm } from '../../ui/Confirm'
import { Button } from '../../ui/Button'
import { SectionHeader } from '../../ui/SectionHeader'
import { errorNotice, type Notice } from './notices'
import { formFromScope, blankForm, type ScopeForm as Form } from './model'
import { Failure, Loading } from '../../ui/Empty'
import { Tag } from '../../ui/Tag'
import tbl from '../../ui/Table.module.css'
import styles from './Dhcp.module.css'
import { RowAction, Th, useSort, type Keys, Table } from '../../ui/Table'
import { Menu } from '../../ui/Menu'
import { noticeFromFailure } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { DataFoot, DataTable, End, Grow } from '../../ui/DataTable'
import { Field, Input, Select } from '../../ui/Field'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import { ScopeSummary } from './ScopeSummary'
import { ScopePage } from './ScopePage'
import { matchesScope, percent, scopeUsage, type ScopeUsage } from './pool'
import { Q, SCOPE, SCOPE_NODE, SCOPE_PARAMS, STATE, onDhcpTab, readTabParam, writeScope } from './dhcp-url'
import { scopeKey, scopesAcross, type NodeLease, type NodeScopeRow } from './across'
import type { DhcpCluster } from './Leases'
import { NodeName, NodesFailed, type NodeFailure } from '../../ui/AcrossNodes'
import { nodeColour } from '../dashboard/palette'

/*
DHCP › Scopes (dhcp.js:201-684).

Four asymmetries of upstream's that look like oversights and are not, and that
are replicated as they are:

  1. **Enabling a scope does NOT ask for confirmation; disabling it does**
     (dhcp.js:583 vs 615). Only the path that cuts the service asks.
  2. **Deleting does not reload the list either**: it removes the row and
     recalculates the footer (dhcp.js:662-668). Enable, disable and save do
     reload.
  3. **The form replaces the table**, it does not open in a modal.
  4. **The permission to delete a scope is `Delete`, not `Modify`**
     (`WebServiceDhcpApi.cs:761`), while enabling and disabling are `Modify`.
     Saving is `Modify`.

Deviation 19 (2026-11-06), laid out as Zones is:

  · The list: three cards (`ScopeSummary.tsx`), then ONE card that finds and shows
    (`ui/DataTable`): a Search over the name and the addresses and a State filter,
    which the All Scopes card also sets, both narrowing the list on screen; one
    line per scope (Name, Range, Subnet Mask, Interface, Leases, Status), its
    Network and Broadcast under the row's `Details`. The name opens the scope;
    `Edit Scope` and `Delete Scope` are in the row's menu, Enable or Disable beside
    it. The cards and the Leases column read `dhcp/leases/list` beside
    `scopes/list`, the one call the deviation adds; a failure of it touches nothing
    else on the tab.
  · A scope opens as a page (`ScopePage.tsx`): its header, four cards, its form.
  · The address bar keeps the search (`?q=`), the state (`?state=`) and the open
    scope (`?scope=`, pushed, so Back returns to the list; `dhcp-url.ts`).

Deviation 30 (2026-11-06): the Leases column is each enabled scope's usage
(`scopeUsage` in `pool.ts`): its leases, Dynamic and Reserved together, of the
addresses in its range, as `N of M`, the share and a bar, in the warning colour
above 80%, with the two types under it. A disabled scope has no bar; the column
sorts by the share. Its words, OURS: `N of M`, `X%` (`<1%`), `Dynamic N, Reserved
N`, and the bar's name `<scope>: N of the M addresses in its range leased, X%`.

Deviation 38 (2026-11-06; `across.ts`): on a cluster, `All nodes` reads every
node's scopes and leases and draws the scopes together with a Node column first;
the cards sum the nodes, each row's usage counts its own node's leases, a node that
did not answer is named, and a row's Enable, Disable, Edit Scope and Delete Scope
go to the row's node, as does the save of a scope opened from it (`?on=` in the
bar). Add Scope stays on the node chosen in the selector. Its words, OURS: `Node`,
and those of `ui/AcrossNodes`.
*/

export interface ScopesProps {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  node?: string
  /** `DhcpServer.canModify`: save, enable and disable. */
  canModify?: boolean
  /** `DhcpServer.canDelete`: deleting a scope. */
  canDelete?: boolean
  /** Told whether the node select must be locked: while an existing scope is
   *  being edited, as dhcp.js:479 disables it and 217 enables it again. */
  onLockNode?: (locked: boolean) => void
  /** A scope's page asks to see its leases: the Leases tab, narrowed to it. */
  onOpenLeases?: (scope: string) => void
  cluster?: DhcpCluster
}

/* `on` is the node the scope was opened on from the `All nodes` view (deviation
   38); `undefined` is the node the screen reads. */
type Page =
  | { mode: 'add'; form: Form }
  | { mode: 'edit'; name: string; on?: string; scope: DhcpScope; form: Form }

/* `sortTable('tableDhcpScopesBody', 0..3)`. It sorts by the cell's text. The
   Leases column (deviation 19) sorts by the share of the range leased (deviation
   30), padded so the text sort `useSort` does reads it as a number, a scope with
   no bar before any with one; the shares come from the leases, so the keys are
   built with them. */
function sortKeys(usage: Map<string, ScopeUsage | null>): Keys<NodeScopeRow> {
  const keys: Keys<NodeScopeRow> = {
    node: (s) => s.node ?? '',
    name: (s) => s.name,
    range: (s) => `${s.startingAddress} - ${s.endingAddress}`,
    mask: (s) => s.subnetMask,
    interface: (s) => s.interfaceAddress ?? '',
    leases: (s) => {
      const u = usage.get(scopeKey(s))
      return u == null ? '' : String(Math.round(u.share * 1e6)).padStart(12, '0')
    },
  }
  return keys
}

const STATES = ['Enabled', 'Disabled'] as const

export function Scopes({
  tabs,
  token,
  node = '',
  canModify = true,
  canDelete = true,
  onLockNode,
  onOpenLeases,
  cluster,
}: ScopesProps) {
  const [scopes, setScopes] = useState<NodeScopeRow[] | null>(null)
  /* The leases, for the cards and the Leases column; `null` when they could not
     be read (deviation 19). Their failure is not the list's: no notice. */
  const [leases, setLeases] = useState<NodeLease[] | null>(null)
  /* The `All nodes` view (deviation 38): the nodes that did not answer. */
  const across = cluster?.across === true
  const nodeKey = across ? cluster.nodes.map((n) => n.name).join('\n') : ''
  const [failed, setFailed] = useState<{ nodes: NodeFailure[]; answered: number } | null>(null)
  /* Whether the last load failed: said, with the server's message, and never
     drawn as "No Scope Found". */
  const [failure, setFailure] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState<Page | null>(null)
  const [query, setQuery] = useState(() => readTabParam('Scopes', Q) ?? '')
  const [stateFilter, setStateFilter] = useState(() => {
    const s = readTabParam('Scopes', STATE)
    return s === 'Enabled' || s === 'Disabled' ? s : ''
  })
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  /* The scope the bar asked for on arrival, opened once the list is in, on the
     node `?on=` names when it was opened from the `All nodes` view. */
  const arrival = useRef(readTabParam('Scopes', SCOPE))
  const arrivalNode = useRef(readTabParam('Scopes', SCOPE_NODE) ?? undefined)

  /* Only an existing scope locks the node: Add Scope leaves it alone. */
  const locked = page?.mode === 'edit'
  useEffect(() => {
    onLockNode?.(locked)
  }, [locked, onLockNode])
  useEffect(() => () => onLockNode?.(false), [onLockNode])
  const [confirm, setConfirm] = useState<{ action: 'disable' | 'delete'; name: string; on?: string } | null>(null)

  /* The list's view in the bar, and the open scope: the bar follows the page,
     replacing (it puts the scope back after StrictMode's rehearsal unmount took it
     out); what the user does is pushed by the handlers. */
  useEffect(() => {
    writeParams({ [Q]: query.trim() === '' ? null : query, [STATE]: stateFilter })
  }, [query, stateFilter])
  const openName = page?.mode === 'edit' ? page.name : null
  const openOn = page?.mode === 'edit' ? page.on : undefined
  useEffect(() => {
    if (onDhcpTab('Scopes') && arrival.current == null && (readParam(SCOPE) !== openName || (readParam(SCOPE_NODE) ?? undefined) !== openOn)) {
      writeScope(openName, true, openOn)
    }
  }, [openName, openOn])
  useEffect(() => () => dropParams(SCOPE_PARAMS), [])

  // A failure on load is not drawn as an empty list; see `Leases`. With a scope's
  // page open the list is read again quietly, so the page stays where it is.
  /* As in Leases: the All nodes view reads every node, so the selector reads nothing again. */
  const readNode = nodeKey !== '' ? '' : node
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setScopes(null)
      if (nodeKey !== '') {
        const all = await scopesAcross(token, nodeKey.split('\n').map((name) => ({ name, type: '' })))
        setFailed({ nodes: all.failed, answered: all.answered })
        setLeases(all.leases)
        setScopes(all.scopes)
        setFailure(all.answered === 0)
        return
      }
      setFailed(null)
      const [r, l] = await Promise.all([listScopes(token, readNode), listLeases(token, readNode)])
      setLeases(l.kind === 'ok' ? l.data : null)
      if (r.kind === 'ok') {
        setScopes(r.data)
        setFailure(false)
        return
      }
      setScopes([])
      setFailure(true)
      setNotice(noticeFromFailure(r))
    },
    [token, readNode, nodeKey],
  )

  /** Opens a scope's page: `push` from the list, `none` when the bar already says
   *  it. `on` is the row's node in the `All nodes` view (deviation 38). */
  const openScope = useCallback(
    async (name: string, how: 'push' | 'none', on?: string) => {
      setBusy(true)
      const s = await getScope(token, name, on ?? node)
      setBusy(false)
      if (s == null) {
        // A scope that cannot be read leaves the list on screen, and the bar with it.
        if (how === 'none' && onDhcpTab('Scopes')) writeScope(null, true)
        return
      }
      if (how === 'push') writeScope(name, false, on)
      setPage({ mode: 'edit', name, on, scope: s, form: formFromScope(s) })
    },
    [token, node],
  )

  useEffect(() => {
    void (async () => {
      await load()
      const want = arrival.current
      arrival.current = null
      const on = arrivalNode.current
      arrivalNode.current = undefined
      if (want != null) await openScope(want, 'none', on)
    })()
  }, [load, openScope])

  /* Back and Forward between the list and a scope. */
  useEffect(() => {
    function onChanged() {
      if (!onDhcpTab('Scopes')) return
      const want = readParam(SCOPE)
      if (want == null) {
        setPage(null)
        void load()
      } else void openScope(want, 'none', readParam(SCOPE_NODE) ?? undefined)
    }
    window.addEventListener('popstate', onChanged)
    return () => window.removeEventListener('popstate', onChanged)
  }, [load, openScope])

  // The hook goes BEFORE any return: otherwise it would stop being called as soon
  // as the table is loading.
  const usage = useMemo(
    () => new Map((scopes ?? []).map((s) => [scopeKey(s), leases == null ? null : scopeUsage(s, leases)])),
    [scopes, leases],
  )
  const { rows: sortedScopes, sort, toggle } = useSort(sortKeys(usage), scopes ?? [])
  const visibleScopes = sortedScopes.filter(
    (s) =>
      (stateFilter === '' || (stateFilter === 'Enabled') === s.enabled) && matchesScope(s, query),
  )
  const filtered = query.trim() !== '' || stateFilter !== ''

  /** Back to the list: upstream's Cancel, `refreshDhcpScopes()`, reads it again. */
  function backToList() {
    writeScope(null)
    setPage(null)
    void load()
  }

  async function save(body: Record<string, string>) {
    setBusy(true)
    const outcome = await setScope(token, body, (page?.mode === 'edit' ? page.on : undefined) ?? node)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(errorNotice(outcome))
      return
    }

    writeScope(null)
    setPage(null)
    await load()
    setNotice({
      type: 'success',
      title: 'Scope Saved!',
      text: 'DHCP Scope was saved successfully.',
    })
  }

  async function enable(name: string, on?: string) {
    setBusy(true)
    const outcome = await enableScope(token, name, on ?? node)
    setBusy(false)
    if (outcome.kind !== 'ok') return
    await load(page != null)
    setNotice({
      type: 'success',
      title: 'Scope Enabled!',
      text: 'DHCP Scope was enabled successfully.',
    })
  }

  async function disable(name: string, on?: string) {
    setConfirm(null)
    setBusy(true)
    const outcome = await disableScope(token, name, on ?? node)
    setBusy(false)
    if (outcome.kind !== 'ok') return
    await load(page != null)
    setNotice({
      type: 'success',
      title: 'Scope Disabled!',
      text: 'DHCP Scope was disabled successfully.',
    })
  }

  async function remove(name: string, on?: string) {
    setConfirm(null)
    setBusy(true)
    const outcome = await deleteScope(token, name, on ?? node)
    setBusy(false)
    if (outcome.kind !== 'ok') return
    // dhcp.js:662. It removes the row; it does not ask for the list again. From
    // the scope's own page, the list is where the deleted scope leaves you.
    if (page?.mode === 'edit' && page.name === name && page.on === on) {
      writeScope(null)
      setPage(null)
    }
    setScopes((prev) => prev?.filter((s) => !(s.name === name && s.node === on)) ?? prev)
    setNotice({
      type: 'success',
      title: 'Scope Deleted!',
      text: 'DHCP Scope was deleted successfully.',
    })
  }

  /** Enabling asks nothing; disabling does (dhcp.js:615). */
  function toggleState(s: NodeScopeRow) {
    if (s.enabled) setConfirm({ action: 'disable', name: s.name, on: s.node })
    else void enable(s.name, s.node)
  }

  function toggleOpen(name: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const confirmation = (
    <Confirm
      open={confirm !== null}
      title={confirm?.action === 'delete' ? 'Delete Scope' : 'Disable Scope'}
      text={
        confirm?.action === 'delete'
          ? `Are you sure you want to delete the DHCP scope '${confirm.name}'?`
          : `Are you sure you want to disable the DHCP scope '${confirm?.name ?? ''}'?`
      }
      label={confirm?.action === 'delete' ? 'Delete' : 'Disable'}
      busy={busy}
      onClose={() => setConfirm(null)}
      onConfirm={() => {
        if (!confirm) return
        if (confirm.action === 'delete') void remove(confirm.name, confirm.on)
        else void disable(confirm.name, confirm.on)
      }}
    />
  )

  if (page != null) {
    const row = page.mode === 'edit' ? scopes?.find((s) => s.name === page.name && s.node === page.on) : undefined
    /* The scope's own node's leases, in the `All nodes` view (deviation 38). */
    const own = page.mode === 'edit' && leases != null ? leases.filter((l) => l.node === page.on) : leases
    return (
      <div className={styles.wrap}>
        <Notifier notice={notice} onClose={() => setNotice(null)} />
        <ScopePage
          key={page.mode === 'edit' ? `edit:${page.name}` : 'add'}
          mode={page.mode}
          row={row}
          scope={page.mode === 'edit' ? page.scope : undefined}
          leases={own}
          initial={page.form}
          busy={busy}
          canModify={canModify}
          canDelete={canDelete}
          onBack={backToList}
          onSave={(body) => void save(body)}
          onCancel={backToList}
          onNotice={(e) => setNotice({ type: 'warning', title: e.title, text: e.text })}
          onToggle={() => row != null && toggleState(row)}
          onDelete={() => page.mode === 'edit' && setConfirm({ action: 'delete', name: page.name, on: page.on })}
          /* With its node in the All nodes view, so Leases narrows to this
             node's scope and not to every scope of the name. */
          onOpenLeases={() => page.mode === 'edit' && onOpenLeases?.(scopeKey({ name: page.name, node: page.on } as NodeScopeRow))}
        />
        {confirmation}
      </div>
    )
  }

  const colourOf = (name: string) =>
    nodeColour(cluster?.nodes ?? [], name)

  return (
    <div className={styles.wrap}>
      <SectionHeader
        section="DHCP"
        title="Scopes"
        tabs={tabs}
        actions={
          canModify ? (
            <Button
              variant="primary"
              lead="add"
              onClick={() => {
                setNotice(null)
                setPage({ mode: 'add', form: blankForm() })
              }}
            >
              Add Scope
            </Button>
          ) : undefined
        }
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {scopes == null ? (
        <Loading />
      ) : failure && failed != null ? (
        <>
          <NodesFailed failed={failed.nodes} answered={0} />
          <Failure>Could not load the list.</Failure>
        </>
      ) : failure ? (
        /* Solid, not dashed, and with no count: how many there are is not known.
           The server's message goes in the notice. */
        <Failure>Could not load the list.</Failure>
      ) : (
        <>
          <ScopeSummary scopes={scopes} leases={leases} state={stateFilter} onState={setStateFilter} />

          <DataTable
            toolbar={
              <>
                {cluster?.toggle}
                <Grow>
                  <Field inline label="Search">
                    {(id) => (
                      <Input
                        id={id}
                        search
                        placeholder="Scope name or IP address"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    )}
                  </Field>
                </Grow>
                <div className={styles.filterShort}>
                  <Field inline label="State">
                    {(id) => (
                      <Select id={id} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                        <option value="">All</option>
                        {STATES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                {filtered && (
                  <End>
                    <span className={styles.shown}>{`${visibleScopes.length} of ${scopes.length} shown`}</span>
                  </End>
                )}
              </>
            }
            foot={<DataFoot count={`Total Scopes: ${scopes.length}`} />}
          >
            {failed != null && <NodesFailed failed={failed.nodes} answered={failed.answered} />}
            <Table
              stack
              header={
                <>
                  {across && <Th field="node" sort={sort} onSort={toggle}>Node</Th>}
                  <Th field="name" sort={sort} onSort={toggle}>Name</Th>
                  <Th field="range" sort={sort} onSort={toggle}>Scope Range</Th>
                  <Th field="mask" sort={sort} onSort={toggle}>Subnet Mask</Th>
                  <Th field="interface" sort={sort} onSort={toggle}>Interface</Th>
                  <Th field="leases" sort={sort} onSort={toggle}>Leases</Th>
                  <th>Status</th>
                  <th className={tbl.actionsCell} />
                </>
              }
              isEmpty={visibleScopes.length === 0}
              emptyText="No Scope Found"
              columns={across ? 8 : 7}
            >
              {visibleScopes.map((s) => (
                <ScopeRow
                  key={scopeKey(s)}
                  scope={s}
                  usage={usage.get(scopeKey(s)) ?? null}
                  nodeColour={across && s.node != null ? colourOf(s.node) : undefined}
                  open={open.has(scopeKey(s))}
                  onToggle={() => toggleOpen(scopeKey(s))}
                  onOpen={() => void openScope(s.name, 'push', s.node)}
                  actions={
                    <>
                      {canModify && (
                        <RowAction
                          icon="power"
                          name={s.enabled ? 'Disable Scope' : 'Enable Scope'}
                          disabled={busy}
                          onClick={() => toggleState(s)}
                        />
                      )}
                      <Menu label={`Actions for ${s.name}`}>
                        {(close) => (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                close()
                                void openScope(s.name, 'push', s.node)
                              }}
                            >
                              Edit Scope
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                data-variant="danger"
                                disabled={busy}
                                onClick={() => {
                                  close()
                                  setConfirm({ action: 'delete', name: s.name, on: s.node })
                                }}
                              >
                                Delete Scope
                              </button>
                            )}
                          </>
                        )}
                      </Menu>
                    </>
                  }
                />
              ))}
            </Table>
          </DataTable>
        </>
      )}
      {confirmation}
    </div>
  )
}

/* A scope on ONE line; its network and broadcast under the row's Details. */
function ScopeRow({
  scope: s,
  usage: u,
  nodeColour,
  open,
  onToggle,
  onOpen,
  actions,
}: {
  scope: NodeScopeRow
  /** Its usage (deviation 30); `null` when the scope is disabled, its range is
   *  not IPv4, or the leases could not be read. */
  usage: ScopeUsage | null
  /** In the `All nodes` view, the colour of the row's node, drawn first. */
  nodeColour?: string
  open: boolean
  onToggle: () => void
  onOpen: () => void
  actions: ReactNode
}) {
  const detail = useId()
  return (
    <>
      <tr className={open ? styles.openRow : undefined}>
        {nodeColour != null && (
          <td className={styles.nodeCell}>
            <NodeName name={s.node ?? ''} colour={nodeColour} />
          </td>
        )}
        <td className={tbl.lead}>
          <button type="button" className={styles.opener} onClick={onOpen}>
            {s.name}
          </button>
        </td>
        <td className={styles.mono}>
          {s.startingAddress} - {s.endingAddress}
        </td>
        <td className={styles.mono}>{s.subnetMask}</td>
        {/* `interfaceAddress` is OMITTED when null; upstream draws an empty cell
            (dhcp.js:228). */}
        <td className={styles.mono}>{s.interfaceAddress ?? ''}</td>
        {/* Deviations 19 and 30: the leases this scope holds, of the addresses in
            its range, with the share and the two types. Empty for a disabled
            scope, and when the leases could not be read. */}
        <td>
          {u != null && (
            <div className={styles.use} data-high={u.high ? '' : undefined}>
              <span className={styles.useLine}>
                <span className={styles.useText}>
                  {u.leased} <span className={styles.useOf}>of {u.size}</span>
                </span>
                <span className={styles.usePct}>{percent(u.share)}</span>
              </span>
              <span
                className={styles.useTrack}
                role="img"
                aria-label={`${s.name}: ${u.leased} of the ${u.size} addresses in its range leased, ${percent(u.share)}`}
              >
                <span style={{ width: `${Math.min(100, u.share * 100)}%` }} />
              </span>
              <span className={styles.useSplit}>{`Dynamic ${u.dynamic}, Reserved ${u.reserved}`}</span>
            </div>
          )}
        </td>
        <td>
          <Tag tone={s.enabled ? 'ok' : 'neutral'}>{s.enabled ? 'Enabled' : 'Disabled'}</Tag>
        </td>
        <td className={tbl.actionsCell}>
          <div className={tbl.actions}>
            {actions}
            <RowAction
              icon={open ? 'chevronDown' : 'chevronRight'}
              name="Details"
              aria-expanded={open}
              aria-controls={detail}
              onClick={onToggle}
            />
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={styles.detailRow}>
          <td colSpan={nodeColour != null ? 8 : 7}>
            <dl className={styles.inline}>
              <div className={styles.pair}>
                <dt>Network</dt>
                <dd>{s.networkAddress}</dd>
              </div>
              <div className={styles.pair}>
                <dt>Broadcast</dt>
                <dd>{s.broadcastAddress}</dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}
