import { FilePick } from '../../ui/FilePick'
import { useEffect, useRef, useState } from 'react'
import { installApp } from '../../api/apps'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { DialogForm } from '../../ui/DialogForm'
import { Field, LabeledInput } from '../../ui/Field'
import { error, type AlertState } from './Apps'
import { Notifier } from '../../ui/Notifier'

/*
A replica of `showInstallAppModal` / `installApp` (apps.js:198-209 and 330-379).

The validation order is upstream's and is not touched: the name FIRST, the file
SECOND. Both alerts are literals.
*/
export function InstallApp({
  open,
  onOpenChange,
  token,
  onInstalled,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  token: string | null
  onInstalled: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setAlert(null)
      setBusy(false)
    }
  }, [open])

  async function install() {
    if (name === '') {
      setAlert({ type: 'warning', title: 'Missing!', text: 'Please enter an application name.' })
      return
    }

    const file = fileRef.current?.files?.[0]
    if (!file) {
      setAlert({
        type: 'warning',
        title: 'Missing!',
        text: 'Please select an application zip file to install.',
      })
      return
    }

    setBusy(true)
    const outcome = await installApp(token, name, file)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setAlert(error(outcome))
      return
    }
    onInstalled(name)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Install App"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void install()}>
            Install
          </Button>
        </>
      }
    >
      <Notifier notice={alert} onClose={() => setAlert(null)} />
      <DialogForm>
        <LabeledInput label="App Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="App Zip File">{(id) => <FilePick id={id} ref={fileRef} />}</Field>
      </DialogForm>
    </Dialog>
  )
}
