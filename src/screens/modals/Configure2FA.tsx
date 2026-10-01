import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { Button } from '../../ui/Button'
import { Confirm } from '../../ui/Confirm'
import { Dialog } from '../../ui/Dialog'
import { GroupRow, Row } from '../../ui/Form'
import { Loading } from '../../ui/Empty'
import { Input } from '../../ui/Field'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import txt from '../../ui/text.module.css'

/*
A replica of `showConfigure2FAModal` / `enable2FA` / `disable2FA`
(auth.js:516-667 in v15.5.1) and of `modalConfigure2FA` (index.html:3904-3955).

Until 2026-09-30 this dialog had drifted from upstream in behaviour, not only in
text, and nothing had noticed: success stayed inside the dialog instead of
closing it and speaking on the page, disabling asked nothing and went as a POST,
a failed enable kept the OTP typed, and the username, the status, the
explanation and both helps were missing. `dev/check-parity-controls.mjs` found
it once it learnt to read `<p>` and `padding-top` explanations.

`user/2fa/init` returns `qrCodePngImage` (base64 PNG) and `secret`. The QR is
drawn as a `data:` URI, which the server's CSP DOES allow: it declares
`img-src 'self' data:`. What it does not allow is `data:` for fonts, because it
does not declare `font-src`.
*/
interface InitResponse {
  response: { totpEnabled: boolean; qrCodePngImage: string; secret: string }
}

/** auth.js:549-555: the secret is shown in groups of four, "spaces don't matter". */
export function groupedSecret(secret: string): string {
  let out = ''
  for (let i = 0; i < secret.length; i++) {
    if (i > 0 && i % 4 === 0) out += ' '
    out += secret.substring(i, i + 1)
  }
  return out
}

export function Configure2FA({
  open,
  onOpenChange,
  token,
  username,
  onChanged,
  onNotice,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  token: string | null
  /** `sessionData.username`, which is what upstream writes in the field (auth.js:536). */
  username?: string
  onChanged?: (enabled: boolean) => void
  /** Where the success alert goes: upstream closes the dialog and shows it on the page. */
  onNotice?: (notice: Notice) => void
}) {
  const [init, setInit] = useState<InitResponse['response'] | null>(null)
  const [totp, setTotp] = useState('')
  const [alert, setAlert] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [askDisable, setAskDisable] = useState(false)
  const otpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAlert(null)
    setInit(null)
    setTotp('')
    void (async () => {
      const outcome = await apiRequest<InitResponse>('user/2fa/init', { token })
      if (outcome.kind === 'ok') setInit(outcome.data.response)
      else if (outcome.kind !== 'invalid-token') setAlert(noticeFromFailure(outcome))
    })()
  }, [open, token])

  // auth.js:567-569 focuses the OTP once the dialog is drawn.
  useEffect(() => {
    if (init != null && !init.totpEnabled) otpRef.current?.focus()
  }, [init])

  async function enable() {
    if (totp.length !== 6) {
      setAlert({
        type: 'warning',
        title: 'Missing!',
        text: 'Please enter the 6-digit OTP that you see in your authenticator app.',
      })
      otpRef.current?.focus()
      return
    }
    setBusy(true)
    const outcome = await apiRequest('user/2fa/enable', { method: 'POST', token, body: { totp } })
    setBusy(false)
    if (outcome.kind === 'ok') {
      onChanged?.(true)
      onOpenChange(false)
      onNotice?.({
        type: 'success',
        title: '2FA Enabled!',
        text: 'Two-factor authentication (2FA) was enabled successfully.',
      })
      return
    }
    if (outcome.kind === 'invalid-token') return
    setAlert(noticeFromFailure(outcome))
    // auth.js:613-617: a rejected OTP is cleared and the field takes the focus again.
    setTotp('')
    otpRef.current?.focus()
  }

  // auth.js:627-667: a GET, after a confirmation.
  async function disable() {
    setBusy(true)
    const outcome = await apiRequest('user/2fa/disable', { token })
    setBusy(false)
    if (outcome.kind === 'ok') {
      onChanged?.(false)
      onOpenChange(false)
      onNotice?.({
        type: 'success',
        title: '2FA Disabled!',
        text: 'Two-factor authentication (2FA) was disabled successfully.',
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
      // The modal's title is the LONG form; "Configure 2FA" is only the user
      // menu's entry. They are not the same string.
      size="medium"
      title="Configure Two-factor Authentication (2FA)"
      actions={
        init == null ? null : init.totpEnabled ? (
          <Button variant="danger" disabled={busy} onClick={() => setAskDisable(true)}>
            Disable
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => void enable()}>
            Enable
          </Button>
        )
      }
    >
      <Notifier notice={alert} onClose={() => setAlert(null)} />
      {init != null && (
        <>
          <p className={txt.paragraph}>
            When you enable Two-factor Authentication (2FA) using Time-based One-time Password
            (TOTP), you will be required to enter a one-time password (OTP) in addition to your
            password when you login. You will need to use an authenticator app like{' '}
            <b>Microsoft Authenticator</b> or <b>Google Authenticator</b> to generate the OTP when
            you login.
          </p>
          <Row modal label="Username">
            {(id) => <Input id={id} placeholder="username" value={username ?? ''} disabled />}
          </Row>
          <Row modal label="2FA Status">
            {(id) => <Input id={id} value={init.totpEnabled ? 'Enabled' : 'Disabled'} readOnly />}
          </Row>
          {!init.totpEnabled && (
            <>
              <GroupRow
                modal
                label="Secret Key"
                help="Scan the QR Code or manually enter the secret key (spaces don't matter) given above in your authenticator app."
              >
                {/* White in every theme, not a token: it is the code's quiet zone, and a
                    scanner needs dark modules on a light ground. Allowed by name in
                    `dev/check-colour-tokens.mjs`. */}
                <img
                  src={`data:image/png;base64,${init.qrCodePngImage}`}
                  alt="QR code for the authenticator app"
                  width={200}
                  height={200}
                  style={{ background: '#fff', padding: 8, borderRadius: 8 }}
                />
                <span className={txt.mono} data-testid="secret">
                  {groupedSecret(init.secret)}
                </span>
              </GroupRow>
              <Row
                modal
                label="Enter OTP"
                help="Enter the 6-digit code you see in your authenticator app."
              >
                {(id) => (
                  <Input
                    id={id}
                    ref={otpRef}
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
            </>
          )}
        </>
      )}
      {/* Upstream asks with a native `confirm()`; the sentence is upstream's, whole. */}
      <Confirm
        open={askDisable}
        title="Disable 2FA"
        text="Are you sure you want to disable Two-factor authentication (2FA) ?"
        label="Disable"
        onClose={() => setAskDisable(false)}
        onConfirm={disable}
      />
      {init == null && alert == null && <Loading />}
    </Dialog>
  )
}
