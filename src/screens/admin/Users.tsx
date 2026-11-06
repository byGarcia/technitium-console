import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field, Input } from '../../ui/Field'
import { SectionHeader } from '../../ui/SectionHeader'
import { Loading } from '../../ui/Empty'
import { Tag } from '../../ui/Tag'
import { DataFoot, DataTable, End, Grow } from '../../ui/DataTable'
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  setUser,
  type AdminUser,
} from '../../api/admin'
import type { ClusterState } from '../../api/admin-cluster'
import { UserDetails } from './UserDetails'
import { DialogForm, DialogPair, dialogForm as df } from '../../ui/DialogForm'
import {
  noticeFromFailure,
  Confirm,
  MRow,
  type Notice,
} from './parts'
import tbl from '../../ui/Table.module.css'
import { RowAction, Th, useSort, type Keys, Table } from '../../ui/Table'
import { Menu, Separator } from '../../ui/Menu'
import { Notifier } from '../../ui/Notifier'
import { access, loginParts, totpStatus, typeColour, userStatus, userType } from './user-facts'
import { UsersSummary } from './UsersSummary'
import { useBarParam } from './bar-param'
import { Applied, LoginDate } from './ListParts'
import styles from './AdminLists.module.css'

/*
`refreshAdminUsers` and the row's seven actions (auth.js:1083-1698).

Five of those seven actions (saving the modal, enabling, disabling, clearing the
2FA and resetting the password) go out through the SAME `admin/users/set`
endpoint, because the server only touches the fields that arrive. The sixth and
seventh are `admin/users/create` and `admin/users/delete`.

Two asymmetries of upstream's that are replicated as they are:

  · Disabling asks for confirmation; ENABLING does not.
  · "Reset Password" is only offered to a `Local` user, and "Disable 2FA" to a
    `Local` or `RemoteLDAP` one that has it on (auth.js:1195-1205, v15.5.1).
    Since v15.5 both hang off `type`, not off the obsolete `isSsoUser`.

The layout is deviation 23: four cells over ONE data table, a search in its toolbar
with `Add User` at its end (where upstream floats it, over the table), one line per
user, both logins whole under the row's `Details`, and upstream's `⋮` menu with its
own items in its own order. The search, and a state or type pressed in the strip,
narrow what is drawn and ask nothing; they travel in the bar (`?q=`, `?status=`,
`?type=`). Words OURS: `Search`, its placeholder, `Details`, `Clear`, `N shown`.
*/

interface Props {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  cluster: ClusterState | null
  onNotice: (a: Notice) => void
}

type Action =
  | { type: 'disable'; user: AdminUser }
  | { type: '2fa'; user: AdminUser }
  | { type: 'delete'; user: AdminUser }

/* `sortTable('tbodyAdminUsers', 0..6)`. */
const KEYS: Keys<AdminUser> = {
  username: (u) => u.username,
  display: (u) => u.displayName,
  type: userType,
  totp: totpStatus,
  status: userStatus,
  recent: (u) => access(u.recentSessionLoggedOn, u.recentSessionRemoteAddress),
  previous: (u) => access(u.previousSessionLoggedOn, u.previousSessionRemoteAddress),
}

export function Users({ tabs, token, cluster, onNotice }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [add, setAdd] = useState(false)
  const [reset, setReset] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [search, setSearch] = useBarParam('q')
  const [status, setStatus] = useBarParam('status')
  const [type, setType] = useBarParam('type')

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await listUsers(token)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setUsers([])
      onNotice(noticeFromFailure(outcome))
      return
    }
    setUsers(outcome.data.response.users)
  }, [token, onNotice])

  useEffect(() => {
    void load()
  }, [load])

  const needle = search.trim().toLowerCase()
  const shown = users.filter(
    (u) =>
      (status === '' || userStatus(u) === status) &&
      (type === '' || userType(u) === type) &&
      (needle === '' || u.username.toLowerCase().includes(needle) || u.displayName.toLowerCase().includes(needle)),
  )
  const { rows: visibleUsers, sort, toggle } = useSort(KEYS, shown)

  function replaceEntry(u: AdminUser) {
    setUsers((list) => list.map((x) => (x.username === u.username ? u : x)))
  }

  /** Changing the username from the modal leaves the row with no match by
   *  `username`; upstream replaces it by position. Here it is done by the index
   *  of the user that was opened, which is the same thing. */
  function replaceWith(previous: string, u: AdminUser) {
    setUsers((list) => list.map((x) => (x.username === previous ? u : x)))
  }

  async function change(u: AdminUser, body: Record<string, string>, notice: Notice) {
    setAction(null)
    const outcome = await setUser(token, { user: u.username, ...body })
    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    replaceEntry(outcome.data.response)
    onNotice(notice)
  }

  async function remove(u: AdminUser) {
    setAction(null)
    const outcome = await deleteUser(token, u.username)
    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    setUsers((list) => list.filter((x) => x.username !== u.username))
    onNotice({ type: 'success', title: 'User Deleted!', text: 'User account was deleted successfully.' })
  }

  function enable(u: AdminUser) {
    void change(u, { disabled: 'false' }, {
      type: 'success',
      title: 'User Enabled!',
      text: `User [${u.username}] account was enabled successfully.`,
    })
  }

  return (
    <>
      <SectionHeader
        section="Administration"
        title="Users"
        tabs={tabs}
        titleAction={<RowAction icon="refresh" name="Refresh" disabled={loading} onClick={() => void load()} />}
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          <UsersSummary users={users} status={status} type={type} onStatus={setStatus} onType={setType} />
          <DataTable
            toolbar={
              <>
                <Grow>
                  <Field inline label="Search">
                    {(id) => (
                      <Input
                        id={id}
                        search
                        placeholder="Username or display name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    )}
                  </Field>
                </Grow>
                <End>
                  {status !== '' && (
                    <Applied label={status} colour={status === 'Enabled' ? 'var(--ch-ok)' : 'var(--ch-drop)'} onClear={() => setStatus('')} />
                  )}
                  {type !== '' && <Applied label={type} colour={typeColour(type)} onClear={() => setType('')} />}
                  <Button lead="add" variant="primary" onClick={() => setAdd(true)}>
                    Add User
                  </Button>
                </End>
              </>
            }
            foot={
              <DataFoot
                count={
                  shown.length === users.length
                    ? `Total Users: ${users.length}`
                    : `Total Users: ${users.length}, ${shown.length} shown`
                }
              />
            }
          >
            <Table
              stack
              header={
                <>
                  <Th field="username" sort={sort} onSort={toggle}>Username</Th>
                  <Th field="display" sort={sort} onSort={toggle}>Display Name</Th>
                  <Th field="type" sort={sort} onSort={toggle}>Type</Th>
                  <Th field="totp" sort={sort} onSort={toggle}>2FA Status</Th>
                  <Th field="status" sort={sort} onSort={toggle}>Status</Th>
                  <Th field="recent" sort={sort} onSort={toggle}>Recent Login</Th>
                  <Th field="previous" sort={sort} onSort={toggle}>Previous Login</Th>
                  <th className={tbl.actionsCell} />
                </>
              }
              isEmpty={visibleUsers.length === 0}
              emptyText="No User Found"
              columns={8}
            >
              {visibleUsers.map((u) => (
                <UserLine
                  key={u.username}
                  u={u}
                  onDetails={() => setDetail(u.username)}
                  onEnable={() => enable(u)}
                  onDisable={() => setAction({ type: 'disable', user: u })}
                  onReset={() => setReset(u.username)}
                  onDisable2fa={() => setAction({ type: '2fa', user: u })}
                  onDelete={() => setAction({ type: 'delete', user: u })}
                />
              ))}
            </Table>
          </DataTable>
        </>
      )}

      <Confirm
        open={action?.type === 'disable'}
        title="Disable User"
        text={`Are you sure you want to disable the user [${action?.user.username ?? ''}] account?`}
        label="Disable"
        onClose={() => setAction(null)}
        onConfirm={() =>
          action?.type === 'disable' &&
          void change(action.user, { disabled: 'true' }, {
            type: 'success',
            title: 'User Disabled!',
            text: `User [${action.user.username}] account was disabled successfully.`,
          })
        }
      />

      <Confirm
        open={action?.type === '2fa'}
        title="Disable 2FA"
        text={`Are you sure you want to disable Two-factor authentication (2FA) for user [${action?.user.username ?? ''}] ?`}
        label="Disable"
        onClose={() => setAction(null)}
        onConfirm={() =>
          action?.type === '2fa' &&
          void change(action.user, { totpEnabled: 'false' }, {
            type: 'success',
            title: '2FA Disabled!',
            text: `Two-factor authentication was disabled successfully for user [${action.user.username}].`,
          })
        }
      />

      <Confirm
        open={action?.type === 'delete'}
        title="Delete User"
        text={`Are you sure you want to delete the user [${action?.user.username ?? ''}] account?`}
        label="Delete"
        onClose={() => setAction(null)}
        onConfirm={() => action?.type === 'delete' && void remove(action.user)}
      />

      <AddUser
        open={add}
        token={token}
        onClose={() => setAdd(false)}
        onAdded={(u) => {
          setUsers((list) => [u, ...list])
          onNotice({ type: 'success', title: 'User Added!', text: 'User was added successfully.' })
        }}
      />

      {reset != null && (
        <ResetPassword
          username={reset}
          token={token}
          onClose={() => setReset(null)}
          onNotice={onNotice}
        />
      )}

      {detail != null && (
        <UserDetails
          open
          username={detail}
          token={token}
          cluster={cluster}
          onClose={() => setDetail(null)}
          onSaved={(u) => replaceWith(detail, u)}
          onNotice={onNotice}
        />
      )}
    </>
  )
}

/*
One user, one line: the name (it opens the details, as upstream's link does), the
display name, the three states as tags, and each login's date. Both logins whole,
`date from address` and how long ago, are under `Details`. The `⋮` menu is
upstream's (auth.js:1190-1209): View Details, Enable or Disable, Reset Password for
a local user, Disable 2FA when it is on, then Delete User.
*/
function UserLine({
  u,
  onDetails,
  onEnable,
  onDisable,
  onReset,
  onDisable2fa,
  onDelete,
}: {
  u: AdminUser
  onDetails: () => void
  onEnable: () => void
  onDisable: () => void
  onReset: () => void
  onDisable2fa: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const detail = useId()
  const recent = loginParts(u.recentSessionLoggedOn, u.recentSessionRemoteAddress)
  const previous = loginParts(u.previousSessionLoggedOn, u.previousSessionRemoteAddress)

  return (
    <>
      <tr className={open ? styles.openRow : undefined}>
        <td className={tbl.lead}>
          <button type="button" className={styles.link} onClick={onDetails}>
            {u.username}
          </button>
        </td>
        <td className={styles.nowrap}>{u.displayName}</td>
        {/* `Type`, `2FA Status` and `Status` say what a user IS, as tags. A
            remote type and its sibling `SSO Managed` take the `info` tone. */}
        <td>
          {u.type === 'RemoteSSO' || u.type === 'RemoteLDAP' ? (
            <Tag tone="info">{userType(u)}</Tag>
          ) : (
            <Tag>{userType(u)}</Tag>
          )}
        </td>
        <td>
          {u.type === 'RemoteSSO' ? (
            <Tag tone="info">SSO Managed</Tag>
          ) : u.totpEnabled ? (
            <Tag tone="ok">Enabled</Tag>
          ) : (
            <Tag>Disabled</Tag>
          )}
        </td>
        <td>{u.disabled ? <Tag>Disabled</Tag> : <Tag tone="ok">Enabled</Tag>}</td>
        <td>
          <LoginDate date={recent.date} never={recent.never} />
        </td>
        <td>
          <LoginDate date={previous.date} never={previous.never} />
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
            <Menu label={`Actions for ${u.username}`}>
              {(close) => (
                <>
                  <button type="button" onClick={() => { close(); onDetails() }}>
                    View Details
                  </button>
                  {u.disabled ? (
                    <button type="button" onClick={() => { close(); onEnable() }}>
                      Enable
                    </button>
                  ) : (
                    <button type="button" onClick={() => { close(); onDisable() }}>
                      Disable
                    </button>
                  )}
                  {u.type === 'Local' && (
                    <button type="button" onClick={() => { close(); onReset() }}>
                      Reset Password
                    </button>
                  )}
                  {(u.type === 'Local' || u.type === 'RemoteLDAP') && u.totpEnabled && (
                    <button type="button" onClick={() => { close(); onDisable2fa() }}>
                      Disable 2FA
                    </button>
                  )}
                  <Separator />
                  <button type="button" data-variant="danger" onClick={() => { close(); onDelete() }}>
                    Delete User
                  </button>
                </>
              )}
            </Menu>
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={styles.detailRow}>
          <td colSpan={8} className={styles.detailCell}>
            <dl className={styles.detail}>
              <Login label="Recent Login" login={recent} />
              <Login label="Previous Login" login={previous} />
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}

function Login({ label, login }: { label: string; login: ReturnType<typeof loginParts> }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {login.never ? (
          'Never'
        ) : (
          <>
            <span className={styles.from}>{login.date}</span> from{' '}
            <span className={styles.from}>{login.address}</span>
            <span className={styles.age}>{`(${login.ago})`}</span>
          </>
        )}
      </dd>
    </div>
  )
}

/* `addUser` (auth.js:1178). The order of the four validations is contract. */
function AddUser({
  open,
  token,
  onClose,
  onAdded,
}: {
  open: boolean
  token: string | null
  onClose: () => void
  onAdded: (u: AdminUser) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setNotice(null)
    setDisplayName('')
    setUser('')
    setPass('')
    setConfirm('')
  }, [open])

  async function add() {
    if (user === '') {
      setNotice({ type: 'warning', title: 'Missing!', text: 'Please enter an username to add user.' })
      return
    }
    if (pass === '') {
      setNotice({ type: 'warning', title: 'Missing!', text: 'Please enter a password to add user.' })
      return
    }
    if (confirm === '') {
      setNotice({ type: 'warning', title: 'Missing!', text: 'Please enter confirm password.' })
      return
    }
    if (pass !== confirm) {
      setNotice({
        type: 'warning',
        title: 'Mismatch!',
        text: 'Passwords do not match. Please try again.',
      })
      return
    }

    setBusy(true)
    const outcome = await createUser(token, displayName, user, pass)
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
      title="Add User"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void add()}>
            Add
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      {/* The two names, then the password and its confirmation on one line: they
          are one thing typed twice. */}
      <DialogForm>
        <MRow label="Display Name">
          {(id) => (
            <Input
              id={id}
              placeholder="display name"
              maxLength={255}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
        </MRow>
        <MRow label="Username">
          {(id) => (
            <Input
              id={id}
              placeholder="username"
              maxLength={255}
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          )}
        </MRow>
        <DialogPair>
          <MRow label="Password">
            {(id) => (
              <Input
                id={id}
                type="password"
                placeholder="password"
                maxLength={255}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            )}
          </MRow>
          <MRow label="Confirm Password">
            {(id) => (
              <Input
                id={id}
                type="password"
                placeholder="confirm password"
                maxLength={255}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
          </MRow>
        </DialogPair>
      </DialogForm>
    </Dialog>
  )
}

/*
`showResetUserPasswordModal` / `resetUserPassword` (auth.js:1546-1627). Upstream
REUSES the "Change Password" modal by changing its title to "Reset Password",
hiding the current password and the OTP, and renaming the button to "Reset". The
success alert comes out on the PAGE, because the modal has already closed.
*/
function ResetPassword({
  username,
  token,
  onClose,
  onNotice,
}: {
  username: string
  token: string | null
  onClose: () => void
  onNotice: (a: Notice) => void
}) {
  const [blank, setBlank] = useState('')
  const [confirm, setConfirm] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (blank === '') {
      setNotice({ type: 'warning', title: 'Missing!', text: 'Please enter new password.' })
      return
    }
    if (confirm === '') {
      setNotice({ type: 'warning', title: 'Missing!', text: 'Please enter confirm password.' })
      return
    }
    if (blank !== confirm) {
      setNotice({
        type: 'warning',
        title: 'Mismatch!',
        text: 'Passwords do not match. Please try again.',
      })
      return
    }

    setBusy(true)
    const outcome = await resetUserPassword(token, username, blank)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    onClose()
    onNotice({ type: 'success', title: 'Password Reset!', text: 'Password was reset successfully.' })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Reset Password"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Reset
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      <DialogForm>
        <MRow label="Username">{(id) => <Input id={id} className={df.readOnly} value={username} readOnly />}</MRow>
        <DialogPair>
          <MRow label="New Password">
            {(id) => (
              <Input
                id={id}
                type="password"
                maxLength={255}
                value={blank}
                onChange={(e) => setBlank(e.target.value)}
              />
            )}
          </MRow>
          <MRow label="Confirm Password">
            {(id) => (
              <Input
                id={id}
                type="password"
                maxLength={255}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
          </MRow>
        </DialogPair>
      </DialogForm>
    </Dialog>
  )
}
