import { useEffect, useState } from 'react'
import { checkForUpdate, type UpdateInfo } from '../api/user'
import { Dialog } from '../ui/Dialog'
import { External } from '../ui/External'
import { Alert } from '../ui/Alert'
import styles from './Versions.module.css'
import text from '../ui/text.module.css'

/*
What is running, and whether there is anything newer.

Two facts that used to be scattered: the server's version lived only on the
About screen, this console's version lived nowhere at all, and the update notice
—which upstream shows from EVERY screen (`index.html:141`, in the panel heading,
outside the tab panes)— was not shown anywhere. The check existed in
`api/user.ts` and the only thing it drove was one line inside About.

Putting the mark on the version it concerns is not decoration: the DNS server
and this console update separately and by different means, so a notice floating
on its own could not say which of the two it meant.

Nothing here decides anything the server has not already decided. Every field is
shown, or hidden when the server sends it null, exactly as `main.js` does. And
the silencing preference is not re-read: `checkForUpdate` refuses to call the
endpoint while it is on, which is upstream's behaviour and not this component's
decision.
*/
export function Versions({ token, serverVersion, domain, markHidden = false }: {
  token: string
  serverVersion?: string
  domain?: string
  /*
  The chrome silenced the notice in THIS session, so the mark goes.

  Upstream hides its link the moment you disable the notification
  (`main.js:722`) and never shows it again, not even on re-enabling: you get it
  back by logging in again. Replicated as it stands.
  */
  markHidden?: boolean
}) {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const r = await checkForUpdate(token)
      if (!alive || r.kind !== 'ok') return
      const d = r.data as { response?: UpdateInfo }
      if (d.response?.updateAvailable) setInfo(d.response)
    })()
    return () => {
      alive = false
    }
  }, [token])

  /* main.js — when the feed sends no title, upstream writes this one itself. */
  const title = info?.updateTitle ?? 'New Update Available!'

  return (
    <>
      <div className={styles.block}>
        {domain && <div className={styles.host}>{domain}</div>}

        <div className={styles.row}>
          <span className={styles.name}>DNS Server</span>
          {/* The mark goes BEFORE the number so that the two version numbers
              keep their right edges aligned in one column, which is the whole
              reason for reading them stacked. */}
          <span className={styles.ver}>
            {info && !markHidden && (
              <button type="button" className={styles.marca} onClick={() => setOpen(true)} title={title}>
                <span className={styles.punto} aria-hidden="true" />
                Update
              </button>
            )}
            <span className={styles.num}>{serverVersion ?? '—'}</span>
          </span>
        </div>

        {/*
        This console's version, injected at build time from package.json.

        It is only reported, never checked: the server's CSP is
        `default-src 'self'` with no `connect-src`, so the browser cannot ask
        GitHub what the latest release is. Verified against a running server.
        Whoever installs the console learns of a new one from the installer.
        */}
        <div className={styles.row}>
          <span className={styles.name}>Web Console</span>
          <span className={styles.ver}><span className={styles.num}>{__CONSOLE_VERSION__}</span></span>
        </div>
      </div>

      {info && (
        <Dialog open={open} onOpenChange={setOpen} title={title} size="compact">
          {/*
          The two numbers keep the arrow, and get back the two names upstream
          writes beside them —`Current Version:` and `Update Version:`—.

          Found contracting About, 2026-09-04: the arrow says which is which to
          the eye and to nobody else. Read aloud it was «15.4 → 16.0», two numbers
          with no way to tell the one you are running from the one you are being
          offered — and this is the dialog whose whole job is that distinction.
          The names go hidden rather than drawn so the comparison keeps the shape
          the chrome round decided.
          */}
          {info.currentVersion && info.updateVersion && (
            <div className={styles.jump}>
              <span className={styles.de}>
                <span className={text.sr}>Current Version: </span>
                {info.currentVersion}
              </span>
              <span className={styles.flecha} aria-hidden="true">→</span>
              <span className={styles.a}>
                <span className={text.sr}>Update Version: </span>
                {info.updateVersion}
              </span>
            </div>
          )}

          {info.updateMessage && <p className={styles.mensaje}>{info.updateMessage}</p>}

          {/* Upstream hides each of the three on its own when it comes null. */}
          <div className={styles.enlaces}>
            {info.downloadLink && <External href={info.downloadLink}>Download Now!</External>}
            {info.instructionsLink && <External href={info.instructionsLink}>Update Instructions</External>}
            {/* `Read Change Logs`, which is what upstream calls it. It said
                `Change Log`: a literal reworded, caught contracting About. */}
            {info.changeLogLink && <External href={info.changeLogLink}>Read Change Logs</External>}
          </div>

          {/*
          Upstream's two `Note!`, and they were nowhere in this console.

          They are not decoration: one tells you to back up before updating and
          the other that the page has to be reloaded by hand afterwards, which is
          the difference between an update that goes well and one that leaves you
          looking at a console that is no longer the one running.
          */}
          <div className={styles.notes}>
            <Alert type="info" title="Note!">
              It is highly recommended to Backup Settings before installing the update.
            </Alert>
            <Alert type="info" title="Note!">
              You will have to refresh this web page manually after updating the DNS Server so that
              new UI changes are loaded.
            </Alert>
          </div>
        </Dialog>
      )}
    </>
  )
}
