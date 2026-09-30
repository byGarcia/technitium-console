import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangePassword } from './ChangePassword'
import { CreateApiToken } from './CreateApiToken'
import { Configure2FA } from './Configure2FA'
import { MyProfile } from './MyProfile'
import * as client from '../../api/client'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown = { status: 'ok' }) => ({ kind: 'ok' as const, data })

describe('Change Password', () => {
  const open = (totpEnabled = false) =>
    render(
      <ChangePassword open onOpenChange={() => {}} totpEnabled={totpEnabled} token="t" />,
    )

  it('it requires the current password, with the literal text', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(await screen.findByText('Please enter the current password.')).toBeInTheDocument()
  })

  it('it requires the new one before the confirmation: the order is contract', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(await screen.findByText('Please enter new password.')).toBeInTheDocument()
  })

  it('it requires the confirmation', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'nueva')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(await screen.findByText('Please enter confirm password.')).toBeInTheDocument()
  })

  it('it warns that they do not match under the Mismatch! title', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'nueva')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'otra')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(await screen.findByText('Passwords do not match. Please try again.')).toBeInTheDocument()
    expect(screen.getByText('Mismatch!')).toBeInTheDocument()
  })

  it('with 2FA off it asks for no OTP', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(ok())
    open(false)
    expect(screen.queryByLabelText('Enter OTP')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'nueva')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'nueva')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(spy.mock.calls[0][0]).toBe('user/changePassword')
    expect(spy.mock.calls[0][1]?.body).toEqual({ pass: 'old-one', newPass: 'nueva', totp: '' })
  })

  it('with 2FA on it requires the 6 digits', async () => {
    open(true)
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'nueva')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'nueva')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(
      await screen.findByText('Please enter the 6-digit OTP that you see in your authenticator app.'),
    ).toBeInTheDocument()
  })

  it('on success it closes and speaks on the page with the literal text (auth.js:494-502)', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(ok())
    const onOpenChange = vi.fn()
    const onNotice = vi.fn()
    render(
      <ChangePassword open onOpenChange={onOpenChange} onNotice={onNotice} totpEnabled={false} token="t" />,
    )
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'nueva')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'nueva')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Password Changed!',
      text: 'Password was changed successfully.',
    })
  })

  it('it shows the username, and the OTP with its label, example and help', () => {
    render(<ChangePassword open onOpenChange={() => {}} totpEnabled token="t" username="admin" />)
    expect(screen.getByLabelText('Username')).toHaveValue('admin')
    expect(screen.getByLabelText('Username')).toBeDisabled()
    expect(screen.getByLabelText('Enter OTP')).toHaveAttribute('placeholder', 'OTP')
    expect(screen.getByText('Enter the 6-digit code you see in your authenticator app.')).toBeInTheDocument()
  })

  it('after a factory-credentials login the current password comes filled in and locked', () => {
    render(<ChangePassword open onOpenChange={() => {}} totpEnabled={false} token="t" currentPassword="admin" />)
    expect(screen.getByLabelText('Current Password')).toHaveValue('admin')
    expect(screen.getByLabelText('Current Password')).toBeDisabled()
  })
})

describe('Create API Token', () => {
  it('it requires the name with the literal text', async () => {
    render(<CreateApiToken open onOpenChange={() => {}} username="admin" token="t" />)
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('Please enter a token name.')).toBeInTheDocument()
  })

  it('it creates the token, swaps the form for the output and warns once (auth.js:377-389)', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(
      ok({ status: 'ok', username: 'admin', tokenName: 'orbiter', token: 'abc' }),
    )
    render(<CreateApiToken open onOpenChange={() => {}} username="admin" token="t" />)
    expect(screen.getByText(/^The token allows access to API calls/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Token Name'), 'orbiter')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(spy.mock.calls[0][1]?.body).toEqual({ tokenName: 'orbiter' })
    expect(await screen.findByText('API token was created successfully.')).toBeInTheDocument()
    expect(screen.getByLabelText('Token')).toHaveValue('abc')
    expect(screen.getByLabelText('Token Name')).toHaveValue('orbiter')
    expect(screen.getByLabelText('Token Name')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    expect(
      screen.getByText('The token value above will not be displayed later. You must copy the token value immediately and save it for later use.'),
    ).toBeInTheDocument()
  })
})

describe('Configure 2FA', () => {
  const init = (totpEnabled: boolean) =>
    ok({ status: 'ok', response: { totpEnabled, qrCodePngImage: 'iVBORw0K', secret: 'ABCDEFGHIJ' } })

  it('it draws the QR as a data: URI, and the secret in groups of four (auth.js:549-555)', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(init(false))
    render(<Configure2FA open onOpenChange={() => {}} token="t" username="admin" />)
    const img = await screen.findByAltText('QR code for the authenticator app')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,iVBORw0K')
    expect(screen.getByTestId('secret')).toHaveTextContent('ABCD EFGH IJ')
    expect(screen.getByLabelText('Username')).toHaveValue('admin')
    expect(screen.getByLabelText('2FA Status')).toHaveValue('Disabled')
    expect(
      screen.getByText('Scan the QR Code or manually enter the secret key (spaces don\'t matter) given above in your authenticator app.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Enter the 6-digit code you see in your authenticator app.')).toBeInTheDocument()
    expect(screen.getByLabelText('Enter OTP')).toHaveAttribute('placeholder', 'OTP')
  })

  it('it requires the 6 digits with the literal text', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(init(false))
    render(<Configure2FA open onOpenChange={() => {}} token="t" />)
    await screen.findByLabelText('Enter OTP')
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))
    expect(
      await screen.findByText('Please enter the 6-digit OTP that you see in your authenticator app.'),
    ).toBeInTheDocument()
  })

  it('enabling sends the OTP by POST, closes, and speaks on the page', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) =>
      path === 'user/2fa/init' ? init(false) : ok(),
    )
    const onOpenChange = vi.fn()
    const onNotice = vi.fn()
    render(<Configure2FA open onOpenChange={onOpenChange} onNotice={onNotice} token="t" />)
    await userEvent.type(await screen.findByLabelText('Enter OTP'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/2fa/enable')
    expect(call?.[1]).toMatchObject({ method: 'POST', body: { totp: '123456' } })
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: '2FA Enabled!',
      text: 'Two-factor authentication (2FA) was enabled successfully.',
    })
  })

  it('a rejected OTP is cleared and the error stays in the dialog', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) =>
      path === 'user/2fa/init' ? init(false) : { kind: 'error' as const, message: 'Invalid OTP.' },
    )
    render(<Configure2FA open onOpenChange={() => {}} token="t" />)
    await userEvent.type(await screen.findByLabelText('Enter OTP'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))
    expect(await screen.findByText('Invalid OTP.')).toBeInTheDocument()
    expect(screen.getByLabelText('Enter OTP')).toHaveValue('')
  })

  it('with 2FA on it asks before disabling, and disables by GET (auth.js:627-667)', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) =>
      path === 'user/2fa/init' ? init(true) : ok(),
    )
    const onNotice = vi.fn()
    render(<Configure2FA open onOpenChange={() => {}} onNotice={onNotice} token="t" />)
    expect(await screen.findByLabelText('2FA Status')).toHaveValue('Enabled')
    expect(screen.queryByLabelText('Enter OTP')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(
      await screen.findByText('Are you sure you want to disable Two-factor authentication (2FA) ?'),
    ).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'user/2fa/disable')).toBeUndefined()
    const buttons = screen.getAllByRole('button', { name: 'Disable' })
    await userEvent.click(buttons[buttons.length - 1])
    const call = await vi.waitFor(() => {
      const c = spy.mock.calls.find((c) => c[0] === 'user/2fa/disable')
      expect(c).toBeDefined()
      return c!
    })
    expect(call[1]?.method).toBeUndefined()
    await vi.waitFor(() =>
      expect(onNotice).toHaveBeenCalledWith({
        type: 'success',
        title: '2FA Disabled!',
        text: 'Two-factor authentication (2FA) was disabled successfully.',
      }),
    )
  })
})

describe('My Profile', () => {
  /* The v15.5.1 shape: `type` decides, `isSsoUser` is obsolete, and a
     `RemoteSSO` user carries no `totpEnabled` (WebServiceAuthApi.cs:137-146). */
  const profile = (type: string, extra: Record<string, unknown> = {}) =>
    ok({
      status: 'ok',
      response: {
        displayName: 'Administrator',
        username: 'admin',
        type,
        isSsoUser: type === 'RemoteSSO',
        ...(type === 'RemoteSSO' ? {} : { totpEnabled: false }),
        memberOfGroups: ['Everyone', 'Administrators'],
        sessionTimeoutSeconds: 1800,
        ...extra,
      },
    })

  it('it lets a local user edit the name and sends it', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(profile('Local'))
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    await screen.findByDisplayValue('Administrator')
    expect(screen.getByLabelText('User Type')).toHaveValue('Local')
    expect(screen.getByLabelText('Display Name')).toBeEnabled()
    // auth.js:678-687 — the record lists the groups and their total; it had been lost.
    expect(screen.getByLabelText('2FA Status')).toHaveValue('Disabled')
    expect(screen.getByText('Total Groups: 2')).toBeInTheDocument()
    expect(screen.getByText('Administrators')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800', displayName: 'Administrator' })
  })

  it('it disables the name for an SSO user and does NOT send it', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(profile('RemoteSSO'))
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    await screen.findByDisplayValue('Administrator')
    expect(screen.getByLabelText('User Type')).toHaveValue('Remote/SSO')
    expect(screen.getByLabelText('Display Name')).toBeDisabled()
    expect(screen.getByLabelText('2FA Status')).toHaveValue('SSO Managed')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800' })
  })

  it('an LDAP user has the name locked but its own 2FA status (auth.js:691-695)', async () => {
    const spy = vi
      .spyOn(client, 'apiRequest')
      .mockResolvedValue(profile('RemoteLDAP', { totpEnabled: true }))
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    await screen.findByDisplayValue('Administrator')
    expect(screen.getByLabelText('User Type')).toHaveValue('Remote/LDAP')
    expect(screen.getByLabelText('Display Name')).toBeDisabled()
    expect(screen.getByLabelText('2FA Status')).toHaveValue('Enabled')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800' })
  })

  it('the default branch writes the type as it arrives, and ignores `isSsoUser`', async () => {
    // auth.js:697-702: `default:` labels with `type` itself. An unknown type is
    // drawn raw and the name stays editable even with the obsolete flag on.
    vi.spyOn(client, 'apiRequest').mockResolvedValue(profile('Future', { isSsoUser: true }))
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    await screen.findByDisplayValue('Administrator')
    expect(screen.getByLabelText('User Type')).toHaveValue('Future')
    expect(screen.getByLabelText('Display Name')).toBeEnabled()
    expect(screen.getByLabelText('2FA Status')).toHaveValue('Disabled')
  })

  it('a successful save closes the modal and alerts on the PAGE (auth.js:803-811)', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(profile('Local'))
    const onOpenChange = vi.fn()
    const onNotice = vi.fn()
    const onSaved = vi.fn()
    render(
      <MyProfile open onOpenChange={onOpenChange} token="t" onNotice={onNotice} onSaved={onSaved} />,
    )
    await screen.findByDisplayValue('Administrator')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Profile Saved!',
      text: 'User profile was saved successfully.',
    })
    expect(onSaved).toHaveBeenCalledWith('Administrator')
    // Not inside the dialog: upstream's `showAlert` has no placeholder there.
    expect(screen.queryByText('User profile was saved successfully.')).not.toBeInTheDocument()
  })

  it('a failed save keeps the modal open with the alert inside it', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) =>
      path === 'user/profile/set' ? { kind: 'error' as const, message: 'boom' } : profile('Local'),
    )
    const onOpenChange = vi.fn()
    const onNotice = vi.fn()
    render(<MyProfile open onOpenChange={onOpenChange} token="t" onNotice={onNotice} />)
    await screen.findByDisplayValue('Administrator')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onNotice).not.toHaveBeenCalled()
  })

  it('an empty session timeout travels as 1800 (auth.js:787-789)', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(profile('Local'))
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    await screen.findByDisplayValue('Administrator')
    await userEvent.clear(screen.getByLabelText('Session Timeout'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const call = spy.mock.calls.find((c) => c[0] === 'user/profile/set')
    expect(call?.[1]?.body).toEqual({ sessionTimeoutSeconds: '1800', displayName: 'Administrator' })
  })
})

describe('My Profile — sesiones activas', () => {
  const withSessions = ok({
    status: 'ok',
    response: {
      displayName: 'Administrator',
      username: 'admin',
      type: 'Local',
      isSsoUser: false,
      totpEnabled: true,
      memberOfGroups: ['Everyone'],
      sessionTimeoutSeconds: 1800,
      sessions: [
        { username: 'admin', isCurrentSession: true, partialToken: 'aaa111', type: 'Standard', tokenName: null, lastSeen: '2026-08-25T14:33:26Z', lastSeenRemoteAddress: '10.0.1.42', lastSeenUserAgent: 'Chrome' },
        { username: 'admin', isCurrentSession: false, partialToken: 'bbb222', type: 'ApiToken', tokenName: 'orbiter', lastSeen: '2026-08-24T09:00:00Z', lastSeenRemoteAddress: '10.0.70.11', lastSeenUserAgent: 'curl' },
      ],
    },
  })

  it('it lists the sessions and their total', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(withSessions)
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    expect(await screen.findByText('Total Sessions: 2')).toBeInTheDocument()
    expect(screen.getByText('10.0.1.42')).toBeInTheDocument()
    expect(screen.getByText('(current)')).toBeInTheDocument()
    // The type tag is drawn by upstream (`auth.js:703-719`) and this table had lost
    // it by being written by hand instead of with the shared cell.
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('API Token')).toBeInTheDocument()
  })

  /*
  The confirmation is the console's dialog, not the browser's native
  `confirm()`: it was the only step of the whole redesign that still opened the
  operating system's. The text is still upstream's literal (`auth.js:803`), which
  is what these two tests guard.
  */
  async function openSessionDelete() {
    await userEvent.click(screen.getByRole('button', { name: 'Actions for bbb222' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Session' }))
  }

  it('it asks for confirmation with the literal text before deleting', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(withSessions)
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    await screen.findByText('Total Sessions: 2')
    await openSessionDelete()
    expect(
      screen.getByText('Are you sure you want to delete the session [bbb222] ?'),
    ).toBeInTheDocument()
  })

  it('on confirming it deletes and alerts with the literal text', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(withSessions)
    render(<MyProfile open onOpenChange={() => {}} token="t" />)
    await screen.findByText('Total Sessions: 2')
    await openSessionDelete()
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete Session', hidden: false }),
    )
    expect(spy.mock.calls.some((c) => c[0] === 'user/session/delete')).toBe(true)
    expect(await screen.findByText('The user session was deleted successfully.')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
