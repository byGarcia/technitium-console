import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  convertToDynamicLease,
  convertToReservedLease,
  listLeases,
  removeLease,
  type DhcpLease,
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
import { LEASE_TYPES, LeaseSummary } from './LeaseSummary'
import { leaseColour } from './lease-colours'
import { leaseKey, matchesSearch } from './pool'
import type { CSSProperties } from 'react'

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

The redesign mockup drops the type column (Dynamic/Reserved) and leaves only
"Remove" on each row. That would lose two real API actions, so upstream's three
and the type tag are kept.

Deviation 19 (2026-11-06): four cards over the table (`LeaseSummary.tsx`), and the
table in `ui/DataTable` with a toolbar upstream does not have: a search over the
IP address, MAC address and host name, and Scope and Type filters, which the cards
also set. They filter the list already loaded; nothing is asked of the server. A
lease's type is its series colour (`lease-colours.ts`) with the word beside it, and
Lease Expires says how far off it is under the date. The foot still reads
`Total Leases: N`, the whole list; while a filter hides rows the toolbar says how
many are shown. Words of ours: `Search`, the search field's placeholder,
`All` and `N of M shown`.

Rows are found by their scope and client identifier (`leaseKey`), not by their
position: the position in the sorted, filtered table is not the position in the
list, and acting on a sorted table must act on the row that was clicked.
*/

export interface LeasesProps {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  node?: string
  /** `DhcpServer.canModify`: the two conversions (`WebServiceDhcpApi.cs:805,835`). */
  canModify?: boolean
  /** `DhcpServer.canDelete`: removing a lease (`WebServiceDhcpApi.cs:761`). */
  canDelete?: boolean
}

/* `sortTable('tableDhcpLeasesBody', 0..6)`. */
const KEYS: Keys<DhcpLease> = {
  scope: (l) => l.scope,
  mac: (l) => l.hardwareAddress,
  address: (l) => l.address,
  type: (l) => l.type,
  host: (l) => l.hostName,
  obtained: (l) => minuteStamp(l.leaseObtained),
  expires: (l) => minuteStamp(l.leaseExpires),
}

export function Leases({ tabs, token, node = '', canModify = true, canDelete = true }: LeasesProps) {
  const [leases, setLeases] = useState<DhcpLease[] | null>(null)
  /*
  Whether the last load failed.

  The data is thrown away, as it was before (this screen does not keep the
  previous one), so there is nothing here to "go stale" and it does not carry the
  other collections' strip: inheriting the archetype's look is not inheriting
  behaviour it does not have.

  What does change is HOW the gap is drawn. It used to say "No Lease Found" when
  the call had fallen over, which is the same thing a server with no leases shows.
  Now the failure is said, with the message the server sent.
  */
  const [failure, setFailure] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ type: 'reserve' | 'dynamic'; key: string } | null>(null)
  const [discard, setDiscard] = useState<string | null>(null)
  /* The table's filters (deviation 19), and the clock the expiry figures read. */
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [scopeFilter, setScopeFilter] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [modalNotice, setModalNotice] = useState<Notice | null>(null)

  /*
  A failure on load is NOT drawn as an empty list.

  It used to say "No Lease Found" when the call had fallen over, which is the same
  thing a server with no leases shows: the screen was answering falsely and nobody
  suspects a response that looks normal. Now the failure is said, with the message
  the server sent.
  */
  const load = useCallback(async () => {
    setLeases(null)
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
  }, [token, node])

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
  const scopeNames = [...new Set((leases ?? []).map((l) => l.scope))]

  async function convert(key: string, type: 'reserve' | 'dynamic') {
    const lease = leases?.find((l) => leaseKey(l) === key)
    setConfirm(null)
    if (lease == null) return

    setBusy(true)
    const outcome =
      type === 'reserve'
        ? await convertToReservedLease(token, lease.scope, lease.clientIdentifier, node)
        : await convertToDynamicLease(token, lease.scope, lease.clientIdentifier, node)
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
    const outcome = await removeLease(token, lease.scope, lease.clientIdentifier, node)
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

  return (
    <div className={styles.wrap}>
      <SectionHeader
        title="DHCP"
        tabs={tabs}
        actions={<><Button lead="refresh" onClick={() => void load()}>Refresh</Button></>}
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {leases == null ? (
        <Loading />
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
                <span>{`${visibleLeases.length} of ${leases.length} shown`}</span>
              </End>
            )}
          </>
        }
        foot={<DataFoot count={`Total Leases: ${leases.length}`} />}
      >
      <Table
        stack
        header={
          <>
            <Th field="scope" sort={sort} onSort={toggle}>Scope</Th>
            <Th field="mac" sort={sort} onSort={toggle}>MAC Address</Th>
            <Th field="address" sort={sort} onSort={toggle}>IP Address</Th>
            <Th field="type" sort={sort} onSort={toggle} name="Type" />
            <Th field="host" sort={sort} onSort={toggle}>Host Name</Th>
            <Th field="obtained" sort={sort} onSort={toggle}>Lease Obtained</Th>
            <Th field="expires" sort={sort} onSort={toggle}>Lease Expires</Th>
            <th className={tbl.actionsCell} />
          </>
        }
        isEmpty={visibleLeases.length === 0}
        emptyText="No Lease Found"
        columns={8}
      >
        {visibleLeases.map((l) => {
          const key = leaseKey(l)
          return (
          <tr key={key}>
            <td className={styles.scopeCell}>{l.scope}</td>
            <td className={styles.mono}>{l.hardwareAddress}</td>
            <td className={`${styles.mono} ${tbl.lead}`}>{l.address}</td>
            <td>
              {/* The type in its series colour, the word beside it (deviation 19). */}
              <span className={styles.ltype} style={{ '--lt': leaseColour(l.type) } as CSSProperties}>
                {l.type}
              </span>
            </td>
            <td className={`${styles.mono} ${tbl.lead}`}>{l.hostName}</td>
            <td className={styles.date}>{minuteStamp(l.leaseObtained)}</td>
            <td className={styles.date}>
              {minuteStamp(l.leaseExpires)}
              <span className={styles.when}>{fromNow(l.leaseExpires, now)}</span>
            </td>
            <td className={tbl.actionsCell}>
              <div className={tbl.actions}>
                {/* dhcp.js:63-64. Which of the two conversions is offered
                    depends on the lease's current type. */}
                {canModify && (
                  <RowAction
                    icon="convert"
                    name={
                      l.type === 'Dynamic'
                        ? 'Convert To Reserved Lease'
                        : 'Convert To Dynamic Lease'
                    }
                    disabled={busy}
                    onClick={() =>
                      setConfirm({ type: l.type === 'Dynamic' ? 'reserve' : 'dynamic', key })
                    }
                  />
                )}
                {canDelete && (
                  <Menu label={`Actions for ${l.address}`}>
                    {(close) => (
                      <button
                        type="button"
                        data-variant="danger"
                        disabled={busy}
                        onClick={() => { close(); setModalNotice(null); setDiscard(key) }}
                      >
                        Remove Lease
                      </button>
                    )}
                  </Menu>
                )}
              </div>
            </td>
          </tr>
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
