import { useEffect, useRef, useState } from 'react'
import { deleteSession, getProfile, setProfile, type Profile as ProfileData, type SessionRow } from '../../api/user'
import { Button } from '../../ui/Button'
import { Confirm } from '../../ui/Confirm'
import { Loading } from '../../ui/Empty'
import { Field, Input } from '../../ui/Field'
import { Trailer } from '../../ui/PanelForm'
import { Panel } from '../../ui/Panel'
import { SectionHeader } from '../../ui/SectionHeader'
import { RowAction } from '../../ui/Table'
import { Tag } from '../../ui/Tag'
import { Notifier } from '../../ui/Notifier'
import { primaryNodeName, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import { AccountPanel } from './AccountPanel'
import { SessionsTable } from './SessionsTable'
import { ThemeChoice } from './ThemeChoice'
import {
  byKind,
  canChangePassword,
  canConfigure2fa,
  initial,
  isRemote,
  totpStatus,
  userType,
} from './profile'
import styles from './Profile.module.css'

/*
MY PROFILE IS A PAGE (deviation 21 in CONVENTIONS.md, 2026-11-06). Upstream's
`modalMyProfile` (index.html:3691-3786, `showMyProfileModal` / `saveMyProfile` /
`deleteMySession`, auth.js:660-866) is a dialog over whatever screen you were on.
Here it is `/profile/`, reached from the account menu's `My Profile`, and it is ONE
page with everything in view (2026-11-06, Adrián: four tabs were too many for so
little): the user as the header, then two columns. The main one, about two thirds,
is the sessions table (`SessionsTable.tsx`), whose toolbar also creates an API
token, since a token is a session of that type. The side one stacks four compact
panels: Profile (the dialog's form), Security, Account (`AccountPanel.tsx`) and
Theme (`ThemeChoice.tsx`). Under 1180 px they stack in the order Profile,
Security, Sessions, Account, Theme, which is the order they are written in.

It calls what the dialog called, and nothing else: `user/profile/get` on arrival
(and on Refresh, and after a dialog opened from here changes the account),
`user/profile/set` on Save, `user/session/delete` on a session. Change Password,
Configure 2FA and Create API Token open the account menu's own dialogs, unchanged.

What the dialog did and still holds, in its words:

  · the form's fields, labels, placeholders and order: Display Name (locked for
    a remote user, and then NOT sent, auth.js:794-797), Session Timeout with its
    `seconds (valid range 0-604800; default 1800; set 0 to disable)`; an empty
    timeout travels as 1800 (auth.js:787-789). Username and Type are not fields
    here: the header writes them, each named by its label for a screen reader;
  · the load writes the display name into the account menu and the 2FA state into
    the session (auth.js:675-679), and a save writes the name the SERVER returns;
  · `Profile Saved!` / `User profile was saved successfully.` on the page, as
    upstream puts it once its modal closes; a failure on the page too (there is no
    dialog to keep it in);
  · a session is deleted after upstream's sentence, `Are you sure you want to
    delete the session [<partial token>] ?`, and leaves the list without reloading
    it, as `deleteMySession` removes the row; `Session Deleted!` / `The user
    session was deleted successfully.`. An API token travels with `node`, the
    primary's name (`getPrimaryClusterNodeName`, empty on a standalone server).

What changes, all part of deviation 21: it is a page and not a dialog; Username,
Type and the 2FA Status are the header's; the `Member Of` table is tags in the
Account panel; the sessions table is a `ui/DataTable` with a type filter; nothing
takes the focus a second after the load (upstream focuses Display Name, which a
page that you scroll must not do); Security and the toolbar's Create API Token are
new places for what the account menu already offers.

Words OURS: `Profile`, `Security`, `Account` and `Password` as titles (`Theme` is
the Change Theme dialog's own label), and `2FA` before the header's status.
*/

export type AccountDialog = 'password' | 'twofa' | 'token'

/** The 2FA state's words the account needs (the menu, Change Password's OTP). */
export interface ProfileFacts {
  displayName: string
  totpEnabled: boolean
}

const TYPE_PARAM = 'type'

export function Profile({
  token,
  nodes = [],
  clusterInitialised = false,
  revision = 0,
  onProfile,
  onOpen,
}: {
  token: string | null
  nodes?: readonly ClusterNode[]
  clusterInitialised?: boolean
  /** Bumped by the Shell when a dialog opened from here changed the account. */
  revision?: number
  /** What the menu and the session take from a load or a save (auth.js:675-679, 804). */
  onProfile?: (facts: ProfileFacts) => void
  onOpen?: (dialog: AccountDialog) => void
}) {
  const [profile, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [timeout, setTimeoutSeconds] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<SessionRow | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [kind, setKind] = useState(() => readParam(TYPE_PARAM) ?? '')
  const onProfileRef = useRef(onProfile)
  onProfileRef.current = onProfile

  useEffect(() => {
    let live = true
    setLoading(true)
    void (async () => {
      const outcome = await getProfile(token)
      if (!live) return
      setLoading(false)
      if (outcome.kind === 'ok') {
        const p = outcome.data.response
        setProfileData(p)
        setDisplayName(p.displayName)
        setTimeoutSeconds(String(p.sessionTimeoutSeconds))
        onProfileRef.current?.({ displayName: p.displayName, totpEnabled: p.totpEnabled === true })
        return
      }
      if (outcome.kind !== 'invalid-token') setNotice(noticeFromFailure(outcome))
    })()
    return () => {
      live = false
    }
  }, [token, revision, reloadKey])

  /* The type filter travels in the address bar, as Cache's does (`?type=`). A type
     the sessions no longer hold is dropped once they land. */
  const sessions = profile?.sessions ?? []
  const present = byKind(sessions).map((k) => k.kind.key)
  const activeKind = profile != null && kind !== '' && !present.includes(kind) ? '' : kind
  useEffect(() => {
    if (profile == null) return
    writeParams({ [TYPE_PARAM]: activeKind === '' ? null : activeKind })
  }, [activeKind, profile])
  useEffect(() => () => dropParams([TYPE_PARAM]), [])

  const remote = profile != null && isRemote(profile)

  async function save() {
    if (!profile) return
    const body: Record<string, string> = { sessionTimeoutSeconds: timeout === '' ? '1800' : timeout }
    if (!remote) body.displayName = displayName

    setSaving(true)
    const outcome = await setProfile(token, body)
    setSaving(false)

    if (outcome.kind === 'ok') {
      const name = outcome.data.response?.displayName ?? displayName
      setProfileData({ ...profile, displayName: name })
      onProfile?.({ displayName: name, totpEnabled: profile.totpEnabled === true })
      setNotice({ type: 'success', title: 'Profile Saved!', text: 'User profile was saved successfully.' })
      return
    }
    if (outcome.kind === 'invalid-token') return
    setNotice(noticeFromFailure(outcome))
  }

  async function removeSession(row: SessionRow) {
    const node = row.type === 'ApiToken' ? primaryNodeName(nodes, clusterInitialised) : undefined
    setDeleting(row.partialToken)
    const outcome = await deleteSession(token, row.partialToken, node)
    setDeleting(null)
    if (outcome.kind === 'ok') {
      setProfileData((p) =>
        p == null ? p : { ...p, sessions: (p.sessions ?? []).filter((s) => s.partialToken !== row.partialToken) },
      )
      setNotice({ type: 'success', title: 'Session Deleted!', text: 'The user session was deleted successfully.' })
      return
    }
    if (outcome.kind === 'invalid-token') return
    setNotice(noticeFromFailure(outcome))
  }

  const title = profile == null ? 'My Profile' : profile.displayName || profile.username

  const totpTone = profile?.totpEnabled && profile.type !== 'RemoteSSO' ? 'ok' : 'neutral'

  return (
    <div className={styles.page}>
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={styles.identity}>
        {profile != null && (
          <span className={styles.avatar} aria-hidden="true">
            {initial(title)}
          </span>
        )}
        <div className={styles.identityHead}>
          <SectionHeader
            section={profile == null ? undefined : 'My Profile'}
            title={title}
            titleAction={
              <RowAction icon="refresh" name="Refresh" disabled={loading} onClick={() => setReloadKey((k) => k + 1)} />
            }
            labels={
              profile == null ? undefined : (
                /* Username and Type, the dialog's two read-only fields, and the
                   2FA Status: each a value named by upstream's label, which a
                   screen reader says and the eye does not need. */
                <dl className={styles.facts}>
                  <div>
                    <dt className={styles.hidden}>Username</dt>
                    <dd className={styles.username}>{profile.username}</dd>
                  </div>
                  <div>
                    <dt className={styles.hidden}>Type</dt>
                    <dd>
                      <Tag tone={remote ? 'info' : 'neutral'}>{userType(profile)}</Tag>
                    </dd>
                  </div>
                  <div>
                    <dt className={styles.hidden}>2FA Status</dt>
                    <dd data-testid="totp-status">
                      <Tag tone={totpTone}>2FA {totpStatus(profile)}</Tag>
                    </dd>
                  </div>
                </dl>
              )
            }
          />
        </div>
      </div>

      {profile == null ? (
        loading && <Loading />
      ) : (
        <div className={styles.layout}>
          <Panel title="Profile" className={styles.profileArea}>
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <Field label="Display Name">
                {(id) => (
                  <Input
                    id={id}
                    placeholder="display name"
                    maxLength={255}
                    value={displayName}
                    disabled={remote}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Session Timeout">
                {(id) => (
                  <div className={styles.timeout}>
                    <Input
                      id={id}
                      type="number"
                      placeholder="1800"
                      className={styles.num}
                      value={timeout}
                      onChange={(e) => setTimeoutSeconds(e.target.value)}
                    />
                    <Trailer>seconds (valid range 0-604800; default 1800; set 0 to disable)</Trailer>
                  </div>
                )}
              </Field>
              <div className={styles.formActions}>
                <Button type="submit" variant="primary" lead="save" disabled={saving}>
                  Save
                </Button>
              </div>
            </form>
          </Panel>

          <Panel title="Security" groups2 className={styles.securityArea}>
            <ul className={styles.lines}>
              {canChangePassword(profile) && (
                <li>
                  <span className={styles.lineName}>Password</span>
                  <Button size="sm" lead="lock" onClick={() => onOpen?.('password')}>
                    Change Password
                  </Button>
                </li>
              )}
              <li>
                <span className={styles.lineName}>2FA Status</span>
                <Tag tone={totpTone}>{totpStatus(profile)}</Tag>
                {canConfigure2fa(profile) && (
                  <Button size="sm" lead="shield" onClick={() => onOpen?.('twofa')}>
                    Configure 2FA
                  </Button>
                )}
              </li>
            </ul>
          </Panel>

          <div className={styles.sessionsArea}>
            <SessionsTable
              sessions={sessions}
              kind={activeKind}
              onKind={setKind}
              onDelete={setPendingDelete}
              onCreateToken={() => onOpen?.('token')}
              busy={deleting}
            />
          </div>

          <AccountPanel profile={profile} className={styles.accountArea} />
          <ThemeChoice className={styles.themeArea} />
        </div>
      )}

      <Confirm
        open={pendingDelete !== null}
        title="Delete Session"
        text={`Are you sure you want to delete the session [${pendingDelete?.partialToken ?? ''}] ?`}
        label="Delete Session"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeSession(pendingDelete)}
      />
    </div>
  )
}
