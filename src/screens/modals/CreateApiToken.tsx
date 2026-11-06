import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { DialogField, DialogForm, DialogPair, dialogForm as df } from '../../ui/DialogForm'
import { Input } from '../../ui/Field'
import { Warning } from '../../ui/PanelForm'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

/*
A replica of `showCreateMyApiTokenModal()` / `createMyApiToken()`
(auth.js:332-398 in v15.5.1) and of `modalCreateApiToken` (index.html:3777-3845),
the dialog Administration › Sessions shares.

Once the token is created upstream HIDES the form and the Create button and shows
the output instead (username, token name and the token), with the warning that it
will not be shown again. Until 2026-09-30 this one left the form in place with
the token under it, and neither dialog carried the two warnings.
*/

/** index.html:3807, under the form upstream; before it here (the design's rule for a `Warning!`). */
export const TOKEN_PRIVILEGES =
  "The token allows access to API calls with the same privileges as that of the user account. Thus its recommended to create a separate user account with limited permissions as required by the specific task that the token will be used for. The token cannot be used to change the user's password, or update the user profile details."

/** index.html:3834, under the output. */
export const TOKEN_SHOWN_ONCE =
  'The token value above will not be displayed later. You must copy the token value immediately and save it for later use.'

interface Created {
  username: string
  tokenName: string
  token: string
}

export function CreateApiToken({
  open,
  onOpenChange,
  username,
  token,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  username: string
  token: string | null
  /** A token was created: My Profile's sessions list has one more. */
  onCreated?: () => void
}) {
  const [name, setName] = useState('')
  const [created, setCreated] = useState<Created | null>(null)
  const [alert, setAlert] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // auth.js:332-353: every opening starts on the form, empty.
  useEffect(() => {
    if (!open) return
    setAlert(null)
    setName('')
    setCreated(null)
  }, [open])

  async function create() {
    if (name === '') {
      setAlert({ type: 'warning', title: 'Missing!', text: 'Please enter a token name.' })
      nameRef.current?.focus()
      return
    }
    setBusy(true)
    const outcome = await apiRequest<Created>('user/createToken', {
      method: 'POST',
      token,
      body: { tokenName: name },
    })
    setBusy(false)

    if (outcome.kind === 'ok') {
      // `user/createToken` answers flat: username, tokenName and token at the top.
      setCreated(outcome.data)
      onCreated?.()
      setAlert({
        type: 'success',
        title: 'Token Created!',
        text: 'API token was created successfully.',
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
      size="medium"
      title="Create API Token"
      actions={
        created == null ? (
          <Button variant="primary" disabled={busy} onClick={() => void create()}>
            Create
          </Button>
        ) : null
      }
    >
      <Notifier notice={alert} onClose={() => setAlert(null)} />
      {/* As Administration › Sessions draws the same dialog: the privileges
          `Warning!` before the fields (a warning is read before deciding), the
          one about "the token value above" under the token it points at, and
          the token made in read-only fields, to be selected and copied. */}
      {created == null ? (
        <DialogForm>
          <Warning>{TOKEN_PRIVILEGES}</Warning>
          <DialogPair>
            <DialogField label="Username">
              {(id) => <Input id={id} placeholder="username" value={username} disabled />}
            </DialogField>
            <DialogField label="Token Name">
              {(id) => (
                <Input
                  id={id}
                  ref={nameRef}
                  autoFocus
                  placeholder="token name"
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </DialogField>
          </DialogPair>
        </DialogForm>
      ) : (
        <DialogForm>
          <DialogPair>
            <DialogField label="Username">
              {(id) => <Input id={id} className={df.readOnly} value={created.username} readOnly />}
            </DialogField>
            <DialogField label="Token Name">
              {(id) => <Input id={id} className={df.readOnly} value={created.tokenName} readOnly />}
            </DialogField>
          </DialogPair>
          <DialogField label="Token">
            {(id) => <Input id={id} mono className={df.readOnly} value={created.token} readOnly />}
          </DialogField>
          <Warning>{TOKEN_SHOWN_ONCE}</Warning>
        </DialogForm>
      )}
    </Dialog>
  )
}
