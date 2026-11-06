import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangePassword } from './ChangePassword'
import { CreateApiToken } from './CreateApiToken'
import { Configure2FA } from './Configure2FA'
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
    await userEvent.type(screen.getByLabelText('New Password'), 'new-one')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(await screen.findByText('Please enter confirm password.')).toBeInTheDocument()
  })

  it('it warns that they do not match under the Mismatch! title', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'new-one')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'another-one')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(await screen.findByText('Passwords do not match. Please try again.')).toBeInTheDocument()
    expect(screen.getByText('Mismatch!')).toBeInTheDocument()
  })

  it('with 2FA off it asks for no OTP', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(ok())
    open(false)
    expect(screen.queryByLabelText('Enter OTP')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'new-one')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'new-one')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(spy.mock.calls[0][0]).toBe('user/changePassword')
    expect(spy.mock.calls[0][1]?.body).toEqual({ pass: 'old-one', newPass: 'new-one', totp: '' })
  })

  it('with 2FA on it requires the 6 digits', async () => {
    open(true)
    await userEvent.type(screen.getByLabelText('Current Password'), 'old-one')
    await userEvent.type(screen.getByLabelText('New Password'), 'new-one')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'new-one')
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
    await userEvent.type(screen.getByLabelText('New Password'), 'new-one')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'new-one')
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
