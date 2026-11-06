import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { SectionHeader } from '../../ui/SectionHeader'
import { Loading } from '../../ui/Empty'
import {
  getPermission,
  listPermissions,
  setPermissions,
  type SectionPermission,
} from '../../api/admin'
import { primaryNodeName, type ClusterState } from '../../api/admin-cluster'
import { addToTable, BLANK_OPTION, NONE_OPTION, serializeTable, type Cell } from './table'
import { noticeFromFailure, MRow, adminStyles as styles, type Notice } from './parts'
import { RowAction, Th, useSort, type Keys } from '../../ui/Table'
import { Select } from '../../ui/Select'
import { EditableTable } from '../../ui/EditableTable'
import { Notifier } from '../../ui/Notifier'
import { PermissionMap } from './PermissionMap'

/*
`refreshAdminPermissions`, `showEditSectionPermissionsModal` and
`saveSectionPermissions` (auth.js:1938-2150).

Three things that govern this screen:

  · The list is READ-ONLY: permissions are edited in the modal. The list is one
    matrix (`PermissionMap.tsx`, deviation 23): sections down the side, groups and
    users across.
  · The group list the modal offers INCLUDES `Everyone`, and `groups/list`'s does
    not. They are two different lists from the server and cannot be swapped
    (checked live against a v15.4).
  · `permissions/set` travels with `node` = the name of the cluster's PRIMARY
    node, not the node being looked at; an empty string when there is no cluster.
    And it asks for `Administration.canDelete`, not `canModify`
    (WebServiceAuthApi.cs:1533).
*/

interface Props {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  cluster: ClusterState | null
  onNotice: (a: Notice) => void
}

export function Permissions({ tabs, token, cluster, onNotice }: Props) {
  const [sections, setSections] = useState<SectionPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await listPermissions(token)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setSections([])
      onNotice(noticeFromFailure(outcome))
      return
    }
    setSections(outcome.data.response.permissions)
  }, [token, onNotice])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <SectionHeader
        title="Administration"
        tabs={tabs}
        titleAction={<RowAction icon="refresh" name="Refresh" disabled={loading} onClick={() => void load()} />}
      />

      {loading ? <Loading /> : <PermissionMap sections={sections} onEdit={setEdit} />}

      {edit != null && (
        <EditPermissions
          section={edit}
          token={token}
          primaryNode={primaryNodeName(cluster)}
          onClose={() => setEdit(null)}
          onSaved={(p) => {
            setSections((list) => list.map((x) => (x.section === p.section ? p : x)))
            onNotice({
              type: 'success',
              title: 'Permissions Saved!',
              text: 'Section permissions were saved successfully.',
            })
          }}
        />
      )}
    </>
  )
}


interface Row {
  name: string
  canView: boolean
  canModify: boolean
  canDelete: boolean
}

/** `showEditSectionPermissionsModal` / `saveSectionPermissions`. */
function EditPermissions({
  section,
  token,
  primaryNode,
  onClose,
  onSaved,
}: {
  section: string
  token: string | null
  primaryNode: string
  onClose: () => void
  onSaved: (p: SectionPermission) => void
}) {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<readonly Row[]>([])
  const [groups, setGroups] = useState<readonly Row[]>([])
  const [userList, setUserList] = useState<string[]>([])
  const [groupList, setGroupList] = useState<string[]>([])
  const [addUser, setAddUser] = useState(BLANK_OPTION)
  const [addGroup, setAddGroup] = useState(BLANK_OPTION)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await getPermission(token, section)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    const d = outcome.data.response
    setUsers(
      d.userPermissions.map((p) => ({
        name: p.username,
        canView: p.canView,
        canModify: p.canModify,
        canDelete: p.canDelete,
      })),
    )
    setGroups(
      d.groupPermissions.map((p) => ({
        name: p.name,
        canView: p.canView,
        canModify: p.canModify,
        canDelete: p.canDelete,
      })),
    )
    setUserList(d.users ?? [])
    setGroupList(d.groups ?? [])
    setAddUser(BLANK_OPTION)
    setAddGroup(BLANK_OPTION)
  }, [token, section])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    const toCells = (rows: readonly Row[]): Cell[][] =>
      rows.map((f) => [
        { type: 'text', value: f.name },
        { type: 'checkbox', value: f.canView },
        { type: 'checkbox', value: f.canModify },
        { type: 'checkbox', value: f.canDelete },
      ])

    const u = serializeTable(toCells(users))
    if (!u.ok) {
      setNotice({ type: 'warning', title: u.failure.title, text: u.failure.text })
      return
    }
    const g = serializeTable(toCells(groups))
    if (!g.ok) {
      setNotice({ type: 'warning', title: g.failure.title, text: g.failure.text })
      return
    }

    setBusy(true)
    const outcome = await setPermissions(token, section, u.value, g.value, primaryNode)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    onSaved(outcome.data.response)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit Permissions - ${section}`}
      /*
      The SAME dialog opened from a zone already went wide, and from here it went
      to 560: two widths for the same thing. It is not that it was cramped (the
      table shrinks and fits in all three sizes, measured); it is that its two
      entrances had to look the same. It goes with the title fix, which had also
      drifted between the two.

      880 and not 720: it is the console's "the one that shows a table" width, and
      this modal shows two of them, each with its own add row. It matches the read
      only list it edits.
      */
      size="wide"
      actions={
        <>
          <Button variant="primary" disabled={busy || loading} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <PermissionsTable
            section={section}
            title="User Permissions"
            header="Username"
            rows={users}
            onChange={setUsers}
          />
          <MRow label="Add User">
            {(id) => (
              <Select
                id={id}
                className={styles.select}
                value={addUser}
                onChange={(e) => {
                  setAddUser(e.target.value)
                  setUsers((f) => addToTable(f, e.target.value, blankRow))
                }}
              >
                <option value={BLANK_OPTION} />
                <option value={NONE_OPTION}>None</option>
                {userList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </MRow>

          <PermissionsTable
            section={section}
            title="Group Permissions"
            header="Group"
            rows={groups}
            onChange={setGroups}
          />
          <MRow label="Add Group">
            {(id) => (
              <Select
                id={id}
                className={styles.select}
                value={addGroup}
                onChange={(e) => {
                  setAddGroup(e.target.value)
                  setGroups((f) => addToTable(f, e.target.value, blankRow))
                }}
              >
                <option value={BLANK_OPTION} />
                <option value={NONE_OPTION}>None</option>
                {groupList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </MRow>
        </>
      )}
    </Dialog>
  )
}

const blankRow = (name: string): Row => ({
  name,
  canView: false,
  canModify: false,
  canDelete: false,
})

/* `sortTable('tbodyEditPermissionsUser'|'Group', 0)`. */
const PERMISSION_KEYS: Keys<Row> = { name: (f) => f.name }

function PermissionsTable({
  section,
  title,
  header,
  rows,
  onChange,
}: {
  /* Here the cells ARE controls, so they are amber and they are in the tab
     order. What does not change is their NAME: the same
     `{Section} · {Subject} · {Verb}` the read-only list uses, so the thing you
     tick here is called what it was called there. */
  section: string
  title: string
  header: string
  rows: readonly Row[]
  onChange: (f: readonly Row[]) => void
}) {
  const { rows: visible, sort, toggle } = useSort(PERMISSION_KEYS, rows as Row[])

  // The checkbox writes over the ORIGINAL list: the sorting only changes the
  // order things are drawn in, not the data's.
  function set(row: Row, partial: Partial<Row>) {
    onChange(rows.map((f) => (f.name === row.name ? { ...f, ...partial } : f)))
  }

  return (
    <>
      <p className={styles.sub}>{title}</p>
      {/* The editable one does not carry the data table's panel wrapper: it is
          another piece (`ui/EditableTable.module.css`) and lives INSIDE a panel. */}
      <div>
        <EditableTable
      className={styles.edit}
          header={
            <>
              <Th field="name" sort={sort} onSort={toggle}>{header}</Th>
              <th>View</th>
              <th>Modify</th>
              <th>Delete</th>
              <th className={styles.tdel} />
            </>
          }
        >
          {visible.map((f) => (
            <tr key={f.name}>
              <td className={styles.who}>{f.name}</td>
              <td>
                <input
                  type="checkbox"
                  className={styles.chkPerm}
                  aria-label={`${section} · ${f.name} · View`}
                  checked={f.canView}
                  onChange={(e) => set(f, { canView: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  className={styles.chkPerm}
                  aria-label={`${section} · ${f.name} · Modify`}
                  checked={f.canModify}
                  onChange={(e) => set(f, { canModify: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  className={styles.chkPerm}
                  aria-label={`${section} · ${f.name} · Delete`}
                  checked={f.canDelete}
                  onChange={(e) => set(f, { canDelete: e.target.checked })}
                />
              </td>
              <td className={styles.tdel}>
                <Button onClick={() => onChange(rows.filter((x) => x.name !== f.name))}>Remove</Button>
              </td>
            </tr>
          ))}
        </EditableTable>
        {/* Upstream puts no text when the modal's table is empty; nor does it
            here, so as not to invent a literal that does not exist. */}
      </div>
    </>
  )
}
