import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field, Input, Select, Textarea } from '../../ui/Field'
import { SectionHeader } from '../../ui/SectionHeader'
import { Loading } from '../../ui/Empty'
import { DataFoot, DataTable, End, Grow } from '../../ui/DataTable'
import {
  createGroup,
  deleteGroup,
  getGroup,
  listGroups,
  setGroup,
  type AdminGroup,
} from '../../api/admin'
import { cleanList } from '../settings/model'
import { addToList, BLANK_OPTION, NONE_OPTION } from './table'
import {
  noticeFromFailure,
  Confirm,
  MRow,
  adminStyles as styles,
  type Notice,
} from './parts'
import tbl from '../../ui/Table.module.css'
import { RowAction, Th, useSort, type Keys, Table } from '../../ui/Table'
import { Menu, Separator } from '../../ui/Menu'
import { Notifier } from '../../ui/Notifier'
import { useBarParam } from './bar-param'
import lists from './AdminLists.module.css'

/*
`refreshAdminGroups`, `addGroup`, `showGroupDetailsModal`, `saveGroupDetails` and
`deleteGroup` (auth.js:1699-1937).

One table detail that is not decoration: the description is drawn with its
newlines kept (auth.js:1731 turns them into `<br />`), because the field is a
textarea of up to 255 characters and can carry them. On the row it is cut to one
line; the row's `Details` holds it whole, line by line (deviation 23).

And one about saving: `newGroup` only travels if the name CHANGED. Always sending
it would make the server try to rename the group to itself.

The layout is deviation 23: one data table, a search in its toolbar (`?q=`, it asks
nothing) with `Add Group` at its end, where upstream floats it over the table, and
upstream's `⋮` menu (View Details, then Delete Group).
*/

interface Props {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  onNotice: (a: Notice) => void
}

/* `sortTable('tbodyAdminGroups', 0..1)`. */
const KEYS: Keys<AdminGroup> = {
  name: (g) => g.name,
  description: (g) => g.description,
}

export function Groups({ tabs, token, onNotice }: Props) {
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [add, setAdd] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminGroup | null>(null)
  const [search, setSearch] = useBarParam('q')

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await listGroups(token)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setGroups([])
      onNotice(noticeFromFailure(outcome))
      return
    }
    setGroups(outcome.data.response.groups)
  }, [token, onNotice])

  useEffect(() => {
    void load()
  }, [load])

  const needle = search.trim().toLowerCase()
  const shown = groups.filter(
    (g) => needle === '' || g.name.toLowerCase().includes(needle) || g.description.toLowerCase().includes(needle),
  )
  const { rows: visibleGroups, sort, toggle } = useSort(KEYS, shown)

  async function remove(g: AdminGroup) {
    setPendingDelete(null)
    const outcome = await deleteGroup(token, g.name)
    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    setGroups((list) => list.filter((x) => x.name !== g.name))
    onNotice({ type: 'success', title: 'Group Deleted!', text: 'Group was deleted successfully.' })
  }

  return (
    <>
      <SectionHeader
        title="Administration"
        tabs={tabs}
        titleAction={<RowAction icon="refresh" name="Refresh" disabled={loading} onClick={() => void load()} />}
      />

      {loading ? (
        <Loading />
      ) : (
        <DataTable
          toolbar={
            <>
              <Grow>
                <Field inline label="Search">
                  {(id) => (
                    <Input
                      id={id}
                      search
                      placeholder="Name or description"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  )}
                </Field>
              </Grow>
              <End>
                <Button lead="add" variant="primary" onClick={() => setAdd(true)}>
                  Add Group
                </Button>
              </End>
            </>
          }
          foot={
            <DataFoot
              count={
                shown.length === groups.length
                  ? `Total Groups: ${groups.length}`
                  : `Total Groups: ${groups.length}, ${shown.length} shown`
              }
            />
          }
        >
          <Table
            stack
            header={
              <>
                <Th field="name" sort={sort} onSort={toggle}>Name</Th>
                <Th field="description" sort={sort} onSort={toggle}>Description</Th>
                <th className={tbl.actionsCell} />
              </>
            }
            isEmpty={visibleGroups.length === 0}
            emptyText="No Group Found"
            columns={3}
          >
            {visibleGroups.map((g) => (
              <GroupLine
                key={g.name}
                g={g}
                onDetails={() => setDetail(g.name)}
                onDelete={() => setPendingDelete(g)}
              />
            ))}
          </Table>
        </DataTable>
      )}

      <Confirm
        open={pendingDelete !== null}
        title="Delete Group"
        text={`Are you sure you want to delete the group [${pendingDelete?.name ?? ''}] ?`}
        label="Delete"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
      />

      <AddGroup
        open={add}
        token={token}
        onClose={() => setAdd(false)}
        onAdded={(g) => {
          setGroups((list) => [g, ...list])
          onNotice({ type: 'success', title: 'Group Added!', text: 'Group was added successfully.' })
        }}
      />

      {detail != null && (
        <GroupDetail
          name={detail}
          token={token}
          onClose={() => setDetail(null)}
          onSaved={(g) => {
            setGroups((list) => list.map((x) => (x.name === detail ? g : x)))
            onNotice({
              type: 'success',
              title: 'Group Saved!',
              text: 'Group details were saved successfully.',
            })
          }}
        />
      )}
    </>
  )
}

/* One group, one line: the name opens its details; the description is cut to the
   line, and whole, newlines kept, under `Details`. */
function GroupLine({ g, onDetails, onDelete }: { g: AdminGroup; onDetails: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const detail = useId()
  return (
    <>
      <tr className={open ? lists.openRow : undefined}>
        <td className={tbl.lead}>
          <button type="button" className={lists.link} onClick={onDetails}>
            {g.name}
          </button>
        </td>
        <td className={lists.descCell}>
          <span className={lists.clip} title={g.description}>
            {g.description.split('\n').join(' ')}
          </span>
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
            <Menu label={`Actions for ${g.name}`}>
              {(close) => (
                <>
                  <button type="button" onClick={() => { close(); onDetails() }}>
                    View Details
                  </button>
                  <Separator />
                  <button type="button" data-variant="danger" onClick={() => { close(); onDelete() }}>
                    Delete Group
                  </button>
                </>
              )}
            </Menu>
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={lists.detailRow}>
          <td colSpan={3} className={lists.detailCell}>
            <dl className={lists.detail}>
              <div className={lists.wide}>
                <dt>Description</dt>
                <dd>
                  {g.description.split('\n').map((line, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className={lists.whole}>{line}</div>
                  ))}
                </dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}

/** `addGroup` (auth.js:1755). Only one validation: the name. */
function AddGroup({
  open,
  token,
  onClose,
  onAdded,
}: {
  open: boolean
  token: string | null
  onClose: () => void
  onAdded: (g: AdminGroup) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setNotice(null)
    setName('')
    setDescription('')
  }, [open])

  async function add() {
    if (name === '') {
      setNotice({ type: 'warning', title: 'Missing!', text: 'Please enter a name to add group.' })
      return
    }

    setBusy(true)
    const outcome = await createGroup(token, name, description)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    onAdded(outcome.data.response)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Add Group"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void add()}>
            Add
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      <MRow label="Name">
        {(id) => (
          <Input
            id={id}
            placeholder="group name"
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </MRow>
      <MRow label="Description">
        {(id) => (
          <Textarea
            mono
            id={id}
            className={styles.area}
            rows={5}
            maxLength={255}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </MRow>
    </Dialog>
  )
}

/** `showGroupDetailsModal` / `saveGroupDetails` (auth.js:1798-1902). */
function GroupDetail({
  name,
  token,
  onClose,
  onSaved,
}: {
  name: string
  token: string | null
  onClose: () => void
  onSaved: (g: AdminGroup) => void
}) {
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [description, setDescription] = useState('')
  const [members, setMembers] = useState('')
  const [users, setUsers] = useState<string[]>([])
  const [addUser, setAddUser] = useState(BLANK_OPTION)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await getGroup(token, name)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    const d = outcome.data.response
    setNewName(d.name)
    setDescription(d.description)
    setMembers(d.members.map((m) => `${m}\n`).join(''))
    setUsers(d.users ?? [])
    setAddUser(BLANK_OPTION)
  }, [token, name])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setBusy(true)
    const outcome = await setGroup(
      token,
      name,
      description,
      cleanList(members),
      newName !== name ? newName : undefined,
    )
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
      title="Group Details"
      /* 880 because of the list it carries inside, not because of its two fields.
         It is the same reason `User Details` is 880. At 560 the members list and its
         `Add User` shared a column half the width of the names in it. */
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
          <MRow label="Name">
            {(id) => (
              <Input
                id={id}
                placeholder="group name"
                maxLength={255}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            )}
          </MRow>
          <MRow label="Description">
            {(id) => (
              <Textarea
                mono
                id={id}
                className={styles.area}
                rows={3}
                maxLength={255}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </MRow>
          <MRow label="Members">
            {(id) => (
              <Textarea
                mono
                id={id}
                className={styles.area}
                rows={7}
                value={members}
                onChange={(e) => setMembers(e.target.value)}
              />
            )}
          </MRow>
          <MRow label="Add User">
            {(id) => (
              <Select
                id={id}
                className={styles.select}
                value={addUser}
                onChange={(e) => {
                  setAddUser(e.target.value)
                  setMembers((t) => addToList(t, e.target.value))
                }}
              >
                <option value={BLANK_OPTION} />
                <option value={NONE_OPTION}>None</option>
                {users.map((u) => (
                  <option key={u} value={u}>
                    {u}
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
