import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Block, Note, Notices, Radios, Warning } from '../../ui/PanelForm'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Field'
import { SectionHeader } from '../../ui/SectionHeader'
import { Loading } from '../../ui/Empty'
import { GroupRow, Row } from '../../ui/Form'
import { EditableTable } from '../../ui/EditableTable'
import {
  getLdapConfig,
  setLdapConfig,
  testLdapConnection,
  type LdapConfig,
} from '../../api/admin'
import { serializeTable, type Cell } from './table'
import {
  noticeFromFailure,
  Check,
  Confirm,
  adminStyles as styles,
  type Notice,
} from './parts'
import frm from '../../ui/Form.module.css'

/*
`refreshAdminLdapConfig`, `loadAdminLdapConfig`, `addAdminLdapGroupMapRow`,
`saveAdminLdapConfig` and `testAdminLdapConnection` (auth.js:2379-2570), new in
v15.5. It is the sibling of `Sso.tsx` and is built the same way on purpose: same
archetype, same primitives, same group-map table.

What the server does, and it governs this form (WebServiceAuthApi.cs:462-2164):

  1. **`admin/ldap/set` does NOT return `localGroups`** (line 2136 calls
     `WriteLdapConfig` with `includeGroups: false`; checked live against
     v15.5.1). Upstream survives through the `localGroups` global it filled on
     the `get`; here they are kept in state, exactly as SSO does.
  2. **The bind password arrives masked as `"************"`** (lines 471-474) and
     `SetLdapConfig` ignores that exact value (line 2101), so the field is filled
     with the mask and sent back as it is. `ldap/test` swaps the mask for the
     stored password (line 2159).
  3. **Five strings arrive `null` on a fresh install** (server, bind username,
     search base, filter and group attribute): jQuery's `.val(null)` draws them
     empty, and so does this.
  4. **An empty group map travels as the string `"false"`** (auth.js:2492-2493).

Validation order is contract: server, port (both only with LDAP enabled), the
group map, and only at the end the "Ignore SSL" confirmation. "Test Connection"
has its OWN validation: server and port always, whether LDAP is enabled or not,
and no group map nor confirmation (auth.js:2526-2541). The alerts come out on the
PAGE: upstream calls `showAlert` with no destination.

Two enable rules, both applied on load and on change (auth.js:212-222 and
2424, 2434):

  · "Ignore SSL Certificate Errors" is disabled when the SSL option is `None`.
    On load it compares the server's value itself, not the radio that ends up
    checked, so an unknown value checks `None` and leaves the box enabled. That
    is replicated.
  · "Allow Sign Up Only For Mapped Users" is disabled when "Allow New User Sign
    Up" is unchecked.

A disabled box is still READ when saving: upstream reads `.prop("checked")`, not
whether it is enabled, so both values always travel.
*/

interface Props {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  onNotice: (a: Notice) => void
}

interface GroupMapRow {
  remoteGroup: string
  localGroup: string
}

/*
The three blocks are upstream's own row labels (`index.html`, the `well` of
`adminTabPaneLdap`), promoted the same way SSO's were: "LDAP Authentication",
"LDAP User Sign Up" and "Group Map (Optional)". Nothing here is a new word.
*/
const SECTIONS = [
  { id: 'ldap-authentication', label: 'LDAP Authentication' },
  { id: 'ldap-user-sign-up', label: 'LDAP User Sign Up' },
  { id: 'ldap-group-map', label: 'Group Map (Optional)' },
]

/* The `rdLdapSslOption` group, each value and label as upstream writes them. */
const SSL_OPTIONS = [
  { value: 'None', label: 'None' },
  { value: 'StartTLS', label: 'StartTLS' },
  { value: 'LDAPS', label: 'LDAPS' },
]

/* auth.js:2409-2422: `StartTLS` and `LDAPS` check their radio; `None` AND anything
   else fall to `None`. */
function radioFor(option: string): string {
  switch (option) {
    case 'StartTLS':
    case 'LDAPS':
      return option
    default:
      return 'None'
  }
}

export function Ldap({ tabs, token, onNotice }: Props) {
  const [loading, setLoading] = useState(true)
  const [localGroups, setLocalGroups] = useState<string[]>([])
  const [enabled, setEnabled] = useState(false)
  const [server, setServer] = useState('')
  const [port, setPort] = useState('')
  const [sslOption, setSslOption] = useState('None')
  const [ignoreSsl, setIgnoreSsl] = useState(false)
  const [ignoreSslDisabled, setIgnoreSslDisabled] = useState(true)
  const [bindUsername, setBindUsername] = useState('')
  const [bindPassword, setBindPassword] = useState('')
  const [searchBase, setSearchBase] = useState('')
  const [userSearchFilter, setUserSearchFilter] = useState('')
  const [groupAttribute, setGroupAttribute] = useState('')
  const [allowSignup, setAllowSignup] = useState(false)
  const [onlyMapped, setOnlyMapped] = useState(false)
  const [groupMap, setGroupMap] = useState<GroupMapRow[]>([])
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  /* `loadAdminLdapConfig` (auth.js:2404-2441). */
  function apply(c: LdapConfig) {
    setEnabled(c.ldapEnabled)
    setServer(c.ldapServer ?? '')
    setPort(String(c.ldapPort))
    setSslOption(radioFor(c.ldapSslOption))
    // The server's value, not the radio (auth.js:2424).
    setIgnoreSslDisabled(c.ldapSslOption === 'None')
    setIgnoreSsl(c.ldapIgnoreSslErrors)
    setBindUsername(c.ldapBindUsername ?? '')
    setBindPassword(c.ldapBindPassword ?? '')
    setSearchBase(c.ldapSearchBase ?? '')
    setUserSearchFilter(c.ldapUserSearchFilter ?? '')
    setGroupAttribute(c.ldapGroupAttribute ?? '')
    setAllowSignup(c.ldapAllowSignup)
    setOnlyMapped(c.ldapAllowSignupOnlyForMappedUsers)
    setGroupMap(c.ldapGroupMap.map((g) => ({ ...g })))
    // `localGroups` only arrives on the `get`: kept when the `set` leaves it out.
    if (c.localGroups != null) setLocalGroups(c.localGroups)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await getLdapConfig(token)
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

  /* The radio's `change` handler (auth.js:212-216). */
  function chooseSsl(v: string) {
    setSslOption(v)
    setIgnoreSslDisabled(v === 'None')
  }

  /* `saveAdminLdapConfig` (auth.js:2460-2524). */
  function save(confirmed = false) {
    if (enabled && server === '') {
      onNotice({ type: 'warning', title: 'Missing!', text: 'Please enter the LDAP Server address.' })
      return
    }
    if (enabled && port === '') {
      onNotice({ type: 'warning', title: 'Missing!', text: 'Please enter the LDAP Port.' })
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

    if (!confirmed && ignoreSsl && sslOption !== 'None') {
      setConfirm(true)
      return
    }

    void submit(g.value === '' ? 'false' : g.value)
  }

  async function submit(ldapGroupMap: string) {
    setBusy(true)
    // The order of upstream's query string (auth.js:2507).
    const outcome = await setLdapConfig(token, {
      ldapEnabled: String(enabled),
      ldapServer: server,
      ldapPort: port,
      ldapSslOption: sslOption,
      ldapIgnoreSslErrors: String(ignoreSsl),
      ldapBindUsername: bindUsername,
      ldapBindPassword: bindPassword,
      ldapSearchBase: searchBase,
      ldapUserSearchFilter: userSearchFilter,
      ldapGroupAttribute: groupAttribute,
      ldapAllowSignup: String(allowSignup),
      ldapAllowSignupOnlyForMappedUsers: String(onlyMapped),
      ldapGroupMap,
    })
    setBusy(false)

    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    apply(outcome.data.response)
    onNotice({
      type: 'success',
      title: 'LDAP Config Saved!',
      text: 'LDAP authentication config was saved successfully.',
    })
  }

  /* `testAdminLdapConnection` (auth.js:2526-2570). */
  async function test() {
    if (server === '') {
      onNotice({ type: 'warning', title: 'Missing!', text: 'Please enter the LDAP Server address.' })
      return
    }
    if (port === '') {
      onNotice({ type: 'warning', title: 'Missing!', text: 'Please enter the LDAP Port.' })
      return
    }

    setTesting(true)
    const outcome = await testLdapConnection(token, {
      ldapServer: server,
      ldapPort: port,
      ldapSslOption: sslOption,
      ldapIgnoreSslErrors: String(ignoreSsl),
      ldapBindUsername: bindUsername,
      ldapBindPassword: bindPassword,
      ldapSearchBase: searchBase,
      ldapUserSearchFilter: userSearchFilter,
      ldapGroupAttribute: groupAttribute,
    })
    setTesting(false)

    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    onNotice({
      type: 'success',
      title: 'Test Successful!',
      text: 'LDAP connection test completed successfully.',
    })
  }

  if (loading) return <Loading />

  return (
    <>
      <SectionHeader title="Administration" tabs={tabs} />

      {/*
      The dense form of `Sso.tsx`, block for block. Upstream puts its two
      `Warning!` at the very end with the notes; the console's rule is `Warning!`
      before the controls and `Note!` after, so they head the first block, which
      is also the block that holds "Ignore SSL Certificate Errors", the control
      the first of them is about.
      */}
      <div>
        <div id={SECTIONS[0].id}>
          <Block
            title="LDAP Authentication"
            notices={
              <>
                <Warning>
                  The Ignore SSL Certificate Errors option is not secure and should be used only for
                  testing purposes.
                </Warning>
                <Warning>
                  Any DNS related failure may cause LDAP authentication to fail to work making it
                  impossible for LDAP users to log in to fix the DNS issue due to circular
                  dependency. Thus, it is recommended to maintain a local administrator user account
                  for such scenarios.
                </Warning>
              </>
            }
          >
            <div className={frm.row}>
              <div />
              <Check
                toggle
                label="Enable LDAP Authentication"
                checked={enabled}
                onChange={setEnabled}
                help="Enable to allow users from an LDAP directory (Active Directory, OpenLDAP, etc.) to log in using their directory credentials."
              />
            </div>

            <LdapField
              label="LDAP Server"
              help="Domain name or IP address of the LDAP server."
              value={server}
              placeholder="ldap.example.com"
              maxLength={255}
              onChange={setServer}
            />

            <Row label="Port">
              {(id) => (
                <div className={styles.ctlLine}>
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={65535}
                    value={port}
                    placeholder="389"
                    onChange={(e) => setPort(e.target.value)}
                    style={{ width: 100 }}
                  />
                  <span className={styles.suffix}>
                    (default 389 for plain LDAP/StartTLS; default 636 for LDAPS)
                  </span>
                </div>
              )}
            </Row>

            <GroupRow label="SSL Options">
              <Radios
                name="rdLdapSslOption"
                value={sslOption}
                options={SSL_OPTIONS}
                onChange={chooseSsl}
              />
            </GroupRow>

            <div className={frm.row}>
              <div />
              <Check
                toggle
                label="Ignore SSL Certificate Errors"
                checked={ignoreSsl}
                disabled={ignoreSslDisabled}
                onChange={setIgnoreSsl}
              />
            </div>

            <LdapField
              label="Bind Username"
              help="The Distinguished Name (DN) or User Principal Name (UPN) of a service account used to search the directory. Leave empty for anonymous bind."
              value={bindUsername}
              placeholder="CN=svcDNS,OU=ServiceAccounts,DC=example,DC=com"
              maxLength={512}
              onChange={setBindUsername}
            />
            <LdapField
              label="Bind Password"
              help="The password for the above bind service account."
              value={bindPassword}
              placeholder="service account password"
              type="password"
              maxLength={255}
              onChange={setBindPassword}
            />
            <LdapField
              label="Search Base"
              help="The base Distinguished Name (DN) used to search for user entries."
              value={searchBase}
              placeholder="DC=example,DC=com"
              maxLength={512}
              onChange={setSearchBase}
            />
            <LdapField
              label="User Search Filter"
              help={
                <>
                  The LDAP search filter used to find the user. Use <code>{'{0}'}</code> as a
                  placeholder for the username. Use default <code>{'(sAMAccountName={0})'}</code> for
                  Active Directory and <code>{'(uid={0})'}</code> for OpenLDAP. Use{' '}
                  <code>{'(userPrincipalName={0})'}</code> if usernames in the directory are stored
                  under &apos;userPrincipalName&apos; attribute.
                </>
              }
              value={userSearchFilter}
              placeholder="(sAMAccountName={0})"
              maxLength={512}
              onChange={setUserSearchFilter}
            />
            <LdapField
              label="Group Attribute"
              help={
                <>
                  The user attribute listing group memberships. Use default <code>memberOf</code> for
                  Active Directory.
                </>
              }
              value={groupAttribute}
              placeholder="memberOf"
              maxLength={255}
              onChange={setGroupAttribute}
            />
          </Block>
        </div>

        <div id={SECTIONS[1].id}>
          <Block title="LDAP User Sign Up">
            <div className={frm.row}>
              <div />
              <div className={styles.group}>
                <Check
                  toggle
                  label="Allow New User Sign Up"
                  checked={allowSignup}
                  onChange={setAllowSignup}
                  help="Enable to allow automatically provisioning of user accounts for new users signing in via LDAP. Keep this option disabled if you do not expect new LDAP users to sign up."
                />
                {/* auth.js:218-222 and 2434: off while sign-up is off. */}
                <Check
                  toggle
                  label="Allow Sign Up Only For Mapped Users"
                  checked={onlyMapped}
                  disabled={!allowSignup}
                  onChange={setOnlyMapped}
                  help={
                    <>
                      Enable to allow a new user to sign up via LDAP only when the user is a member of
                      at least one Remote Group that is mapped to a Local Group in the{' '}
                      <b>Group Map</b> option below. This option allows LDAP administrators to
                      restrict LDAP users to control who can sign up and get access based on their
                      group memberships.
                    </>
                  }
                />
              </div>
            </div>
          </Block>
        </div>

        <div id={SECTIONS[2].id}>
          <Block title="Group Map (Optional)">
            <div className={styles.list}>
              <EditableTable
                className={styles.edit}
                header={
                  <>
                    <th>Remote Group (CN)</th>
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
                        aria-label={`Remote Group (CN) ${i + 1}`}
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
                {/* `addAdminLdapGroupMapRow('', '')`: no option matches `''`, so
                    the browser shows the first one, which is what travels. */}
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
                Map Remote Groups (CN) at directory service to Local Groups for both new and existing
                users signed up via LDAP. A LDAP user&apos;s group membership will be automatically
                synced to the mapped Local Groups each time they log in.
              </div>
            </div>
          </Block>
        </div>

        {/* The seven `Note!`, after the controls, in an untitled block as SSO's. */}
        <Block>
          <Notices>
            <Note>
              LDAP authentication works by binding to the directory with a service account to locate
              the user, then re-binding as that user to validate credentials.
            </Note>
            <Note>
              LDAP authentication will work only when all of the required parameters are configured
              correctly. If it does not work for any reason, check the Logs section on the panel and
              search for related error logs.
            </Note>
            <Note>
              A LDAP user wont be able to sign up if it&apos;s username is already taken by an
              existing local or SSO user.
            </Note>
            <Note>
              LDAP users can enable Two-Factor Authentication (2FA) such that credentials are
              validated by the directory service while 2FA is validated by the DNS Server on each
              login.
            </Note>
            <Note>
              The LDAP user&apos;s Display Name is managed via the directory service and it is
              automatically synced each time a user logs in.
            </Note>
            <Note>
              When Group Map is configured, the LDAP user&apos;s group membership cannot be managed
              locally and any group membership changes must be configured at the directory service
              itself. LDAP users need to relogin so that any group membership changes made at the
              directory service are applied to their user accounts. The Group Map thus allows
              managing user access centrally via the directory service. Keep the Group Map empty if
              group membership management for LDAP users is required to be managed via the DNS
              Server itself.
            </Note>
            <Note>
              The domain name used for LDAP Server above will be resolved by the DNS Server
              internally only. Thus, make sure that the DNS Server is able to resolve the configured
              domain name. Adding hosts file entries in the host OS will not work.
            </Note>
          </Notices>
        </Block>
      </div>

      <div className={styles.bar}>
        <Button variant="primary" disabled={busy} onClick={() => save()}>
          Save Config
        </Button>
        <Button disabled={testing} onClick={() => void test()}>
          Test Connection
        </Button>
      </div>

      <Confirm
        open={confirm}
        title="Save Config"
        text={
          'WARNING! The Ignore SSL Certificate Errors option must not be enabled for production environment. \n\nAre you sure you want to proceed with ignoring SSL certificate errors?'
        }
        label="OK"
        variant="primary"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          save(true)
        }}
      />
    </>
  )
}

/* A text field of this screen: `ui/Form`'s row with the `Input`, as `SsoField`. */
function LdapField({
  label,
  help,
  value,
  placeholder,
  type,
  maxLength,
  onChange,
}: {
  label: string
  help: ReactNode
  value: string
  placeholder: string
  type?: 'password'
  maxLength: number
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
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', maxWidth: 420 }}
        />
      )}
    </Row>
  )
}
