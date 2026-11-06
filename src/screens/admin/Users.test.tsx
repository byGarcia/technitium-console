import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Users } from './Users'
import * as client from '../../api/client'
import { USER_DETAIL, ADMIN_USER, NEW_USER, SSO_USER, LDAP_USER } from './admin.fixture'
import { choose } from '../../test/dropdown'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

function server(users = [ADMIN_USER, NEW_USER], detail = USER_DETAIL) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string, opts) => {
    if (path === 'admin/users/list') return ok({ response: { users: users }, server: 'x' })
    if (path === 'admin/users/get') return ok({ response: detail, server: 'x' })
    if (path === 'admin/users/set') {
      const body = (opts?.body ?? {}) as Record<string, string>
      return ok({
        response: { ...detail, disabled: body.disabled === 'true', totpEnabled: false },
        server: 'x',
      })
    }
    if (path === 'admin/users/create') {
      return ok({ response: { ...NEW_USER, username: 'newuser' }, server: 'x' })
    }
    return ok({ response: {}, server: 'x' })
  })
}

const props = { token: 'tok', cluster: null, onNotice: vi.fn() }

/* The table, apart from the strip over it, which counts the same words. */
const table = () => screen.findByRole('table')

/* Upstream's `⋮` menu, its first entry: View Details (auth.js:1191). */
async function viewDetails(user: ReturnType<typeof userEvent.setup>, row = 0) {
  await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[row])
  await user.click(await screen.findByRole('menuitem', { name: 'View Details' }))
}

/* Enable or Disable, under upstream's own words in the same menu (auth.js:1192-1193). */
async function fromMenu(user: ReturnType<typeof userEvent.setup>, item: string, row = 0) {
  await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[row])
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

describe('Users: the table', () => {
  it('it draws type, 2FA, state and the two logins, with the total', async () => {
    server()
    render(<Users {...props} />)

    const t = await table()
    expect(within(t).getByText('Administrator')).toBeInTheDocument()
    expect(within(t).getAllByText('Local')).toHaveLength(2)
    expect(screen.getByText('Total Users: 2')).toBeInTheDocument()
    // `0001-01-01T00:00:00` is .NET's "never". Upstream formats it without
    // looking and produces "0000-12-31 23:45:16 from 0.0.0.0"; here it says
    // "Never", which is what that value means.
    expect(within(t).getAllByText('Never')).toHaveLength(2)
    expect(screen.queryByText(/from 0\.0\.0\.0/)).toBeNull()
  })

  it('an SSO user comes out as Remote/SSO and with the 2FA managed elsewhere', async () => {
    server([SSO_USER])
    render(<Users {...props} />)
    const t = await table()
    expect(within(t).getByText('Remote/SSO')).toBeInTheDocument()
    expect(within(t).getByText('SSO Managed')).toBeInTheDocument()
  })

  it('an SSO user is offered neither a password reset nor clearing the 2FA', async () => {
    server([SSO_USER])
    render(<Users {...props} />)
    await table()
    expect(screen.queryByRole('button', { name: 'Reset Password' })).not.toBeInTheDocument()
    await userEvent.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    expect(screen.queryByRole('button', { name: 'Disable 2FA' })).not.toBeInTheDocument()
  })

  it('an LDAP user comes out as Remote/LDAP with its own 2FA status (auth.js:1154-1163)', async () => {
    server([{ ...LDAP_USER, totpEnabled: true }])
    render(<Users {...props} />)
    const t = await table()
    expect(within(t).getByText('Remote/LDAP')).toBeInTheDocument()
    expect(within(t).getByText('Enabled', { selector: 'td:nth-child(4) *' })).toBeInTheDocument()
  })

  it('an LDAP user is offered clearing the 2FA but NOT a password reset (auth.js:1195-1205)', async () => {
    server([{ ...LDAP_USER, totpEnabled: true }])
    render(<Users {...props} />)
    await userEvent.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    expect(await screen.findByRole('menuitem', { name: 'Disable 2FA' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Reset Password' })).not.toBeInTheDocument()
  })

  it('a local user is offered the password reset', async () => {
    server([NEW_USER])
    render(<Users {...props} />)
    await userEvent.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    expect(await screen.findByRole('menuitem', { name: 'Reset Password' })).toBeInTheDocument()
  })

  it('an unknown type falls to the default: its label is the type itself, and no reset', async () => {
    // auth.js:1164-1166 writes `user.type` raw; the reset is only for `Local`.
    server([{ ...NEW_USER, type: 'Future', totpEnabled: true }])
    render(<Users {...props} />)
    expect(within(await table()).getByText('Future')).toBeInTheDocument()
    await userEvent.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    expect(screen.queryByRole('menuitem', { name: 'Reset Password' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Disable 2FA' })).not.toBeInTheDocument()
  })

  it('\"Disable 2FA\" only appears if the user has it on', async () => {
    server([{ ...NEW_USER, totpEnabled: true }])
    render(<Users {...props} />)
    await userEvent.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    expect(await screen.findByRole('menuitem', { name: 'Disable 2FA' })).toBeInTheDocument()
  })

  it('with no users the total says zero', async () => {
    server([])
    render(<Users {...props} />)
    expect(await screen.findByText('Total Users: 0')).toBeInTheDocument()
  })
})

describe('Users: enable and disable', () => {
  it('ENABLING asks for no confirmation: it goes straight out', async () => {
    const spy = server([{ ...NEW_USER, disabled: true }])
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Users {...props} onNotice={onNotice} />)

    await fromMenu(user, 'Enable')

    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]).toEqual({
      token: 'tok',
      body: { user: 'testuser', disabled: 'false' },
    })
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'User Enabled!',
      text: 'User [testuser] account was enabled successfully.',
    })
  })

  it('DISABLING does ask for confirmation, with the name in the text', async () => {
    const spy = server([NEW_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)

    await fromMenu(user, 'Disable')
    expect(
      screen.getByText('Are you sure you want to disable the user [testuser] account?'),
    ).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/set')).toBeUndefined()
  })

  it('clearing the 2FA sends `totpEnabled=false` and alerts with the upstream literal', async () => {
    const spy = server([{ ...NEW_USER, totpEnabled: true }])
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Users {...props} onNotice={onNotice} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Disable 2FA' }))
    expect(
      screen.getByText(
        'Are you sure you want to disable Two-factor authentication (2FA) for user [testuser] ?',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Disable' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]).toEqual({
      token: 'tok',
      body: { user: 'testuser', totpEnabled: 'false' },
    })
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: '2FA Disabled!',
      text: 'Two-factor authentication was disabled successfully for user [testuser].',
    })
  })

  it('deleting asks for confirmation and takes the row out of the table', async () => {
    const spy = server([ADMIN_USER, NEW_USER])
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Users {...props} onNotice={onNotice} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[1])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete User' }))
    expect(
      screen.getByText('Are you sure you want to delete the user [testuser] account?'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/delete')?.[1]).toEqual({
      token: 'tok',
      body: { user: 'testuser' },
    })
    expect(screen.getByText('Total Users: 1')).toBeInTheDocument()
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'User Deleted!',
      text: 'User account was deleted successfully.',
    })
  })
})

describe('Users: "Add User"', () => {
  async function open() {
    server()
    const user = userEvent.setup()
    render(<Users {...props} />)
    await user.click(await screen.findByRole('button', { name: 'Add User' }))
    await screen.findByLabelText('Confirm Password')
    return user
  }

  it('the order of the four validations is the one of upstream', async () => {
    const user = await open()
    const add = screen.getByRole('button', { name: 'Add' })

    await user.click(add)
    expect(screen.getByText('Please enter an username to add user.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Username'), 'newuser')
    await user.click(add)
    expect(screen.getByText('Please enter a password to add user.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Password'), 'one')
    await user.click(add)
    expect(screen.getByText('Please enter confirm password.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Confirm Password'), 'two')
    await user.click(add)
    expect(screen.getByText('Passwords do not match. Please try again.')).toBeInTheDocument()
  })

  it('the display name is optional: it is not validated', async () => {
    const user = await open()
    await user.type(screen.getByLabelText('Username'), 'newuser')
    await user.type(screen.getByLabelText('Password'), 'x')
    await user.type(screen.getByLabelText('Confirm Password'), 'x')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const spy = vi.mocked(client.apiRequest)
    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/create')?.[1]).toEqual({
      token: 'tok',
      method: 'POST',
      body: { displayName: '', user: 'newuser', pass: 'x' },
    })
  })
})

describe('Users: "Reset Password"', () => {
  it('it validates in order and saves by POST with `newPass`', async () => {
    const spy = server([NEW_USER])
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Users {...props} onNotice={onNotice} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Reset Password' }))
    const reset = screen.getByRole('button', { name: 'Reset' })

    await user.click(reset)
    expect(screen.getByText('Please enter new password.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('New Password'), 'one')
    await user.click(reset)
    expect(screen.getByText('Please enter confirm password.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Confirm Password'), 'two')
    await user.click(reset)
    expect(screen.getByText('Passwords do not match. Please try again.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Confirm Password'))
    await user.type(screen.getByLabelText('Confirm Password'), 'one')
    await user.click(reset)

    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]).toEqual({
      token: 'tok',
      method: 'POST',
      body: { user: 'testuser', newPass: 'one' },
    })
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Password Reset!',
      text: 'Password was reset successfully.',
    })
  })
})

describe('Users: the details modal', () => {
  it('it sends user, state and session timeout, and the display name if not SSO', async () => {
    const spy = server([NEW_USER])
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Users {...props} onNotice={onNotice} />)

    await viewDetails(user)
    await screen.findByLabelText('Session Timeout')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]).toEqual({
      token: 'tok',
      body: {
        user: 'testuser',
        disabled: 'false',
        sessionTimeoutSeconds: '1800',
        displayName: 'Test User',
        memberOfGroups: '',
      },
    })
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'User Saved!',
      text: 'User details were saved successfully.',
    })
  })

  it('an empty session timeout falls to the 1800 default, it does not travel empty', async () => {
    const spy = server([NEW_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    await user.clear(await screen.findByLabelText('Session Timeout'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const body = spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]?.body as Record<string, string>
    expect(body.sessionTimeoutSeconds).toBe('1800')
  })

  it('\"Add Group\" adds the group to the list and \"None\" empties it', async () => {
    const spy = server([NEW_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    const add = await screen.findByLabelText('Add Group')

    await choose(user, add, 'Administrators')
    expect(screen.getByLabelText('Member Of')).toHaveValue('Administrators\n')

    await choose(user, add, 'DNS Administrators')
    expect(screen.getByLabelText('Member Of')).toHaveValue('Administrators\nDNS Administrators\n')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const body = spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]?.body as Record<string, string>
    // `cleanTextList`: newlines to commas, no trailing comma.
    expect(body.memberOfGroups).toBe('Administrators,DNS Administrators')
  })

  it('an SSO user has name and display name locked, and does not send them', async () => {
    const spy = server([SSO_USER], {
      ...USER_DETAIL,
      ...SSO_USER,
      remotelyManagedGroups: false,
    })
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    expect(await screen.findByLabelText('Display Name')).toBeDisabled()
    expect(screen.getByLabelText('Username')).toBeDisabled()
    // With `remotelyManagedGroups` false the groups CAN be touched: they are two
    // different conditions, not one.
    expect(screen.getByLabelText('Member Of')).not.toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const body = spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]?.body as Record<string, string>
    expect(body.displayName).toBeUndefined()
    expect(body.newUser).toBeUndefined()
    expect(body.memberOfGroups).toBe('')
  })

  it('with `remotelyManagedGroups` the groups are locked too and left out of the send', async () => {
    const spy = server([SSO_USER], {
      ...USER_DETAIL,
      ...SSO_USER,
      remotelyManagedGroups: true,
    })
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    expect(await screen.findByLabelText('Member Of')).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const body = spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]?.body as Record<string, string>
    expect(body.memberOfGroups).toBeUndefined()
  })

  it('the details modal labels an SSO user Remote/SSO and its 2FA SSO Managed', async () => {
    server([SSO_USER], { ...USER_DETAIL, ...SSO_USER, remotelyManagedGroups: false })
    const user = userEvent.setup()
    render(<Users {...props} />)
    await viewDetails(user)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Remote/SSO')).toBeInTheDocument()
    expect(within(dialog).getByText('SSO Managed')).toBeInTheDocument()
  })

  it('an LDAP user has name and display name locked, with its own 2FA status (auth.js:1326-1331)', async () => {
    const spy = server([LDAP_USER], {
      ...USER_DETAIL,
      ...LDAP_USER,
      totpEnabled: true,
      remotelyManagedGroups: false,
    })
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByLabelText('Display Name')).toBeDisabled()
    expect(within(dialog).getByLabelText('Username')).toBeDisabled()
    expect(within(dialog).getByText('Remote/LDAP')).toBeInTheDocument()
    expect(within(dialog).getByText('Enabled')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Member Of')).not.toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const body = spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]?.body as Record<string, string>
    expect(body.displayName).toBeUndefined()
    expect(body.newUser).toBeUndefined()
    expect(body.memberOfGroups).toBe('')
  })

  it('an LDAP user with `remotelyManagedGroups` has the groups locked and not sent', async () => {
    const spy = server([LDAP_USER], {
      ...USER_DETAIL,
      ...LDAP_USER,
      remotelyManagedGroups: true,
    })
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    expect(await screen.findByLabelText('Member Of')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const body = spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]?.body as Record<string, string>
    expect(body.memberOfGroups).toBeUndefined()
  })

  it('the obsolete `ssoManagedGroups` no longer locks anything: only `remotelyManagedGroups` does', async () => {
    server([SSO_USER], {
      ...USER_DETAIL,
      ...SSO_USER,
      ssoManagedGroups: true,
      remotelyManagedGroups: false,
    })
    const user = userEvent.setup()
    render(<Users {...props} />)
    await viewDetails(user)
    expect(await screen.findByLabelText('Member Of')).not.toBeDisabled()
  })

  it('a local user shows its type as it arrives and can edit name and display name', async () => {
    server([NEW_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)
    await viewDetails(user)
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByLabelText('Display Name')).toBeEnabled()
    expect(within(dialog).getByLabelText('Username')).toBeEnabled()
    expect(within(dialog).getByText('Local')).toBeInTheDocument()
  })

  it('`newUser` only travels when the name changes', async () => {
    const spy = server([NEW_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    const field = await screen.findByLabelText('Username')
    await user.clear(field)
    await user.type(field, 'other')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const body = spy.mock.calls.find((c) => c[0] === 'admin/users/set')?.[1]?.body as Record<string, string>
    expect(body.newUser).toBe('other')
  })

  it('the sessions of the user come out inside the modal with their own total', async () => {
    server([NEW_USER], {
      ...USER_DETAIL,
      sessions: [
        {
          username: 'testuser',
          isCurrentSession: false,
          partialToken: '799a4919af7636e2',
          type: 'ApiToken',
          tokenName: 'tok1',
          lastSeen: '2026-08-26T05:29:41Z',
          lastSeenRemoteAddress: '172.23.0.1',
          lastSeenUserAgent: 'curl/8.18.0',
        },
      ],
    })
    const user = userEvent.setup()
    render(<Users {...props} />)

    await viewDetails(user)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Total Sessions: 1')).toBeInTheDocument()
    expect(within(dialog).getByText('[799a4919af7636e2]')).toBeInTheDocument()
  })
})

/* Deviation 23: the strip, the search, the menu and the row's Details. */
describe('Users: the list reads like the rest', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('the menu holds the upstream entries in their order', async () => {
    server([{ ...NEW_USER, totpEnabled: true }])
    const user = userEvent.setup()
    render(<Users {...props} />)
    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'View Details',
      'Disable',
      'Reset Password',
      'Disable 2FA',
      'Delete User',
    ])
  })

  it('the name opens the details, as the upstream link does', async () => {
    const spy = server([NEW_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)
    await user.click(await screen.findByRole('button', { name: 'testuser' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'admin/users/get')?.[1]?.body).toEqual({
      user: 'testuser',
      includeGroups: 'true',
    })
  })

  it('Details opens both logins whole under the row', async () => {
    server([ADMIN_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)
    const t = await table()
    expect(within(t).queryByText(/ from /)).toBeNull()
    await user.click(within(t).getByRole('button', { name: 'Details' }))
    expect(within(t).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(t).getByText('Recent Login', { selector: 'dt' })).toBeInTheDocument()
    expect(within(t).getAllByText('172.23.0.1')).toHaveLength(2)
  })

  it('the search narrows by username or display name, writes ?q= and asks nothing', async () => {
    const spy = server()
    const user = userEvent.setup()
    const { unmount } = render(<Users {...props} />)
    await screen.findByText('Total Users: 2')
    const calls = spy.mock.calls.length
    await user.type(screen.getByLabelText('Search'), 'test USER')
    expect(within(await table()).getAllByRole('button', { name: /^Actions for / })).toHaveLength(1)
    expect(screen.getByText('Total Users: 2, 1 shown')).toBeInTheDocument()
    expect(window.location.search).toBe('?q=test+USER')
    expect(spy.mock.calls.length).toBe(calls)
    unmount()
    expect(window.location.search).toBe('')
  })

  it('the strip counts the users by status and type, and pressing a state filters', async () => {
    server([ADMIN_USER, { ...NEW_USER, disabled: true }, SSO_USER])
    const user = userEvent.setup()
    render(<Users {...props} />)
    const byStatus = await screen.findByRole('group', { name: 'Users by status' })
    const disabled = within(byStatus).getByRole('button', { name: /Disabled/ })
    expect(disabled).toHaveTextContent('Disabled1')
    expect(within(screen.getByRole('group', { name: 'Users by type' })).getByRole('button', { name: /Remote\/SSO/ }))
      .toHaveTextContent('Remote/SSO1')

    await user.click(disabled)
    expect(disabled).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.search).toBe('?status=Disabled')
    expect(screen.getByText('Total Users: 3, 1 shown')).toBeInTheDocument()
    // The applied filter sits in the toolbar and clears it.
    await user.click(screen.getByRole('button', { name: 'Disabled, Clear' }))
    expect(screen.getByText('Total Users: 3')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('2FA counts only the users whose 2FA this server keeps', async () => {
    server([{ ...ADMIN_USER, totpEnabled: true }, NEW_USER, SSO_USER])
    render(<Users {...props} />)
    expect(await screen.findByRole('img', { name: '2FA Enabled 1 of 2' })).toBeInTheDocument()
    expect(screen.getByText(/SSO Managed 1/)).toBeInTheDocument()
  })

  it('Recent Login names who logged in last, and with nobody it says so', async () => {
    server([NEW_USER, ADMIN_USER])
    const { unmount } = render(<Users {...props} />)
    const card = (await screen.findByRole('heading', { name: 'Recent Login' })).parentElement!
    expect(within(card).getByText('admin')).toBeInTheDocument()
    unmount()
    vi.restoreAllMocks()
    server([NEW_USER])
    render(<Users {...props} />)
    const empty = (await screen.findByRole('heading', { name: 'Recent Login' })).parentElement!
    expect(within(empty).getByText('Nobody yet')).toBeInTheDocument()
  })

  it('a filter in the address bar is read on arrival', async () => {
    window.history.replaceState(null, '', '/admin/users/?type=Remote%2FSSO')
    server([ADMIN_USER, SSO_USER])
    render(<Users {...props} />)
    expect(await screen.findByText('Total Users: 2, 1 shown')).toBeInTheDocument()
  })
})
