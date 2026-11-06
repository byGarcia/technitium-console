import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Input, Select, Textarea } from '../../ui/Field'
import { Loading } from '../../ui/Empty'
import {
  deleteAdminSession,
  getUser,
  setUser,
  type AdminSession,
  type AdminUserDetails,
} from '../../api/admin'
import { primaryNodeName, type ClusterState } from '../../api/admin-cluster'
import { cleanList } from '../settings/model'
import { addToList, BLANK_OPTION, NONE_OPTION } from './table'
import { dateTime, fromNow } from './dates'
import {
  noticeFromFailure,
  Check,
  Confirm,
  MRow,
  MValue,
  adminStyles as styles,
  type Notice,
} from './parts'
import tbl from '../../ui/Table.module.css'
import lists from './AdminLists.module.css'
import { sessionKind } from '../profile/profile'
import { DialogBlock, DialogForm, DialogPair, DialogSection, dialogForm as df } from '../../ui/DialogForm'
import { RowAction, Th, useSort, type Keys, Table } from '../../ui/Table'
import { Notifier } from '../../ui/Notifier'
import { Menu } from '../../ui/Menu'

/*
`showUserDetailsModal` / `saveUserDetails` / `deleteUserSession`
(auth.js:1244-1481). It is Administration's most loaded modal and TWO places open
it: the Users tab (with a row to update) and the Sessions tab (without one).
Upstream tells the two cases apart by whether the link carried a `data-id`, and
in the second it refreshes the sessions list on save instead of redrawing the row.

Two interface rules that come from the user themselves and not from permissions,
both switched on `type` since v15.5 (auth.js:1318-1352), not on the obsolete
`isSsoUser`:

  · A `RemoteSSO` or `RemoteLDAP` user has the name and the display name locked,
    because the provider or the directory governs them.
  · Their group membership is locked ONLY if the server says
    `remotelyManagedGroups` (auth.js:1351-1352). It replaced `ssoManagedGroups`,
    which v15.5.1 only still writes for SSO users; a `Local` user always gets
    `false` (WebServiceAuthApi.cs:158-172). They are two different conditions
    and cannot be merged.

The labels follow `getAdminUsersRowHtml`'s switch: "Remote/SSO" with "SSO
Managed", "Remote/LDAP" with its own 2FA status, and for `Local` or anything else
the `default:` writes `type` as it arrives.

And an important consequence: the locked fields are NOT sent. Upstream composes
the query by looking at each field's `disabled`, so a remote user saves only
`disabled`, `sessionTimeoutSeconds` and, if the groups are not locked,
`memberOfGroups`.
*/

interface Props {
  open: boolean
  username: string | null
  token: string | null
  cluster: ClusterState | null
  onClose: () => void
  /** The Users tab redraws its row; the Sessions tab reloads the list. */
  onSaved: (u: AdminUserDetails) => void
  onNotice: (a: Notice) => void
}


/* `sortTable('tbodyUserDetailsActiveSessions', 0..3)`. The fourth column, User
   Agent, is in each session's Details since 2026-11-06, so it no longer sorts. */
const KEYS: Keys<AdminSession> = {
  session: (s) =>
    [s.tokenName ?? '', `[${s.partialToken}]`, s.isCurrentSession ? '(current)' : '', s.type]
      .filter(Boolean)
      .join(' '),
  lastSeen: (s) => s.lastSeen,
  address: (s) => s.lastSeenRemoteAddress,
}

export function UserDetails({ open, username, token, cluster, onClose, onSaved, onNotice }: Props) {
  const [detail, setDetail] = useState<AdminUserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [newUser, setNewUser] = useState('')
  const [disabled, setDisabled] = useState(false)
  const [timeout, setTimeoutSeconds] = useState('')
  const [memberOf, setMemberOf] = useState('')
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const { rows: visibleSessions, sort, toggle } = useSort(KEYS, sessions)
  const [pendingDelete, setPendingDelete] = useState<AdminSession | null>(null)
  const [addGroup, setAddGroup] = useState(BLANK_OPTION)

  const load = useCallback(async () => {
    if (username == null) return
    setLoading(true)
    setNotice(null)
    const outcome = await getUser(token, username)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    const d = outcome.data.response
    setDetail(d)
    setDisplayName(d.displayName)
    setNewUser(d.username)
    setDisabled(d.disabled)
    setTimeoutSeconds(String(d.sessionTimeoutSeconds))
    setMemberOf(d.memberOfGroups.map((g) => `${g}\n`).join(''))
    setSessions(d.sessions)
    setAddGroup(BLANK_OPTION)
  }, [token, username])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const profileLocked = detail?.type === 'RemoteSSO' || detail?.type === 'RemoteLDAP'
  const groupsLocked = detail?.remotelyManagedGroups === true
  const typeLabel =
    detail?.type === 'RemoteSSO'
      ? 'Remote/SSO'
      : detail?.type === 'RemoteLDAP'
        ? 'Remote/LDAP'
        : (detail?.type ?? '')
  const totpLabel =
    detail?.type === 'RemoteSSO' ? 'SSO Managed' : detail?.totpEnabled ? 'Enabled' : 'Disabled'

  async function save() {
    if (detail == null || username == null) return

    // "if (sessionTimeoutSeconds === "") sessionTimeoutSeconds = 1800": it is
    // the modal's only field with a default value (auth.js:1424).
    const seconds = timeout === '' ? '1800' : timeout

    const body: Record<string, string> = {
      user: username,
      disabled: String(disabled),
      sessionTimeoutSeconds: seconds,
    }
    if (!profileLocked) {
      body.displayName = displayName
      if (newUser !== username) body.newUser = newUser
    }
    if (!groupsLocked) body.memberOfGroups = cleanList(memberOf)

    setBusy(true)
    const outcome = await setUser(token, body)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    onSaved(outcome.data.response)
    onClose()
    onNotice({ type: 'success', title: 'User Saved!', text: 'User details were saved successfully.' })
  }

  async function deleteSession(s: AdminSession) {
    setPendingDelete(null)
    // auth.js:1382. Here the `node` travels ONLY if the session is an API token.
    // The Sessions tab always sends it; this modal does not.
    const node = s.type === 'ApiToken' ? primaryNodeName(cluster) : undefined
    const outcome = await deleteAdminSession(token, s.partialToken, node)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    setSessions((list) => list.filter((x) => x.partialToken !== s.partialToken))
    setNotice({
      type: 'success',
      title: 'Session Deleted!',
      text: 'The user session was deleted successfully.',
    })
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        size="wide"
        title="User Details"
        actions={
          <>
            <Button variant="primary" disabled={busy || loading} onClick={() => void save()}>
              Save
            </Button>
          </>
        }
      >
        <Notifier notice={notice} onClose={() => setNotice(null)} />

        {loading || detail == null ? (
          <Loading />
        ) : (
          <DialogForm>
            {/* Who the account is: its two names on one line. */}
            <DialogPair>
              <MRow label="Display Name">
                {(id) => (
                  <Input
                    id={id}
                    value={displayName}
                    placeholder="display name"
                    maxLength={255}
                    disabled={profileLocked}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                )}
              </MRow>
              <MRow label="Username">
                {(id) => (
                  <Input
                    id={id}
                    value={newUser}
                    placeholder="username"
                    maxLength={255}
                    disabled={profileLocked}
                    onChange={(e) => setNewUser(e.target.value)}
                  />
                )}
              </MRow>
            </DialogPair>

            {/* How the account stands: what it is, its 2FA, whether it is off and
                how long its sessions last, together on the raised step. */}
            <DialogBlock>
              <DialogPair>
                <MValue label="Type" value={typeLabel} />
                <MValue label="2FA Status" value={totpLabel} />
              </DialogPair>
              <Check toggle label="Disable User Account" checked={disabled} onChange={setDisabled} />
              <MRow
                label="Session Timeout"
                width="short"
                suffix="seconds (valid range 0-604800; default 1800; set 0 to disable)"
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    placeholder="1800"
                    value={timeout}
                    onChange={(e) => setTimeoutSeconds(e.target.value)}
                  />
                )}
              </MRow>
            </DialogBlock>

            {/* The groups, one per line, and beside them the list that adds one
                to it (upstream's `optUserDetailsGroupList`). */}
            <DialogPair shape="wide">
              <MRow label="Member Of">
                {(id) => (
                  <Textarea
                    mono
                    id={id}
                    rows={5}
                    className={df.area}
                    disabled={groupsLocked}
                    value={memberOf}
                    onChange={(e) => setMemberOf(e.target.value)}
                  />
                )}
              </MRow>
              <MRow label="Add Group">
                {(id) => (
                  <Select
                    id={id}
                    disabled={groupsLocked}
                    value={addGroup}
                    onChange={(e) => {
                      setAddGroup(e.target.value)
                      setMemberOf((t) => addToList(t, e.target.value))
                    }}
                  >
                    <option value={BLANK_OPTION} />
                    <option value={NONE_OPTION}>None</option>
                    {(detail.groups ?? []).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                )}
              </MRow>
            </DialogPair>

            {/* The sessions as the Sessions tab draws them, one line each and the
                type in its colour, with three columns on the line and not four:
                at the dialog's 880 px the four asked about 850 px of table and
                every session stood as a block (measured again with the date and
                its age on the line: still too wide). How long ago it was seen and
                the user agent are under the row's Details. */}
            <DialogSection title="Active Sessions">
              <div>
                <Table
                  stack
                  header={
                    <>
                      <Th field="session" sort={sort} onSort={toggle}>Session</Th>
                      <Th field="lastSeen" sort={sort} onSort={toggle}>Last Seen</Th>
                      <Th field="address" sort={sort} onSort={toggle}>Remote Address</Th>
                      <th className={tbl.actionsCell} />
                    </>
                  }
                >
                  {visibleSessions.map((s) => (
                    <SessionLine key={s.partialToken} s={s} onDelete={() => setPendingDelete(s)} />
                  ))}
                </Table>
                <div className={styles.count}>
                  <span>{`Total Sessions: ${sessions.length}`}</span>
                </div>
              </div>
            </DialogSection>
          </DialogForm>
        )}
      </Dialog>

      <Confirm
        open={pendingDelete !== null}
        title="Delete Session"
        text={`Are you sure you want to delete the session [${pendingDelete?.partialToken ?? ''}] ?`}
        label="Delete"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void deleteSession(pendingDelete)}
      />
    </>
  )
}

/*
One session, one line, as `Administration > Sessions` draws it without its
username (the dialog is the user's), and with how long ago and the user agent
in its Details. Delete stays in the row's menu, as there and
as upstream's dropdown (`deleteUserSession`): in a console with no undo it keeps
the friction the rule asks for.
*/
function SessionLine({ s, onDelete }: { s: AdminSession; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const detail = useId()
  const k = sessionKind(s.type)
  return (
    <>
      <tr className={[s.isCurrentSession ? tbl.rowSelf : '', open ? lists.openRow : ''].filter(Boolean).join(' ') || undefined}>
        <td className={tbl.lead}>
          <span className={lists.sessionLine}>
            <span className={lists.kind} style={{ '--sw': k.colour } as CSSProperties}>{k.name}</span>
            {s.tokenName != null && <span className={lists.tokenName}>{s.tokenName}</span>}
            <span className={lists.partial}>{`[${s.partialToken}]`}</span>
            {s.isCurrentSession && <span className={lists.current}>(current)</span>}
          </span>
        </td>
        <td className={lists.mono}>{dateTime(s.lastSeen)}</td>
        <td className={lists.mono}>{s.lastSeenRemoteAddress}</td>
        <td className={tbl.actionsCell}>
          <div className={tbl.actions}>
            <RowAction
              icon={open ? 'chevronDown' : 'chevronRight'}
              name="Details"
              aria-expanded={open}
              aria-controls={detail}
              onClick={() => setOpen((v) => !v)}
            />
            <Menu label={`Actions for ${s.partialToken}`}>
              {(close) => (
                <button type="button" data-variant="danger" onClick={() => { close(); onDelete() }}>
                  Delete Session
                </button>
              )}
            </Menu>
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={lists.detailRow}>
          <td colSpan={4} className={lists.detailCell}>
            <dl className={lists.detail}>
              <div>
                <dt>Type</dt>
                <dd>{k.name}</dd>
              </div>
              <div>
                <dt>Last Seen</dt>
                <dd>
                  <span className={lists.from}>{dateTime(s.lastSeen)}</span>
                  <span className={lists.age}>{`(${fromNow(s.lastSeen)})`}</span>
                </dd>
              </div>
              <div className={lists.wide}>
                <dt>User Agent</dt>
                <dd className={lists.whole}>{s.lastSeenUserAgent}</dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}
