import { CodeArea } from '../../ui/CodeArea'
import { useEffect, useState, type ReactNode } from 'react'
import { setAppConfig } from '../../api/apps'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field } from '../../ui/Field'
import { error, type AlertState } from './Apps'
import styles from './Apps.module.css'
import { Notifier } from '../../ui/Notifier'

/*
A replica of `modalAppConfig` (index.html:6255-6280) and `saveAppConfig`
(apps.js:493-522).

It is a TEXT EDITOR, not a form: the content of `dnsApp.config` is defined by each
app and the console does not know what fields it has. Upstream puts a 15-row
`<textarea>` with the spellchecker off, and that is what is here.

The config arrives already read from the screen, because upstream also asks for it
BEFORE opening the modal (the "Config" button sits at "Loading...").

Two optional props, for the visual editor's `Edit as JSON` and for nothing else, so
the `Config` button behaves exactly as without them. `beforeSave` runs first, and an
alert from it is shown here with nothing written. `note` is drawn above the field.
*/
export function AppConfig({
  open,
  onOpenChange,
  token,
  name,
  initialConfig,
  onSaved,
  beforeSave,
  note,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  token: string | null
  name: string
  initialConfig: string
  onSaved: (name: string) => void
  beforeSave?: () => Promise<AlertState | null>
  note?: ReactNode
}) {
  const [config, setConfig] = useState(initialConfig)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setConfig(initialConfig)
      setAlert(null)
      setBusy(false)
    }
  }, [open, initialConfig])

  async function save() {
    setBusy(true)
    if (beforeSave != null) {
      const refused = await beforeSave()
      if (refused != null) {
        setBusy(false)
        setAlert(refused)
        return
      }
    }
    const outcome = await setAppConfig(token, name, config)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setAlert(error(outcome))
      return
    }
    onSaved(name)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="medium"
      title={`App Config - ${name}`}
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <Notifier notice={alert} onClose={() => setAlert(null)} />
      <p className={styles.note}>
        Edit the <code>dnsApp.config</code> config file below as required by the DNS application.
      </p>
      {note}
      <Field label="Config File">
        {(id) => (
          <CodeArea
            id={id}
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            status={<JsonState text={config} />}
          />
        )}
      </Field>
      <p className={styles.note}>
        Note: The app will reload the config automatically after you save it.
      </p>
    </Dialog>
  )
}

/*
Whether the config reads as JSON (deviation 17): a DNS app's `dnsApp.config` is a
JSON file, and a missing comma only showed after Save, as the server's error. The
line says so while typing. It only informs: Save sends the text as it is, valid
or not, exactly as before. An empty file says nothing.
*/
function JsonState({ text }: { text: string }) {
  if (text.trim() === '') return null
  const problem = jsonProblem(text)
  if (problem == null) {
    return (
      <>
        <span className={styles.dotOk} aria-hidden="true" /> Valid JSON
      </>
    )
  }
  return (
    <span className={styles.bad}>
      <span className={styles.dotBad} aria-hidden="true" /> Not valid JSON: {problem}
    </span>
  )
}

/** Why the text is not JSON, or null when it is. */
function jsonProblem(text: string): string | null {
  try {
    JSON.parse(text)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
