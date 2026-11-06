import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  deleteScope,
  disableScope,
  enableScope,
  getScope,
  listLeases,
  listScopes,
  setScope,
  type DhcpLease,
  type DhcpScopeRow,
} from '../../api/dhcp'
import { Confirm } from '../../ui/Confirm'
import { Button } from '../../ui/Button'
import { SectionHeader } from '../../ui/SectionHeader'
import { errorNotice, type Notice } from './notices'
import { formFromScope, blankForm, type ScopeForm as Form } from './model'
import { ScopeForm } from './ScopeForm'
import { Failure, Loading } from '../../ui/Empty'
import { Tag } from '../../ui/Tag'
import tbl from '../../ui/Table.module.css'
import styles from './Dhcp.module.css'
import { RowAction, Th, useSort, type Keys, Table } from '../../ui/Table'
import { Menu } from '../../ui/Menu'
import { noticeFromFailure } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { DataFoot, DataTable } from '../../ui/DataTable'
import { ScopeSummary } from './ScopeSummary'
import { leasesPerScope, rangeSize } from './pool'

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

Deviation 19 (2026-11-06): three cards over the table (`ScopeSummary.tsx`), the
table and its count as one card (`ui/DataTable`), and a Leases column, each scope's
leases of the addresses in its range. They read `dhcp/leases/list` beside
`scopes/list`, the one call the deviation adds here; a failure of it touches
nothing else on the tab.
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
}

type Editing = { title: 'Add Scope' | 'Edit Scope'; form: Form }

/* `sortTable('tableDhcpScopesBody', 0..3)`. It sorts by the cell's text, which
   in the two composite columns is their two label/value pairs. The Leases column
   (deviation 19) sorts by count, padded so the text sort `useSort` does reads it
   as a number; the counts come from the leases, so the keys are built with them. */
function sortKeys(per: Map<string, number>): Keys<DhcpScopeRow> {
  const keys: Keys<DhcpScopeRow> = {
    name: (s) => s.name,
    range: (s) => `Range ${s.startingAddress} - ${s.endingAddress} Mask ${s.subnetMask}`,
    network: (s) => `Network ${s.networkAddress} Broadcast ${s.broadcastAddress}`,
    interface: (s) => s.interfaceAddress ?? '',
    leases: (s) => String(per.get(s.name) ?? 0).padStart(10, '0'),
  }
  return keys
}

export function Scopes({
  tabs,
  token,
  node = '',
  canModify = true,
  canDelete = true,
  onLockNode,
}: ScopesProps) {
  const [scopes, setScopes] = useState<DhcpScopeRow[] | null>(null)
  /* The leases, for the cards and the Leases column; `null` when they could not
     be read (deviation 19). Their failure is not the list's: no notice. */
  const [leases, setLeases] = useState<DhcpLease[] | null>(null)
  /*
  Whether the last load failed.

  The data is thrown away, as it was before (this screen does not keep the
  previous one), so there is nothing here to "go stale" and it does not carry the
  other collections' strip: inheriting the archetype's look is not inheriting
  behaviour it does not have.

  What does change is HOW the gap is drawn. It used to say "No Scope Found" when
  the call had fallen over, which is the same thing a server with no scopes shows.
  Now the failure is said, with the message the server sent.
  */
  const [failure, setFailure] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)
  /* Only an existing scope locks the node: Add Scope leaves it alone. */
  const locked = editing?.title === 'Edit Scope'
  useEffect(() => {
    onLockNode?.(locked)
  }, [locked, onLockNode])
  useEffect(() => () => onLockNode?.(false), [onLockNode])
  const [confirm, setConfirm] = useState<{ action: 'disable' | 'delete'; name: string } | null>(
    null,
  )

  // A failure on load is not drawn as an empty list; see `Leases`.
  const load = useCallback(async () => {
    setScopes(null)
    const [r, l] = await Promise.all([listScopes(token, node), listLeases(token, node)])
    setLeases(l.kind === 'ok' ? l.data : null)
    if (r.kind === 'ok') {
      setScopes(r.data)
      setFailure(false)
      return
    }
    setScopes([])
    setFailure(true)
    setNotice(noticeFromFailure(r))
  }, [token, node])

  useEffect(() => {
    void load()
  }, [load])

  // The hook goes BEFORE any return: otherwise it would stop being called as soon
  // as the table is loading.
  const per = leasesPerScope(leases ?? [])
  const { rows: visibleScopes, sort, toggle } = useSort(sortKeys(per), scopes ?? [])

  async function edit(name: string) {
    setBusy(true)
    const s = await getScope(token, name, node)
    setBusy(false)
    if (s == null) return
    setEditing({ title: 'Edit Scope', form: formFromScope(s) })
  }

  async function save(body: Record<string, string>) {
    setBusy(true)
    const outcome = await setScope(token, body, node)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(errorNotice(outcome))
      return
    }

    setEditing(null)
    await load()
    setNotice({
      type: 'success',
      title: 'Scope Saved!',
      text: 'DHCP Scope was saved successfully.',
    })
  }

  async function enable(name: string) {
    setBusy(true)
    const outcome = await enableScope(token, name, node)
    setBusy(false)
    if (outcome.kind !== 'ok') return
    await load()
    setNotice({
      type: 'success',
      title: 'Scope Enabled!',
      text: 'DHCP Scope was enabled successfully.',
    })
  }

  async function disable(name: string) {
    setConfirm(null)
    setBusy(true)
    const outcome = await disableScope(token, name, node)
    setBusy(false)
    if (outcome.kind !== 'ok') return
    await load()
    setNotice({
      type: 'success',
      title: 'Scope Disabled!',
      text: 'DHCP Scope was disabled successfully.',
    })
  }

  async function remove(name: string) {
    setConfirm(null)
    setBusy(true)
    const outcome = await deleteScope(token, name, node)
    setBusy(false)
    if (outcome.kind !== 'ok') return
    // dhcp.js:662. It removes the row; it does not ask for the list again.
    setScopes((prev) => prev?.filter((s) => s.name !== name) ?? prev)
    setNotice({
      type: 'success',
      title: 'Scope Deleted!',
      text: 'DHCP Scope was deleted successfully.',
    })
  }

  if (editing != null) {
    return (
      <div className={styles.wrap}>
        <Notifier notice={notice} onClose={() => setNotice(null)} />
        <ScopeForm
          key={editing.title + editing.form.oldName}
          title={editing.title}
          initial={editing.form}
          busy={busy}
          onSave={(body) => void save(body)}
          onCancel={() => {
            setEditing(null)
            void load()
          }}
          onNotice={(e) => setNotice({ type: 'warning', title: e.title, text: e.text })}
        />
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <SectionHeader
        title="DHCP"
        tabs={tabs}
        actions={<>{canModify && (
            <Button
              variant="primary"
              lead="add"
              onClick={() => {
                setNotice(null)
                setEditing({ title: 'Add Scope', form: blankForm() })
              }}
            >
              Add Scope
            </Button>
          )}</>}
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {scopes == null ? (
        <Loading />
      ) : failure ? (
        /* Solid, not dashed, and with no count: how many there are is not known.
           The server's message goes in the notice. */
        <Failure>Could not load the list.</Failure>
      ) : (
      <>
      <ScopeSummary scopes={scopes} leases={leases} />

      {/* The table and its count as one card (`ui/DataTable`). The count is the
          foot and nothing else; with no rows the table says so itself, with
          upstream's centred row (`dhcp.js:74`). */}
      <DataTable foot={<DataFoot count={`Total Scopes: ${scopes.length}`} />}>
      <Table
        stack
        header={
          <>
            <Th field="name" sort={sort} onSort={toggle}>Name</Th>
            <Th field="range" sort={sort} onSort={toggle}>Scope Range/Subnet Mask</Th>
            <Th field="network" sort={sort} onSort={toggle}>Network/Broadcast</Th>
            <Th field="interface" sort={sort} onSort={toggle}>Interface</Th>
            <Th field="leases" sort={sort} onSort={toggle}>Leases</Th>
            <th>Status</th>
            <th className={tbl.actionsCell} />
          </>
        }
        isEmpty={visibleScopes.length === 0}
        emptyText="No Scope Found"
        columns={7}
      >
        {visibleScopes.map((s) => {
          const held = per.get(s.name) ?? 0
          const size = rangeSize(s.startingAddress, s.endingAddress)
          return (
          <tr key={s.name}>
            <td className={`${styles.name} ${tbl.lead}`}>{s.name}</td>
            <td>
              <dl className={styles.kv}>
                <dt>Range</dt>
                <dd>
                  {s.startingAddress} - {s.endingAddress}
                </dd>
                <dt>Mask</dt>
                <dd>{s.subnetMask}</dd>
              </dl>
            </td>
            <td>
              <dl className={styles.kv}>
                <dt>Network</dt>
                <dd>{s.networkAddress}</dd>
                <dt>Broadcast</dt>
                <dd>{s.broadcastAddress}</dd>
              </dl>
            </td>
            {/* `interfaceAddress` is OMITTED when null; upstream draws an
                empty cell (dhcp.js:228). */}
            <td className={styles.mono}>{s.interfaceAddress ?? ''}</td>
            {/* Deviation 19: the leases this scope holds, of the addresses in its
                range. Empty when the leases could not be read. */}
            <td>
              {leases != null && size != null && (
                <div className={styles.use}>
                  <span className={styles.useText}>
                    {held} <span className={styles.useOf}>of {size}</span>
                  </span>
                  <span
                    className={styles.useTrack}
                    role="img"
                    aria-label={`${s.name}: ${held} of ${size} addresses in range leased`}
                  >
                    <span style={{ width: `${Math.min(100, (held / size) * 100)}%` }} />
                  </span>
                </div>
              )}
            </td>
            <td>
              <Tag tone={s.enabled ? 'ok' : 'neutral'}>
                {s.enabled ? 'Enabled' : 'Disabled'}
              </Tag>
            </td>
            <td className={tbl.actionsCell}>
              <div className={tbl.actions}>
                <RowAction
                  icon="edit"
                  name="Edit Scope"
                  disabled={busy}
                  onClick={() => void edit(s.name)}
                />
                {canModify && (
                  /* dhcp.js:615. Enabling asks nothing; disabling does. */
                  <RowAction
                    icon="power"
                    name={s.enabled ? 'Disable Scope' : 'Enable Scope'}
                    disabled={busy}
                    onClick={() =>
                      s.enabled
                        ? setConfirm({ action: 'disable', name: s.name })
                        : void enable(s.name)
                    }
                  />
                )}
                {canDelete && (
                  <Menu label={`Actions for ${s.name}`}>
                    {(close) => (
                      <button
                        type="button"
                        data-variant="danger"
                        disabled={busy}
                        onClick={() => { close(); setConfirm({ action: 'delete', name: s.name }) }}
                      >
                        Delete Scope
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
          if (confirm.action === 'delete') void remove(confirm.name)
          else void disable(confirm.name)
        }}
      />
    </div>
  )
}
