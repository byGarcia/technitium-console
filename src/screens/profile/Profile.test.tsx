import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Profile } from './Profile'
import { ThemeContext } from '../../theme/useTheme'
import * as client from '../../api/client'

/*
My Profile as a page (deviation 21). The assertions of the old dialog's tests
are kept here whole (the literal texts, the body of each call, who gets the name
locked, the 2FA wording by type), and the new page's pieces get their own.
*/

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

const ok = (data: unknown = { status: 'ok' }) => ({ kind: 'ok' as const, data })

const SESSIONS = [
  { username: 'admin', isCurrentSession: true, partialToken: 'aaa111', type: 'Standard', tokenName: null, lastSeen: '2026-08-25T14:33:26Z', lastSeenRemoteAddress: '10.0.1.42', lastSeenUserAgent: 'Chrome' },
  { username: 'admin', isCurrentSession: false, partialToken: 'bbb222', type: 'ApiToken', tokenName: 'orbiter', lastSeen: '2026-08-24T09:00:00Z', lastSeenRemoteAddress: '10.0.70.11', lastSeenUserAgent: 'curl' },
  { username: 'admin', isCurrentSession: false, partialToken: 'ccc333', type: 'Standard', tokenName: null, lastSeen: '2026-08-23T09:00:00Z', lastSeenRemoteAddress: '10.0.1.50', lastSeenUserAgent: 'Firefox' },
]

/* The v15.6.1 shape: `type` decides, `isSsoUser` is obsolete, and a `RemoteSSO`
   user carries no `totpEnabled` (WebServiceAuthApi.cs:137-146). */
const profile = (type: string, extra: Record<string, unknown> = {}) =>
  ok({
    status: 'ok',
    response: {
      displayName: 'Administrator',
      username: 'admin',
      type,
      isSsoUser: type === 'RemoteSSO',
      ...(type === 'RemoteSSO' ? {} : { totpEnabled: false }),
      disabled: false,
      recentSessionLoggedOn: '2026-08-25T14:33:26Z',
      recentSessionRemoteAddress: '10.0.1.42',
      previousSessionLoggedOn: '0001-01-01T00:00:00',
      previousSessionRemoteAddress: '0.0.0.0',
      memberOfGroups: ['Everyone', 'Administrators'],
      sessionTimeoutSeconds: 1800,
      sessions: SESSIONS,
      ...extra,
    },
  })

function mock(answer = profile('Local'), other: (path: string) => unknown = () => ok()) {
  return vi
    .spyOn(client, 'apiRequest')
    .mockImplementation(async (path: string) => (path === 'user/profile/get' ? answer : other(path)) as never)
}

async function loaded() {
  // The trail is drawn once the profile has arrived, on every tab.
  await screen.findByRole('navigation', { name: 'Breadcrumb' })
}

describe('My Profile: the form', () => {
  it('it lets a local user edit the name and sends it', async () => {
    const spy = mock()
    render(<Profile token="t" />)
    await loaded()
    expect(screen.getByLabelText('Type')).toHaveTextContent('Local')
    expect(screen.getByLabelText('Display Name')).toBeEnabled()
    expect(screen.getByLabelText('Username')).toHaveValue('admin')
    expect(screen.getByLabelText('Username')).toBeDisabled()
    // index.html:3734-3738: the range and the default beside the field.
    expect(screen.getByText('seconds (valid range 0-604800; default 1800; set 0 to disable)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800', displayName: 'Administrator' })
  })

  it('it disables the name for an SSO user and does NOT send it', async () => {
    const spy = mock(profile('RemoteSSO'))
    render(<Profile token="t" />)
    await loaded()
    expect(screen.getByLabelText('Type')).toHaveTextContent('Remote/SSO')
    expect(screen.getByLabelText('Display Name')).toBeDisabled()
    expect(screen.getByTestId('totp-status')).toHaveTextContent('SSO Managed')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800' })
  })

  it('an LDAP user has the name locked but its own 2FA status (auth.js:691-695)', async () => {
    const spy = mock(profile('RemoteLDAP', { totpEnabled: true }))
    render(<Profile token="t" />)
    await loaded()
    expect(screen.getByLabelText('Type')).toHaveTextContent('Remote/LDAP')
    expect(screen.getByLabelText('Display Name')).toBeDisabled()
    expect(screen.getByTestId('totp-status')).toHaveTextContent('Enabled')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800' })
  })

  it('the default branch writes the type as it arrives, and ignores `isSsoUser`', async () => {
    mock(profile('Future', { isSsoUser: true }))
    render(<Profile token="t" />)
    await loaded()
    expect(screen.getByLabelText('Type')).toHaveTextContent('Future')
    expect(screen.getByLabelText('Display Name')).toBeEnabled()
    expect(screen.getByTestId('totp-status')).toHaveTextContent('Disabled')
  })

  it('an empty session timeout travels as 1800 (auth.js:787-789)', async () => {
    const spy = mock()
    render(<Profile token="t" />)
    await loaded()
    await userEvent.clear(screen.getByLabelText('Session Timeout'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800', displayName: 'Administrator' })
  })

  it('a successful save says so on the page and hands over the name the SERVER returns (auth.js:803-811)', async () => {
    mock(profile('Local'), (path) =>
      path === 'user/profile/set' ? ok({ status: 'ok', response: { displayName: 'Admin From Server' } }) : ok(),
    )
    const onProfile = vi.fn()
    render(<Profile token="t" onProfile={onProfile} />)
    await loaded()
    await userEvent.clear(screen.getByLabelText('Display Name'))
    await userEvent.type(screen.getByLabelText('Display Name'), 'Typed')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('User profile was saved successfully.')).toBeInTheDocument()
    expect(screen.getByText('Profile Saved!')).toBeInTheDocument()
    expect(onProfile).toHaveBeenLastCalledWith({ displayName: 'Admin From Server', totpEnabled: false })
    expect(screen.getByRole('heading', { level: 1, name: 'Admin From Server' })).toBeInTheDocument()
  })

  it('a failed save says the server message and keeps what was typed', async () => {
    mock(profile('Local'), (path) =>
      path === 'user/profile/set' ? { kind: 'error' as const, message: 'boom' } : ok(),
    )
    render(<Profile token="t" />)
    await loaded()
    await userEvent.type(screen.getByLabelText('Display Name'), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByLabelText('Display Name')).toHaveValue('Administrator 2')
  })

  it('the load hands the name and the 2FA state to the account (auth.js:675-679)', async () => {
    mock(profile('Local', { displayName: 'Renamed', totpEnabled: true }))
    const onProfile = vi.fn()
    render(<Profile token="t" onProfile={onProfile} />)
    await screen.findByDisplayValue('Renamed')
    expect(onProfile).toHaveBeenCalledWith({ displayName: 'Renamed', totpEnabled: true })
  })

  it('a failed load says why on the page and draws no form', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'nope' } as never)
    render(<Profile token="t" />)
    expect(await screen.findByText('nope')).toBeInTheDocument()
    expect(screen.queryByLabelText('Display Name')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'My Profile' })).toBeInTheDocument()
  })

  it('a new revision and Refresh read the profile again', async () => {
    const spy = mock()
    const { rerender } = render(<Profile token="t" revision={0} />)
    await loaded()
    const reads = () => spy.mock.calls.filter((c) => c[0] === 'user/profile/get').length
    expect(reads()).toBe(1)
    rerender(<Profile token="t" revision={1} />)
    await waitFor(() => expect(reads()).toBe(2))
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(reads()).toBe(3))
  })
})

describe('My Profile: the header, the account panel and the tabs', () => {
  it('the header is the user: name, username and type', async () => {
    mock()
    render(<Profile token="t" />)
    await loaded()
    expect(screen.getByRole('heading', { level: 1, name: 'Administrator' })).toBeInTheDocument()
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumb).getByText('My Profile')).toBeInTheDocument()
  })

  it('Member Of lists the groups, and says No Group Found for none', async () => {
    mock()
    const { unmount } = render(<Profile token="t" />)
    await loaded()
    const list = screen.getByRole('list', { name: 'Member Of' })
    expect(within(list).getByText('Administrators')).toBeInTheDocument()
    expect(within(list).getByText('Everyone')).toBeInTheDocument()
    unmount()
    vi.restoreAllMocks()
    mock(profile('Local', { memberOfGroups: [] }))
    render(<Profile token="t" />)
    await loaded()
    expect(screen.getByText('No Group Found')).toBeInTheDocument()
  })

  it('Logins writes the recent one with its address, and a login that never happened as Never', async () => {
    mock()
    render(<Profile token="t" />)
    await loaded()
    expect(screen.getByText('Recent Login')).toBeInTheDocument()
    expect(screen.getByText('10.0.1.42', { selector: 'span span' })).toBeInTheDocument()
    expect(screen.getByText('Previous Login')).toBeInTheDocument()
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('a session type narrows the table, says so in the foot, and goes in the address bar', async () => {
    mock()
    render(<Profile token="t" sub="Sessions" />)
    await loaded()
    expect(screen.getByText('Total Sessions: 3')).toBeInTheDocument()
    const filter = screen.getByRole('group', { name: 'Session type' })
    const chip = within(filter).getByRole('button', { name: 'API Token' })
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 of 3 sessions, API Token only')).toBeInTheDocument()
    expect(screen.queryByText('[aaa111]')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?type=ApiToken')
    await userEvent.click(within(filter).getByRole('button', { name: 'All' }))
    expect(screen.getByText('Total Sessions: 3')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('a type in the address bar is read on arrival and dropped on leaving', async () => {
    window.history.replaceState(null, '', '/profile/sessions/?type=ApiToken')
    mock()
    const { unmount } = render(<Profile token="t" sub="Sessions" />)
    await loaded()
    expect(screen.getByText('1 of 3 sessions, API Token only')).toBeInTheDocument()
    unmount()
    expect(window.location.search).toBe('')
  })
})

describe('My Profile: the account actions', () => {
  it('opens the account menu dialogs', async () => {
    mock()
    const onOpen = vi.fn()
    render(<Profile token="t" sub="Security" onOpen={onOpen} />)
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    await userEvent.click(screen.getByRole('button', { name: 'Configure 2FA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create API Token' }))
    expect(onOpen.mock.calls.map((c) => c[0])).toEqual(['password', 'twofa', 'token'])
    expect(screen.getByText('1 token')).toBeInTheDocument()
  })

  it('follows the menu rules: LDAP has no password to change, SSO no 2FA either (main.js:71-87)', async () => {
    mock(profile('RemoteLDAP'))
    const { unmount } = render(<Profile token="t" sub="Security" />)
    await loaded()
    expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configure 2FA' })).toBeInTheDocument()
    unmount()
    vi.restoreAllMocks()
    mock(profile('RemoteSSO'))
    render(<Profile token="t" sub="Security" />)
    await loaded()
    expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Configure 2FA' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create API Token' })).toBeInTheDocument()
  })
})

describe('My Profile: active sessions', () => {
  it('it lists the sessions, their total, the current one and the types', async () => {
    mock()
    render(<Profile token="t" sub="Sessions" />)
    await loaded()
    expect(screen.getByText('Total Sessions: 3')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('10.0.1.42')).toBeInTheDocument()
    expect(within(table).getByText('(current)')).toBeInTheDocument()
    expect(within(table).getAllByText('Standard')).toHaveLength(2)
    expect(within(table).getByText('API Token')).toBeInTheDocument()
    expect(within(table).getByText('orbiter')).toBeInTheDocument()
    for (const h of ['Session', 'Last Seen', 'Remote Address', 'User Agent']) {
      expect(within(table).getByRole('button', { name: new RegExp(`^${h}`) })).toBeInTheDocument()
    }
  })

  it('Details opens the whole user agent under its row', async () => {
    mock()
    render(<Profile token="t" sub="Sessions" />)
    await loaded()
    const details = screen.getAllByRole('button', { name: 'Details' })[1]
    expect(details).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(details)
    expect(details).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('curl')).toHaveLength(2)
  })

  it('it asks for confirmation with the literal text before deleting', async () => {
    const spy = mock()
    render(<Profile token="t" sub="Sessions" />)
    await loaded()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete Session' })[1])
    expect(screen.getByText('Are you sure you want to delete the session [bbb222] ?')).toBeInTheDocument()
    expect(spy.mock.calls.some((c) => c[0] === 'user/session/delete')).toBe(false)
  })

  it('an API token is deleted with the primary node, empty on a standalone server (auth.js:835-838)', async () => {
    const spy = mock()
    render(<Profile token="t" sub="Sessions" />)
    await loaded()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete Session' })[1])
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Session' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/session/delete')
    expect(call?.[1]?.body).toEqual({ partialToken: 'bbb222', node: '' })
    expect(await screen.findByText('The user session was deleted successfully.')).toBeInTheDocument()
    expect(screen.getByText('Session Deleted!')).toBeInTheDocument()
    // The row leaves without reloading, as `deleteMySession` removes it.
    expect(screen.getByText('Total Sessions: 2')).toBeInTheDocument()
    expect(screen.queryByText('[bbb222]')).not.toBeInTheDocument()
    expect(spy.mock.calls.filter((c) => c[0] === 'user/profile/get')).toHaveLength(1)
  })

  it('on a cluster the token goes to the primary; a standard session goes with no node', async () => {
    const spy = mock()
    render(
      <Profile
        token="t"
        sub="Sessions"
        clusterInitialised
        nodes={[{ name: 'ns2.test', type: 'Secondary' }, { name: 'ns1.test', type: 'Primary' }] as never}
      />,
    )
    await loaded()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete Session' })[1])
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Session' }))
    await waitFor(() => expect(spy.mock.calls.some((c) => c[0] === 'user/session/delete')).toBe(true))
    expect(spy.mock.calls.find((c) => c[0] === 'user/session/delete')?.[1]?.body).toEqual({
      partialToken: 'bbb222',
      node: 'ns1.test',
    })
    await screen.findByText('Total Sessions: 2')
    spy.mockClear()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete Session' })[1])
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Session' }))
    await waitFor(() => expect(spy.mock.calls.some((c) => c[0] === 'user/session/delete')).toBe(true))
    expect(spy.mock.calls.find((c) => c[0] === 'user/session/delete')?.[1]?.body).toEqual({ partialToken: 'ccc333' })
  })

  it('a failed delete keeps the row and says the server message', async () => {
    mock(profile('Local'), (path) =>
      path === 'user/session/delete' ? { kind: 'error' as const, message: 'No such active session was found' } : ok(),
    )
    render(<Profile token="t" sub="Sessions" />)
    await loaded()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete Session' })[1])
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Session' }))
    expect(await screen.findByText('No such active session was found')).toBeInTheDocument()
    expect(screen.getByText('Total Sessions: 3')).toBeInTheDocument()
  })
})

describe('My Profile: the theme', () => {
  it('offers the Change Theme options and applies one on click, as the dialog does', async () => {
    mock()
    const setChoice = vi.fn()
    render(
      <ThemeContext.Provider value={{ choice: 'dark', resolved: 'dark', setChoice }}>
        <Profile token="t" sub="Theme" />
      </ThemeContext.Provider>,
    )
    await loaded()
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(group).getByLabelText('Dark Theme')).toBeChecked()
    expect(within(group).getByLabelText('Use System Theme (default)')).not.toBeChecked()
    await userEvent.click(within(group).getByLabelText('Light Theme'))
    expect(setChoice).toHaveBeenCalledWith('light')
  })

  it('a stored amber checks none (deviation 1)', async () => {
    mock()
    render(
      <ThemeContext.Provider value={{ choice: 'amber', resolved: 'dark', setChoice: () => {} }}>
        <Profile token="t" sub="Theme" />
      </ThemeContext.Provider>,
    )
    await loaded()
    for (const r of within(screen.getByRole('radiogroup', { name: 'Theme' })).getAllByRole('radio')) {
      expect(r).not.toBeChecked()
    }
  })
})
