import { useId, useState, type CSSProperties } from 'react'
import type { SessionRow } from '../../api/user'
import { DataTable, DataFoot, Grow } from '../../ui/DataTable'
import { Segmented } from '../../ui/Segmented'
import { RowAction, Table, Th, useSort, type Keys } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { dateTime, fromNow } from '../../lib/dates'
import { byKind, sessionKind } from './profile'
import styles from './Profile.module.css'

/*
The user's own sessions (deviation 21), upstream's `tbodyMyProfileActiveSessions`
(index.html:3758-3779, auth.js:694-745) in `ui/DataTable`: the same four sortable
columns, `Session`, `Last Seen`, `Remote Address` and `User Agent`, and the same
`Total Sessions: N` in its foot.

  · One line per session: its type (the label upstream writes, in the series
    colour the Active Sessions card gives it), the token name if it has one, the
    partial token, `(current)`. The user agent is cut to the line; the row's
    `Details` holds it whole.
  · `Delete Session` is the row's own button instead of the only entry of a `⋮`
    menu; it asks upstream's confirmation as before (the page owns it).
  · The toolbar's type filter and the card's chips are the same state: they narrow
    what is drawn and ask the server nothing; the foot says `N of M sessions, TYPE
    only` while it does.

Words OURS: `All`, `Details`, `Type`, `Session type` (the filter's name), and `N of M sessions, TYPE only`.
*/

/* `sortTable('tbodyMyProfileActiveSessions', 0..3)`: by the text each cell shows. */
const KEYS: Keys<SessionRow> = {
  type: (r) => `${r.tokenName ?? ''}[${r.partialToken}]${r.isCurrentSession ? '(current)' : ''}${sessionKind(r.type).name}`,
  lastSeen: (r) => dateTime(r.lastSeen),
  address: (r) => r.lastSeenRemoteAddress,
  agent: (r) => r.lastSeenUserAgent,
}

export function SessionsTable({
  sessions,
  kind,
  onKind,
  onDelete,
  busy,
}: {
  sessions: SessionRow[]
  /** The type the table is narrowed to, `''` for all. */
  kind: string
  onKind: (kind: string) => void
  onDelete: (row: SessionRow) => void
  /** The partial token whose delete is on its way. */
  busy: string | null
}) {
  const shown = kind === '' ? sessions : sessions.filter((s) => sessionKind(s.type).key === kind)
  const { rows, sort, toggle } = useSort(KEYS, shown)
  const kinds = byKind(sessions)
  const kindName = kinds.find((k) => k.kind.key === kind)?.kind.name ?? kind

  return (
    <DataTable
      toolbar={
        <>
          <h2 className={styles.tableTitle}>Active Sessions</h2>
          <Grow>
            {kinds.length > 1 && (
              <Segmented
                label="Session type"
                compact
                options={[{ id: '', label: 'All' }, ...kinds.map((k) => ({ id: k.kind.key, label: k.kind.name }))]}
                active={kind}
                onChoose={onKind}
              />
            )}
          </Grow>
        </>
      }
      foot={
        <DataFoot
          count={
            kind === ''
              ? `Total Sessions: ${sessions.length}`
              : `${shown.length} of ${sessions.length} sessions, ${kindName} only`
          }
        />
      }
    >
      <Table
        stack
        isEmpty={rows.length === 0}
        columns={5}
        header={
          <>
            <Th field="type" sort={sort} onSort={toggle}>Session</Th>
            <Th field="lastSeen" sort={sort} onSort={toggle}>Last Seen</Th>
            <Th field="address" sort={sort} onSort={toggle}>Remote Address</Th>
            <Th field="agent" sort={sort} onSort={toggle}>User Agent</Th>
            <th className={tbl.actionsCell} />
          </>
        }
      >
        {rows.map((r) => (
          <SessionLine key={r.partialToken} r={r} onDelete={onDelete} busy={busy === r.partialToken} />
        ))}
      </Table>
    </DataTable>
  )
}

function SessionLine({ r, onDelete, busy }: { r: SessionRow; onDelete: (r: SessionRow) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const detail = useId()
  const k = sessionKind(r.type)

  return (
    <>
      <tr className={open ? styles.openRow : undefined}>
        <td className={tbl.lead}>
          <span className={styles.session}>
            <span className={styles.kind} style={{ '--sw': k.colour } as CSSProperties}>{k.name}</span>
            {r.tokenName != null && <span className={styles.tokenName}>{r.tokenName}</span>}
            <span className={styles.partial}>{`[${r.partialToken}]`}</span>
            {r.isCurrentSession && <span className={styles.current}>(current)</span>}
          </span>
        </td>
        <td className={styles.seenCell}>
          <span className={styles.seen}>{dateTime(r.lastSeen)}</span>{' '}
          <small className={styles.age}>{`(${fromNow(r.lastSeen)})`}</small>
        </td>
        <td className={styles.addrCell}>{r.lastSeenRemoteAddress}</td>
        <td className={styles.agentCell}>
          <span className={styles.agent} title={r.lastSeenUserAgent}>{r.lastSeenUserAgent}</span>
        </td>
        <td className={tbl.actionsCell}>
          <div className={tbl.actions}>
            <RowAction
              icon={open ? 'chevronDown' : 'chevronRight'}
              name="Details"
              aria-expanded={open}
              aria-controls={detail}
              onClick={() => setOpen((v) => !v)}
            />
            <RowAction icon="trash" name="Delete Session" disabled={busy} onClick={() => onDelete(r)} />
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={styles.detailRow}>
          <td colSpan={5}>
            <dl className={styles.detail}>
              <div>
                <dt>Type</dt>
                <dd>{k.name}</dd>
              </div>
              <div className={styles.wide}>
                <dt>User Agent</dt>
                <dd className={styles.agentFull}>{r.lastSeenUserAgent}</dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}
