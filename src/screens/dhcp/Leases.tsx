import { useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import {
  convertToDynamicLease,
  convertToReservedLease,
  listLeases,
  removeLease,
} from '../../api/dhcp'
import { Confirm } from '../../ui/Confirm'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { SectionHeader } from '../../ui/SectionHeader'
import { minuteStamp } from './dates'
import type { Notice } from './notices'
import { Failure, Loading } from '../../ui/Empty'
import tbl from '../../ui/Table.module.css'
import styles from './Dhcp.module.css'
import { RowAction, Th, useSort, type Keys, Table } from '../../ui/Table'
import { Menu } from '../../ui/Menu'
import { noticeFromFailure } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { DataFoot, DataTable, End, Grow } from '../../ui/DataTable'
import { Field, Input, Select } from '../../ui/Field'
import { Warning } from '../../ui/PanelForm'
import { fromNow } from '../../lib/dates'
import { writeParams, dropParams } from '../../lib/url-state'
import { LEASE_TYPES, LeaseSummary } from './LeaseSummary'
import { leaseColour } from './lease-colours'
import { leaseKey, matchesSearch } from './pool'
import { LEASE_PARAMS, Q, SCOPE, TYPE, readTabParam } from './dhcp-url'
import { leasesAcross, type NodeLease } from './across'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import { NodeName, NodesFailed, type NodeFailure } from '../../ui/AcrossNodes'
import { nodeToken } from '../dashboard/palette'

/*
DHCP › Leases (dhcp.js:37-199).

Three upstream details that are not visible in the mockup and that are kept here:

  1. **The table does NOT reload after an action.** Converting a lease changes
     that row's type tag and the two options in its menu; removing it deletes the
     row and recalculates the footer. In no case is the list asked for again.
  2. **The "Remove Lease" alert comes out INSIDE the modal when it fails** and on
     the screen when it succeeds: upstream passes `showAlert` the modal's own
     `divDhcpRemoveLeaseAlert` only in the error branch.
  3. **The two conversions are confirmed with a `confirm()`** and the delete with
     a whole modal of warnings. They are not the same class of action.

Deviation 19 (2026-11-06), laid out as Cache is: the header, four cards
(`LeaseSummary.tsx`), then ONE card that both finds and shows (`ui/DataTable`).
Its toolbar has what upstream does not: a search over the IP address, MAC address
and host name, and Scope and Type filters, which the cards also set; they filter
the list already loaded and ask the server nothing. Each lease is ONE line, the
IP Address first (what identifies it), then Host Name, MAC Address, Type, Scope and
Lease Expires with how far off it is; the Client Identifier (which upstream never
shows, only sends) and both dates with their distance are under the row's
`Details`. Lease Obtained left the line, so the table no longer sorts by it; the
Newest Lease card says which came last. The search, the scope and the type are
in the address bar (`dhcp-url.ts`). Words of ours: `Search`, the search field's
placeholder, `All`, `N of M shown`, `Details` and `Client Identifier`.

Rows are found by their scope and client identifier (`leaseKey`), not by their
position: the position in the sorted, filtered table is not the position in the
list, and acting on a sorted table must act on the row that was clicked.

Deviation 38 (2026-11-06; `across.ts`): on a cluster, `All nodes` reads every
node's leases and draws them together with a Node column first; the cards sum
them, a node that did not answer is named, and a row's conversions and Remove
Lease go to the row's node. Its words, OURS: `Node`, and those of `ui/AcrossNodes`.
*/

/** The section's `This node` / `All nodes` choice (deviation 38), on a cluster only. */
export interface DhcpCluster {
  nodes: ClusterNode[]
  across: boolean
  /** The toggle, drawn first in the toolbar. */
  toggle: ReactNode
}

export interface LeasesProps {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  node?: string
  /** `DhcpServer.canModify`: the two conversions (`WebServiceDhcpApi.cs:805,835`). */
  canModify?: boolean
  /** `DhcpServer.canDelete`: removing a lease (`WebServiceDhcpApi.cs:761`). */
  canDelete?: boolean
  /** The filter a scope's page asked for on its way here; it wins over the bar. */
  seed?: { scope: string; type: string } | null
  cluster?: DhcpCluster
}

/* `sortTable('tableDhcpLeasesBody', 0..6)`, less Lease Obtained, which is in the
   row's details now. */
const KEYS: Keys<NodeLease> = {
  node: (l) => l.node ?? '',
  scope: (l) => l.scope,
  mac: (l) => l.hardwareAddress,
  address: (l) => l.address,
  type: (l) => l.type,
  host: (l) => l.hostName,
  expires: (l) => minuteStamp(l.leaseExpires),
}

/** A type from the bar, only when it is one the server writes. */
function knownType(t: string | null): string {
  return t != null && (LEASE_TYPES as readonly string[]).includes(t) ? t : ''
}

export function Leases({
  tabs,
  token,
  node = '',
  canModify = true,
  canDelete = true,
  seed = null,
  cluster,
}: LeasesProps) {
  const [leases, setLeases] = useState<NodeLease[] | null>(null)
  /* The `All nodes` view (deviation 38): the nodes that did not answer. */
  const across = cluster?.across === true
  const [failed, setFailed] = useState<{ nodes: NodeFailure[]; answered: number } | null>(null)
  const nodeKey = across ? cluster.nodes.map((n) => n.name).join('\n') : ''
  /*
  Whether the last load failed. It used to say "No Lease Found" when the call had
  fallen over, which is the same thing a server with no leases shows. Now the
  failure is said, with the message the server sent.
  */
  const [failure, setFailure] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ type: 'reserve' | 'dynamic'; key: string } | null>(null)
  const [discard, setDiscard] = useState<string | null>(null)
  /* The table's filters (deviation 19), from the bar or from a scope's page, and
     the clock the expiry figures read. */
  const [query, setQuery] = useState(() => (seed != null ? '' : (readTabParam('Leases', Q) ?? '')))
  const [typeFilter, setTypeFilter] = useState(() =>
    knownType(seed != null ? seed.type : readTabParam('Leases', TYPE)),
  )
  const [scopeFilter, setScopeFilter] = useState(() =>
    seed != null ? seed.scope : (readTabParam('Leases', SCOPE) ?? ''),
  )
  const [now, setNow] = useState(() => Date.now())
  const [modalNotice, setModalNotice] = useState<Notice | null>(null)
  /* The leases whose Details are open, by `leaseKey`. */
  const [open, setOpen] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    writeParams({ [Q]: query.trim() === '' ? null : query, [SCOPE]: scopeFilter, [TYPE]: typeFilter })
  }, [query, scopeFilter, typeFilter])
  useEffect(() => () => dropParams(LEASE_PARAMS), [])

  const load = useCallback(async () => {
    setLeases(null)
    if (nodeKey !== '') {
      const all = await leasesAcross(token, nodeKey.split('\n').map((name) => ({ name, type: '' })))
      setNow(Date.now())
      setFailed({ nodes: all.failed, answered: all.answered })
      setLeases(all.leases)
      setFailure(all.answered === 0)
      return
    }
    setFailed(null)
    const r = await listLeases(token, node)
    if (r.kind === 'ok') {
      setNow(Date.now())
      setLeases(r.data)
      setFailure(false)
      return
    }
    setLeases([])
    setFailure(true)
    setNotice(noticeFromFailure(r))
  }, [token, node, nodeKey])

  useEffect(() => {
    void load()
  }, [load])

  // The hook goes BEFORE any return: otherwise it would stop being called as soon
  // as the table is loading.
  const { rows: sortedLeases, sort, toggle } = useSort(KEYS, leases ?? [])
  const visibleLeases = sortedLeases.filter(
    (l) =>
      (typeFilter === '' || l.type === typeFilter) &&
      (scopeFilter === '' || l.scope === scopeFilter) &&
      matchesSearch(l, query),
  )
  const filtered = query.trim() !== '' || typeFilter !== '' || scopeFilter !== ''
  /* The scopes the list names, and the one in the filter even when no lease
     carries it any more (a link or a scope's page), so the field says what
     narrows the table. */
  const scopeNames = [...new Set([...(leases ?? []).map((l) => l.scope), ...(scopeFilter ? [scopeFilter] : [])])]

  function toggleOpen(key: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function convert(key: string, type: 'reserve' | 'dynamic') {
    const lease = leases?.find((l) => leaseKey(l) === key)
    setConfirm(null)
    if (lease == null) return

    setBusy(true)
    /* The row's node in the `All nodes` view (deviation 38). */
    const on = lease.node ?? node
    const outcome =
      type === 'reserve'
        ? await convertToReservedLease(token, lease.scope, lease.clientIdentifier, on)
        : await convertToDynamicLease(token, lease.scope, lease.clientIdentifier, on)
    setBusy(false)

    if (outcome.kind !== 'ok') return

    // dhcp.js:104-109. Only the row's tag changes; nothing is reloaded.
    const blank = type === 'reserve' ? 'Reserved' : 'Dynamic'
    setLeases((prev) => prev?.map((l) => (leaseKey(l) === key ? { ...l, type: blank } : l)) ?? prev)
    setNotice(
      type === 'reserve'
        ? {
            type: 'success',
            title: 'Reserved!',
            text: 'The dynamic lease was converted to reserved lease successfully.',
          }
        : {
            type: 'success',
            title: 'Unreserved!',
            text: 'The reserved lease was converted to dynamic lease successfully.',
          },
    )
  }

  async function discardLease() {
    const key = discard
    const lease = key == null ? null : leases?.find((l) => leaseKey(l) === key)
    if (key == null || lease == null) return

    setBusy(true)
    const outcome = await removeLease(token, lease.scope, lease.clientIdentifier, lease.node ?? node)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setModalNotice(noticeFromFailure(outcome))
      return
    }

    setLeases((prev) => prev?.filter((l) => leaseKey(l) !== key) ?? prev)
    setDiscard(null)
    setNotice({
      type: 'success',
      title: 'Lease Removed!',
      text: 'The DHCP lease was removed successfully.',
    })
  }

  const colourOf = (name: string) =>
    `var(${nodeToken(Math.max(0, (cluster?.nodes ?? []).findIndex((n) => n.name === name)))})`

  return (
    <div className={styles.wrap}>
      {/* The section as the header, Refresh beside the title as Cache has it. */}
      <SectionHeader
        section="DHCP"
        title="Leases"
        tabs={tabs}
        titleAction={
          <RowAction icon="refresh" name="Refresh" disabled={leases == null} onClick={() => void load()} />
        }
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {leases == null ? (
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
          <LeaseSummary
            leases={leases}
            now={now}
            type={typeFilter}
            scope={scopeFilter}
            onType={setTypeFilter}
            onScope={setScopeFilter}
          />

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
                        placeholder="IP address, MAC address or host name"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    )}
                  </Field>
                </Grow>
                <div className={styles.filter}>
                  <Field inline label="Scope">
                    {(id) => (
                      <Select id={id} value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
                        <option value="">All</option>
                        {scopeNames.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <div className={styles.filterShort}>
                  <Field inline label="Type">
                    {(id) => (
                      <Select id={id} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="">All</option>
                        {LEASE_TYPES.map((t) => (
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
                    <span className={styles.shown}>{`${visibleLeases.length} of ${leases.length} shown`}</span>
                  </End>
                )}
              </>
            }
            foot={<DataFoot count={`Total Leases: ${leases.length}`} />}
          >
            {failed != null && <NodesFailed failed={failed.nodes} answered={failed.answered} />}
            <Table
              stack
              header={
                <>
                  {across && <Th field="node" sort={sort} onSort={toggle}>Node</Th>}
                  <Th field="address" sort={sort} onSort={toggle}>IP Address</Th>
                  <Th field="host" sort={sort} onSort={toggle}>Host Name</Th>
                  <Th field="mac" sort={sort} onSort={toggle}>MAC Address</Th>
                  <Th field="type" sort={sort} onSort={toggle} name="Type" />
                  <Th field="scope" sort={sort} onSort={toggle}>Scope</Th>
                  <Th field="expires" sort={sort} onSort={toggle}>Lease Expires</Th>
                  <th className={tbl.actionsCell} />
                </>
              }
              isEmpty={visibleLeases.length === 0}
              emptyText="No Lease Found"
              columns={across ? 8 : 7}
            >
              {visibleLeases.map((l) => {
                const key = leaseKey(l)
                return (
                  <LeaseRow
                    key={key}
                    lease={l}
                    now={now}
                    nodeColour={across && l.node != null ? colourOf(l.node) : undefined}
                    open={open.has(key)}
                    onToggle={() => toggleOpen(key)}
                    actions={
                      <>
                        {/* dhcp.js:63-64. Which of the two conversions is offered
                            depends on the lease's current type. */}
                        {canModify && (
                          <RowAction
                            icon="convert"
                            name={l.type === 'Dynamic' ? 'Convert To Reserved Lease' : 'Convert To Dynamic Lease'}
                            disabled={busy}
                            onClick={() => setConfirm({ type: l.type === 'Dynamic' ? 'reserve' : 'dynamic', key })}
                          />
                        )}
                        {canDelete && (
                          <Menu label={`Actions for ${l.address}`}>
                            {(close) => (
                              <button
                                type="button"
                                data-variant="danger"
                                disabled={busy}
                                onClick={() => {
                                  close()
                                  setModalNotice(null)
                                  setDiscard(key)
                                }}
                              >
                                Remove Lease
                              </button>
                            )}
                          </Menu>
                        )}
                      </>
                    }
                  />
                )
              })}
            </Table>
          </DataTable>
        </>
      )}
      <Confirm
        open={confirm !== null}
        title={confirm?.type === 'dynamic' ? 'Convert To Dynamic Lease' : 'Convert To Reserved Lease'}
        text={
          confirm?.type === 'dynamic'
            ? 'Are you sure you want to convert the reserved lease to dynamic lease?'
            : 'Are you sure you want to convert the dynamic lease to reserved lease?'
        }
        label="Convert"
        variant="primary"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void convert(confirm.key, confirm.type)}
      />

      {/* index.html:6587-6617. The complete "Remove Lease?" modal, with its two
          warnings, its recommendation and its list of alternatives. */}
      <Dialog
        open={discard !== null}
        onOpenChange={(o) => !o && setDiscard(null)}
        title="Remove Lease?"
        actions={
          <>
            <Button variant="danger" lead="trash" disabled={busy} onClick={() => void discardLease()}>
              Remove
            </Button>
          </>
        }
      >
        <Notifier notice={modalNotice} onClose={() => setModalNotice(null)} />
        {/* The two `Warning!` paragraphs as the console's warning blocks, the same
            words; the rest of upstream's text follows as prose (deviation 19). */}
        <div className={styles.warnings}>
          <Warning>
            Removing a DHCP lease from the server side will NOT remove the allocated IP address from
            the client side. Make sure that the client assigned this lease is not connected to the
            network before proceeding.
          </Warning>
          <Warning>
            Removing a DHCP lease may cause IP address conflict if the DHCP server assigns the same IP
            address to a new client while the old client is still connected to the network.
          </Warning>
        </div>
        <p className={styles.paragraph}>
          It is not recommended to remove a DHCP lease when the client is still connected or may
          connect back later to the network before the lease expires. Use this option only as a last
          resort.
        </p>
        <p className={styles.paragraph}>
          Follow the recommendations below to avoid such a case that requires removing a DHCP lease:
        </p>
        <ul className={styles.list}>
          <li>
            Use a shorter lease time such that a dynamically allocated lease expires quickly when the
            client exits the network.
          </li>
          <li>
            Use Exclusions to exclude IP address ranges from being dynamically allocated that you
            plan to assign manually to some of the devices on the network.
          </li>
          <li>
            Use Exclusions to make sure that you have unallocated addresses available in the DHCP
            scope to be assigned as reserved leases in future.
          </li>
          <li>
            Rely less on the assigned IP addresses by configuring a domain name for the DHCP scope
            and accessing all the devices using their domain names.
          </li>
        </ul>
        <p className={styles.paragraph}>Are you sure you want to remove the DHCP lease now?</p>
      </Dialog>
    </div>
  )
}

/** A lease type: the dot of its series colour (`lease-colours.ts`) and the word. */
export function LeaseType({ type }: { type: string }) {
  return (
    <span className={styles.ltype} style={{ '--lt': leaseColour(type) } as CSSProperties}>
      {type}
    </span>
  )
}

/*
A lease on ONE line, its details folded, as Cache draws a record. The line says
which lease it is and how long it has; the Client Identifier and both dates with
their distance are one press away, in the row's Details.
*/
function LeaseRow({
  lease: l,
  now,
  nodeColour,
  open,
  onToggle,
  actions,
}: {
  lease: NodeLease
  now: number
  /** In the `All nodes` view, the colour of the row's node, drawn first. */
  nodeColour?: string
  open: boolean
  onToggle: () => void
  actions: ReactNode
}) {
  const detail = useId()
  return (
    <>
      <tr className={open ? styles.openRow : undefined}>
        {nodeColour != null && (
          <td className={styles.nodeCell}>
            <NodeName name={l.node ?? ''} colour={nodeColour} />
          </td>
        )}
        <td className={`${styles.mono} ${styles.address} ${tbl.lead}`}>{l.address}</td>
        <td className={styles.mono}>{l.hostName}</td>
        <td className={styles.mono}>{l.hardwareAddress}</td>
        <td>
          <LeaseType type={l.type} />
        </td>
        <td className={styles.scopeCell}>{l.scope}</td>
        <td className={styles.date}>
          {minuteStamp(l.leaseExpires)} <small className={styles.when}>({fromNow(l.leaseExpires, now)})</small>
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
                <dt>Client Identifier</dt>
                <dd>{l.clientIdentifier}</dd>
              </div>
              <div className={styles.pair}>
                <dt>Lease Obtained</dt>
                <dd>
                  {minuteStamp(l.leaseObtained)} <small className={styles.when}>({fromNow(l.leaseObtained, now)})</small>
                </dd>
              </div>
              <div className={styles.pair}>
                <dt>Lease Expires</dt>
                <dd>
                  {minuteStamp(l.leaseExpires)} <small className={styles.when}>({fromNow(l.leaseExpires, now)})</small>
                </dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}
