import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Row } from '../../ui/Form'
import { Input } from '../../ui/Field'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

/*
A replica of `showChangePasswordModal()` / `changePassword()` (auth.js:400-510
in v15.5.1) and of `modalChangePassword` (index.html:3849-3900).

The ORDER of the validations is contract, just like the texts: upstream checks
the current password first, then the new one, then the confirmation, then that
they match, and only then the OTP, and the OTP only if the user has 2FA on.

On success upstream CLOSES the dialog and speaks on the page; the alert does not
stay inside a dialog that is no longer needed. Brought in line on 2026-09-30,
with the username field, the OTP's help and the "Change" verb that had been
lost.

`currentPassword` is `showChangePasswordModal(currentPassword)`: after a login
with the factory credentials (auth.js:283-284) the current password comes filled
in and locked.
*/
export function ChangePassword({
  open,
  onOpenChange,
  totpEnabled,
  token,
  username,
  currentPassword,
  onChanged,
  onNotice,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  totpEnabled: boolean
  token: string | null
  /** `sessionData.username` (auth.js:404). */
  username?: string
  /** Filled in and disabled, as after a factory-credentials login. */
  currentPassword?: string
  onChanged?: () => void
  /** Where the success alert goes: the page, not the closed dialog. */
  onNotice?: (notice: Notice) => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [totp, setTotp] = useState('')
  const [alert, setAlert] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const currentRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const totpRef = useRef<HTMLInputElement>(null)

  // auth.js:400-441: every opening starts clean, the alert hidden.
  useEffect(() => {
    if (!open) return
    setAlert(null)
    setCurrent(currentPassword ?? '')
    setNext('')
    setConfirm('')
    setTotp('')
  }, [open, currentPassword])

  function warn(text: string, focus: { current: HTMLInputElement | null }, title = 'Missing!') {
    setAlert({ type: 'warning', title, text })
    focus.current?.focus()
  }

  async function save() {
    if (current === '') return warn('Please enter the current password.', currentRef)
    if (next === '') return warn('Please enter new password.', nextRef)
    if (confirm === '') return warn('Please enter confirm password.', confirmRef)
    if (next !== confirm) return warn('Passwords do not match. Please try again.', nextRef, 'Mismatch!')
    if (totpEnabled && totp.length !== 6) {
      return warn('Please enter the 6-digit OTP that you see in your authenticator app.', totpRef)
    }

    setBusy(true)
    const outcome = await apiRequest('user/changePassword', {
      method: 'POST',
      token,
      body: { pass: current, newPass: next, totp },
    })
    setBusy(false)

    if (outcome.kind === 'ok') {
      onChanged?.()
      onOpenChange(false)
      onNotice?.({
        type: 'success',
        title: 'Password Changed!',
        text: 'Password was changed successfully.',
      })
      return
    }
    if (outcome.kind === 'invalid-token') return
    setAlert(noticeFromFailure(outcome))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change Password"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Change
          </Button>
        </>
      }
    >
      <Notifier notice={alert} onClose={() => setAlert(null)} />
      <Row modal label="Username">
        {(id) => <Input id={id} placeholder="username" value={username ?? ''} disabled />}
      </Row>
      <Row modal label="Current Password">
        {(id) => (
          <Input
            id={id}
            ref={currentRef}
            type="password"
            placeholder="current password"
            maxLength={255}
            autoFocus={currentPassword == null}
            disabled={currentPassword != null}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
      </Row>
      <Row modal label="New Password">
        {(id) => (
          <Input
            id={id}
            ref={nextRef}
            type="password"
            placeholder="new password"
            maxLength={255}
            autoFocus={currentPassword != null}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        )}
      </Row>
      <Row modal label="Confirm Password">
        {(id) => (
          <Input
            id={id}
            ref={confirmRef}
            type="password"
            placeholder="confirm password"
            maxLength={255}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
      </Row>
      {totpEnabled && (
        <Row modal label="Enter OTP" help="Enter the 6-digit code you see in your authenticator app.">
          {(id) => (
            <Input
              id={id}
              ref={totpRef}
              mono
              placeholder="OTP"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
            />
          )}
        </Row>
      )}
    </Dialog>
  )
}
