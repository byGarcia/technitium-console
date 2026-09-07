import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Block, Note, Notices, Warning } from '../../ui/PanelForm'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Field'
import { SectionHeader } from '../../ui/SectionHeader'
import { Loading } from '../../ui/Empty'
import { getSsoConfig, setSsoConfig, type SsoConfig } from '../../api/admin'
import { serializeTable, type Cell } from './table'
import {
  noticeFromFailure,
  Check,
  Confirm,
  adminStyles as styles,
  type Notice,
} from './parts'
import { EditableTable } from '../../ui/EditableTable'
import { Row } from '../../ui/Form'
import frm from '../../ui/Form.module.css'

/*
`refreshAdminSsoConfig`, `loadAdminSsoConfig` and `saveAdminSsoConfig`
(auth.js:2152-2313). This is the screen that CONFIGURES SSO; signing in through
SSO is already solved in phase 2 and is not touched here.

Four things about the server that govern this form:

  1. **`admin/sso/set` does NOT return `localGroups`** (WebServiceAuthApi.cs:1790
     calls `WriteSsoConfig` with `includeGroups: false`). Upstream survives
     because it saved them into a global variable when doing the `get`; here they
     are kept just the same, in state, and the save only refreshes the rest.
  2. **The secret arrives masked as `"************"`** and the server IGNORES
     that exact value when saving (lines 339-342 and 1738). That is why the field
     is filled with the mask and resent as it is: it is what allows saving
     without typing the secret again.
  3. **The three validations above only apply with SSO ENABLED.** With the box
     unchecked everything can be saved empty.
  4. **An empty table travels as the string `"false"`**, not empty (auth.js:2265
     and 2280): it comes out of concatenating a boolean into the query.

And an order that is contract: authority, client, secret, scopes, group map, and
only at the end the two `http:` confirmations. This screen's alerts come out on
the PAGE, not in a modal: upstream calls `showAlert` with no destination.
*/

interface Props {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  onNotice: (a: Notice) => void
}

interface GroupListRow {
  remoteGroup: string
  localGroup: string
}

/*
The four sections of this form, and their four names are upstream's own: they were
the labels of its four groups (`index.html`, the `well` of `adminTabPaneSso`).
Nothing here is a new word.

## And why there is no index beside them, which pilot 3 did ask for

Because it costs the dense form its single geometry, and that was measured rather
than argued. With `ui/SectionIndex` in a column here, `dev/uniformity.js` reported
`reticula-panel` at THREE signatures instead of two: `210px 354px 360px` on this
screen against `210px 542px 360px` on Settings' eight panes. The 188 px are the
index column and its gap.

Settings is the same archetype, is already built and deployed, and has no index —
phase 2 left `SectionIndex` written and unwired on purpose. Wiring it on one of
the two dense forms and not the other means the same `Row` renders at two widths
across the console, which is exactly what that tool exists to catch. It is the
same call the tool round made about the padlock pill: a change that obliges
rebuilding a screen that is already done is not a change this round takes.

So the index is DEFERRED, with its condition written down: it goes on Settings and
on SSO together, or on neither. `Permissions` does keep one, and that costs
nothing measured — it has no `Row` grid at all.
*/
const SECTIONS = [
  { id: 'sso-single-sign-on', label: 'Single Sign-On (SSO)' },
  { id: 'sso-user-sign-up', label: 'SSO User Sign Up' },
  { id: 'sso-scopes', label: 'Scopes' },
  { id: 'sso-group-map', label: 'Group Map (Optional)' },
]

export function Sso({ tabs, token, onNotice }: Props) {
  const [loading, setLoading] = useState(true)
  const [localGroups, setLocalGroups] = useState<string[]>([])
  const [enabled, setEnabled] = useState(false)
  const [authority, setAuthority] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [metadata, setMetadata] = useState('')
  const [scopes, setScopes] = useState<string[]>([])
  const [allowSignup, setAllowSignup] = useState(false)
  const [onlyMapped, setOnlyMapped] = useState(false)
  const [groupMap, setGroupMap] = useState<GroupListRow[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'authority' | 'metadata'>(null)

  function apply(c: SsoConfig) {
    setEnabled(c.ssoEnabled)
    setAuthority(c.ssoAuthority ?? '')
    setClientId(c.ssoClientId ?? '')
    setClientSecret(c.ssoClientSecret ?? '')
    setMetadata(c.ssoMetadataAddress ?? '')
    setScopes(c.ssoScopes)
    setAllowSignup(c.ssoAllowSignup)
    setOnlyMapped(c.ssoAllowSignupOnlyForMappedUsers)
    setGroupMap(c.ssoGroupMap.map((g) => ({ ...g })))
    // `localGroups` only arrives on the `get`: if it does not come, the one already
    // there is kept instead of emptying the group map's dropdowns.
    if (c.localGroups != null) setLocalGroups(c.localGroups)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await getSsoConfig(token)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    apply(outcome.data.response)
  }, [token, onNotice])

  useEffect(() => {
    void load()
  }, [load])

  /*
  `loadAdminSsoConfig` (auth.js:2196-2204): the Redirect URI that has to be
  registered with the provider is computed in the browser from the current URL,
  appending `sso/callback` with a single slash.
  */
  const redirectUri = (() => {
    const base = `${window.location.protocol}//${window.location.host}${window.location.pathname}`
    return base.endsWith('/') ? `${base}sso/callback` : `${base}/sso/callback`
  })()

  function save(saltarAuthority = false, saltarMetadata = false) {
    if (enabled && authority === '') {
      onNotice({ type: 'warning', title: 'Missing!', text: 'Please enter the Authority URL.' })
      return
    }
    if (enabled && clientId === '') {
      onNotice({ type: 'warning', title: 'Missing!', text: 'Please enter the Client ID.' })
      return
    }
    if (enabled && clientSecret === '') {
      onNotice({ type: 'warning', title: 'Missing!', text: 'Please enter the Client Secret.' })
      return
    }

    const s = serializeTable(scopes.map((v): Cell[] => [{ type: 'text', value: v }]))
    if (!s.ok) {
      onNotice({ type: 'warning', title: s.failure.title, text: s.failure.text })
      return
    }

    const g = serializeTable(
      groupMap.map((f): Cell[] => [
        { type: 'text', value: f.remoteGroup },
        { type: 'text', value: f.localGroup },
      ]),
    )
    if (!g.ok) {
      onNotice({ type: 'warning', title: g.failure.title, text: g.failure.text })
      return
    }

    if (!saltarAuthority && authority.startsWith('http:')) {
      setConfirm('authority')
      return
    }
    if (!saltarMetadata && metadata.startsWith('http:')) {
      setConfirm('metadata')
      return
    }

    void submit(s.value === '' ? 'false' : s.value, g.value === '' ? 'false' : g.value)
  }

  async function submit(ssoScopes: string, ssoGroupMap: string) {
    setBusy(true)
    const outcome = await setSsoConfig(token, {
      ssoEnabled: String(enabled),
      ssoAuthority: authority,
      ssoClientId: clientId,
      ssoClientSecret: clientSecret,
      ssoMetadataAddress: metadata,
      ssoScopes,
      ssoAllowSignup: String(allowSignup),
      ssoAllowSignupOnlyForMappedUsers: String(onlyMapped),
      ssoGroupMap,
    })
    setBusy(false)

    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    apply(outcome.data.response)
    onNotice({
      type: 'success',
      title: 'SSO Config Saved!',
      text: 'Single Sign-On (SSO) config was saved successfully.',
    })
  }

  if (loading) return <Loading />


  return (
    <>
      <SectionHeader
        title="Administration"
        tabs={tabs}
      />

      {/*
      Pilot 3's dense form, as it stands: help in its third column, `Warning!`
      before the controls and `Note!` after, the index beside and the save bar
      stuck to the bottom.

      The four blocks ARE upstream's four groups, and their titles are the four
      labels it already wrote —`Single Sign-On (SSO)`, `SSO User Sign Up`,
      `Scopes`, `Group Map (Optional)`—. Not one of them is new: what changed is
      which component carries them. They used to be the label of a row; being four
      groups and not one, they are what the screen is divided into, and a screen
      with four sections and no headings cannot be indexed.

      There is no `Cluster Node` here, nor a gap where one would go: that selector
      belongs to `Sessions` and to `Cluster`.
      */}
      <div>
        <div>
          <div id={SECTIONS[0].id}>
            <Block
              title="Single Sign-On (SSO)"
              notices={
                <>
                  <Warning>
                    All URLs configured above must use <code>https</code> URL scheme for production
                    environments. Using <code>http</code> URL scheme is not secure and should be used
                    only for testing purposes.
                  </Warning>
                  <Warning>
                    Any DNS related failure may cause Single Sign-On (SSO) to fail to work making it
                    impossible for SSO users to log in to fix the DNS issue due to circular
                    dependency. Thus, it is recommended to maintain a local administrator user
                    account for such scenarios.
                  </Warning>
                </>
              }
            >
              {/* The block's title is this control's label, so the label column
                  stays empty rather than saying it twice. The grid is kept: the
                  switch has to line up with the four fields under it. */}
              <div className={frm.row}>
                <div />
                <Check
                  toggle
                  label="Enable Single Sign-On (SSO)"
                  checked={enabled}
                  onChange={setEnabled}
                  help="Enable to allow Single Sign-On (SSO) with OpenID Connect (OIDC)."
                />
              </div>

              <SsoField
                label="Authority (Issuer)"
                help="The OpenID Connect (OIDC) Authority URL."
                value={authority}
                placeholder="https://auth.example.com"
                onChange={setAuthority}
              />
              <SsoField
                label="Client ID"
                help="The OpenID Connect (OIDC) Client ID."
                value={clientId}
                placeholder="client id"
                onChange={setClientId}
              />
              <SsoField
                label="Client Secret"
                help="The OpenID Connect (OIDC) Client Secret."
                value={clientSecret}
                placeholder="client secret"
                type="password"
                onChange={setClientSecret}
              />
              <SsoField
                label="Metadata Address (Optional)"
                help="The OpenID Connect (OIDC) metadata discovery URL to be used instead of the default one. Configure this option only if the Single Sign-On (SSO) provider uses a different discovery URL."
                value={metadata}
                placeholder="https://auth.example.com/.well-known/openid-configuration"
                onChange={setMetadata}
              />
            </Block>
          </div>

          <div id={SECTIONS[1].id}>
            <Block title="SSO User Sign Up">
              <div className={frm.row}>
                <div />
                <div className={styles.group}>
                  <Check
                    toggle
                    label="Allow New User Sign Up"
                    checked={allowSignup}
                    onChange={setAllowSignup}
                    help="Enable to allow automatically provisioning of user accounts for new users signing in via Single Sign-On (SSO). Keep this option disabled if you do not expect new SSO users to sign up."
                  />
                  <Check
                    toggle
                    label="Allow Sign Up Only For Mapped Users"
                    checked={onlyMapped}
                    onChange={setOnlyMapped}
                    help={
                      <>
                        Enable to allow a new user to sign up via Single Sign-On (SSO) only when the
                        user is a member of at least one Remote Group that is mapped to a Local Group
                        in the <b>Group Map</b> option below. This option allows SSO administrators
                        to restrict SSO users to control who can sign up and get access based on
                        their group memberships.
                      </>
                    }
                  />
                </div>
              </div>
            </Block>
          </div>

          <div id={SECTIONS[2].id}>
            <Block title="Scopes">
              <div className={styles.list}>
                <EditableTable
                  className={styles.edit}
                  header={
                    <>
                      <th>Scope Name</th>
                      <th className={styles.tdel} />
                    </>
                  }
                >
                  {scopes.map((s, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={i}>
                      <td>
                        <Input
                          aria-label={`Scope Name ${i + 1}`}
                          value={s}
                          onChange={(e) =>
                            setScopes((list) => list.map((v, j) => (j === i ? e.target.value : v)))
                          }
                        />
                      </td>
                      <td className={styles.tdel}>
                        <Button
                          variant="danger"
                          onClick={() => setScopes((list) => list.filter((_, j) => j !== i))}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </EditableTable>
                <div>
                  <Button onClick={() => setScopes((list) => [...list, ''])}>Add</Button>
                </div>
                {/*
                This help and the Group Map one are NOT among the 27 the census
                counts, and they are kept: both are upstream literals —checked
                against the `ref` instance— that the census misses because they
                carry markup and travel as JSX children instead of as a `help=`
                prop. The delivery retired them from the drawing for exactly that
                reason, which was right for a drawing that could not read the
                source; dropping them from the product would be losing two helps.
                */}
                <div className={styles.help}>
                  Enter the scopes to be sent to the Single Sign-On (SSO) provider. The scopes{' '}
                  <code>openid</code> and <code>profile</code> are mandatory and will be
                  automatically added if missing. Add the scope <code>email</code> if you want to use
                  email address as the username for all SSO users that sign up for an account.
                </div>
              </div>
            </Block>
          </div>

          <div id={SECTIONS[3].id}>
            <Block title="Group Map (Optional)">
              <div className={styles.list}>
                <EditableTable
                  className={styles.edit}
                  header={
                    <>
                      <th>Remote Group</th>
                      <th>Local Group</th>
                      <th className={styles.tdel} />
                    </>
                  }
                >
                  {groupMap.map((f, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={i}>
                      <td>
                        <Input
                          aria-label={`Remote Group ${i + 1}`}
                          value={f.remoteGroup}
                          onChange={(e) =>
                            setGroupMap((list) =>
                              list.map((x, j) =>
                                j === i ? { ...x, remoteGroup: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Select
                          className={styles.select}
                          aria-label={`Local Group ${i + 1}`}
                          value={f.localGroup}
                          onChange={(e) =>
                            setGroupMap((list) =>
                              list.map((x, j) =>
                                j === i ? { ...x, localGroup: e.target.value } : x,
                              ),
                            )
                          }
                        >
                          {localGroups.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className={styles.tdel}>
                        <Button
                          variant="danger"
                          onClick={() => setGroupMap((list) => list.filter((_, j) => j !== i))}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </EditableTable>
                <div>
                  <Button
                    onClick={() =>
                      setGroupMap((list) => [
                        ...list,
                        { remoteGroup: '', localGroup: localGroups[0] ?? '' },
                      ])
                    }
                  >
                    Add
                  </Button>
                </div>
                <div className={styles.help}>
                  Map Remote Groups at Single Sign-On (SSO) provider to Local Groups for both new and
                  existing users signed up via Single Sign-On (SSO). A SSO user&apos;s group
                  membership will be automatically synced to the mapped Local Groups each time they
                  log in. If your SSO provider does not include group membership claim by default
                  then you will have to add <code>groups</code> or <code>roles</code> scope in the{' '}
                  <b>Scopes</b> option above as required by the SSO provider.
                </div>
              </div>
            </Block>
          </div>

          {/*
          The eight `Note!` after the controls: they explain, they do not change
          the decision — the two `Warning!` went up into the first block.

          They go inside an untitled `Block` and not loose on the page, and that
          too came out of `dev/uniformity.js`: loose, `notice-info` split into a
          third signature —«loose on the page» against «15px from the panel»— for
          an alert that is the same alert. In Settings the notices live inside
          their block; these belong to the whole screen and not to any one of the
          four, so the block that holds them has no title.
          */}
          <Block>
          <Notices>
            <Note>
              The Single Sign-On (SSO) uses <code>/sso/callback</code> as the callback path. Thus,
              your SSO Redirect URI for this DNS Server should be <code>{redirectUri}</code> which
              needs to be configure with the SSO provider.
            </Note>
            <Note>
              Single Sign-On (SSO) will be enabled only when all of the required parameters are
              configured correctly. If SSO does not work for any reason, check the Logs section on
              the panel and search for related error logs.
            </Note>
            <Note>
              When a Single Sign-On (SSO) user signs up with the DNS Server, an account for the user
              is created which uses the email address as the username. If email address is not
              available, the preferred username is used instead. If you do not wish to use email
              address as the username, you can remove the <code>email</code> scope from the{' '}
              <b>Scopes</b> option above.
            </Note>
            <Note>
              The Single Sign-On (SSO) user&apos;s Display Name and Username are managed via the SSO
              provider and they are automatically synced each time a user logs in.
            </Note>
            <Note>
              When Group Map is configured, the Single Sign-On (SSO) user&apos;s group membership
              cannot be managed locally and any group membership changes must be configured at the
              SSO provider itself. SSO users need to relogin so that any group membership changes
              made at SSO provider are applied to their user accounts. The Group Map thus allows
              managing user access centrally via the SSO provider. Keep the Group Map empty if group
              membership management for SSO users is required to be managed via the DNS Server
              itself.
            </Note>
            <Note>
              The Web Service will be automatically restarted to apply these changes thus there is no
              need to restart the DNS Server manually.
            </Note>
            <Note>
              When using a reverse proxy with the Web Service, you need to add{' '}
              <code>X-Forwarded-Proto</code> and <code>X-Forwarded-Host</code> headers to proxy
              request to allow the Web Service to correctly form the SSO Redirect URI. If the reverse
              proxy is setup to use a path prefix then make sure to add the{' '}
              <code>X-Forwarded-Prefix</code> header to proxy request too. These headers will be read
              only if the reverse proxy IP address is configured to be allowed in the{' '}
              <b>Reverse Proxy Addresses</b> option in Settings &gt; Web Service section. For
              example, if you are using nginx as the reverse proxy with a path prefix of{' '}
              <code>/dns</code>, then you should add the following headers:{' '}
              <code>proxy_set_header X-Forwarded-Proto $scheme;</code>,{' '}
              <code>proxy_set_header X-Forwarded-Host $host;</code>,{' '}
              <code>proxy_set_header X-Forwarded-Prefix /dns;</code>, and{' '}
              <code>proxy_redirect / /dns/;</code>
            </Note>
            <Note>
              Domain names in all of the URLs configured above will be resolved by the DNS Server
              internally only. Thus, make sure that the DNS Server is able to resolve the domain name
              in the URL. Adding <code>hosts</code> file entries in the host OS will not work.
            </Note>
          </Notices>
          </Block>
        </div>

      </div>

      <div className={styles.bar}>
        <Button variant="primary" disabled={busy} onClick={() => save()}>
          Save Config
        </Button>
      </div>

      <Confirm
        open={confirm === 'authority'}
        title="Save Config"
        text="WARNING! The SSO Authority must use a 'https' URL scheme for production environment. Are you sure you want to proceed with using a 'http' URL scheme?"
        label="OK"
        variant="primary"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          save(true)
        }}
      />
      <Confirm
        open={confirm === 'metadata'}
        title="Save Config"
        text="WARNING! The Metadata Address must use a 'https' URL scheme for production environment. Are you sure you want to proceed with using a 'http' URL scheme?"
        label="OK"
        variant="primary"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          save(true, true)
        }}
      />
    </>
  )
}


/*
A text field of this screen. The row is `ui/Form`'s; what is left here is only
what belongs to it: the `Input` and its width. This used to be a FOURTH copy of
the row —the other three were in the Settings, DHCP and Administration parts—
each with its own `useId` and its own layout.
*/
function SsoField({
  label,
  help,
  value,
  placeholder,
  type,
  onChange,
}: {
  label: string
  help: string
  value: string
  placeholder: string
  type?: 'password'
  onChange: (v: string) => void
}) {
  return (
    <Row label={label} help={help}>
      {(id) => (
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          maxLength={255}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', maxWidth: 420 }}
        />
      )}
    </Row>
  )
}
