import { useEffect, useState } from 'react'
import { getZonePermissions, serializePermissions, setZonePermissions } from '../../../api/zones'
import { Button } from '../../../ui/Button'
import { Dialog } from '../../../ui/Dialog'
import { Field, Select } from '../../../ui/Field'
import { Loading } from '../../../ui/Empty'
import type { Notice } from '../types'
import { RowAction, Table } from '../../../ui/Table'
import tbl from '../../../ui/Table.module.css'
import l from './layout.module.css'
import styles from './ZonePermissions.module.css'
import { noticeFromFailure } from '../../../lib/notice'
import { Notifier } from '../../../ui/Notifier'

/*
`modalEditPermissions` for a zone (zone.js:2544 and 2616).

Two tables identical in appearance (users and groups), with the catch that **the
subject's name is called something different in each**: `username` in users and
`name` in groups. Here they are normalised to `name` on the way in and
serialised back the same on the way out, which is all the server sees.

The "add" dropdown carries two phantom entries from upstream (an empty one and
one that says "None") that add nobody. They are kept.
*/

interface Row {
  name: string
  canView: boolean
  canModify: boolean
  canDelete: boolean
}

export function ZonePermissions({
  zone,
  open,
  token,
  node = '',
  canModify,
  onClose,
  onDone,
}: {
  zone: string
  open: boolean
  token: string | null
  node?: string
  canModify: boolean
  onClose: () => void
  onDone: (a: Notice) => void
}) {
  /* Upstream titles it `Edit Permissions - <span>` (`index.html:6856`) and fills
     that span with `"Zones / " + zone` (`zone.js:2549`). Without the prefix, the
     dialog does not say what it does: it is the only one of Zones' ten whose title
     does not name the action, and the same dialog opened from Administration does
     carry it. */
  const [title, setTitle] = useState(
    `Edit Permissions - Zones / ${zone === '.' ? '<root>' : zone}`,
  )
  const [users, setUsers] = useState<Row[]>([])
  const [groups, setGroups] = useState<Row[]>([])
  const [availableUsers, setAvailableUsers] = useState<string[]>([])
  const [availableGroups, setAvailableGroups] = useState<string[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setNotice(null)
    setLoading(true)
    void getZonePermissions(token, zone, node).then((outcome) => {
      setLoading(false)
      if (outcome.kind !== 'ok') {
        setNotice(noticeFromFailure(outcome))
        return
      }
      const r = outcome.data
      setTitle(`Edit Permissions - ${r.section} / ${r.subItem === '.' ? '<root>' : r.subItem}`)
      setUsers(
        r.userPermissions.map((p) => ({
          name: p.username,
          canView: p.canView,
          canModify: p.canModify,
          canDelete: p.canDelete,
        })),
      )
      setGroups(
        r.groupPermissions.map((p) => ({
          name: p.name,
          canView: p.canView,
          canModify: p.canModify,
          canDelete: p.canDelete,
        })),
      )
      setAvailableUsers(r.users ?? [])
      setAvailableGroups(r.groups ?? [])
    })
  }, [open, token, zone, node])

  async function save() {
    setBusy(true)
    const outcome = await setZonePermissions(
      token,
      zone,
      serializePermissions(users),
      serializePermissions(groups),
      node,
    )
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    onClose()
    onDone({ type: 'success', title: 'Permissions Saved!', text: 'Zone permissions were saved successfully.' })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="medium"
      title={title}
      actions={
        <>
          {canModify && (
            <Button variant="primary" disabled={busy || loading} onClick={() => void save()}>
              Save
            </Button>
          )}
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {loading ? (
        <Loading>Loading permissions…</Loading>
      ) : (
        <div className={l.content}>
          <PermissionsTable
            title="User Permissions"
            rows={users}
            available={availableUsers}
            addLabel="Add User"
            onChange={setUsers}
          />
          <PermissionsTable
            title="Group Permissions"
            rows={groups}
            available={availableGroups}
            addLabel="Add Group"
            onChange={setGroups}
          />
        </div>
      )}
    </Dialog>
  )
}

function PermissionsTable({
  title,
  rows,
  available,
  addLabel,
  onChange,
}: {
  title: string
  rows: Row[]
  available: string[]
  addLabel: string
  onChange: (f: Row[]) => void
}) {
  const unassigned = available.filter((d) => !rows.some((f) => f.name === d))

  const change = (i: number, key: keyof Row, value: boolean) =>
    onChange(rows.map((f, j) => (j === i ? { ...f, [key]: value } : f)))

  return (
    <section className={l.section}>
      <div className={l.title}>{title}</div>

      {/* The data table's look, and its rows become blocks where the dialog is
          narrow: the name and Remove on the first line, the three verbs under it. */}
      <Table
        stack
        isEmpty={rows.length === 0}
        emptyText="No permissions assigned."
        columns={5}
        header={
          <>
            <th>Name</th>
            <th className={styles.verb}>View</th>
            <th className={styles.verb}>Modify</th>
            <th className={styles.verb}>Delete</th>
            <th className={tbl.actionsCell} />
          </>
        }
      >
        {rows.map((f, i) => (
          <tr key={f.name}>
            <td className={`${tbl.lead} ${styles.who}`}>{f.name}</td>
            {(['canView', 'canModify', 'canDelete'] as const).map((key) => (
              <td key={key} className={styles.verb}>
                <input
                  type="checkbox"
                  className={styles.chkPerm}
                  aria-label={`${key} for ${f.name}`}
                  checked={f[key]}
                  onChange={(e) => change(i, key, e.target.checked)}
                />
              </td>
            ))}
            {/* Remove is the row's action, as every table's: the bin with its
                name in the tooltip. It takes the name out of this list only;
                nothing is sent until Save. */}
            <td className={tbl.actionsCell}>
              <div className={tbl.actions}>
                <RowAction icon="trash" name="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))} />
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={styles.add}>
        <Field label={addLabel}>
          {(id) => (
            <Select
              id={id}
              value=""
              onChange={(e) => {
                const v = e.target.value
                // Upstream's two phantom entries add nobody.
                if (v === '' || v === 'none') return
                onChange([...rows, { name: v, canView: true, canModify: false, canDelete: false }])
              }}
            >
              <option value="" />
              <option value="none">None</option>
              {unassigned.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </section>
  )
}
