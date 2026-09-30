import { useEffect, useState } from 'react'
import { exportZoneText, saveZoneFile } from '../../../api/zones'
import { Alert } from '../../../ui/Alert'
import { Button } from '../../../ui/Button'
import { Dialog } from '../../../ui/Dialog'
import { Loading } from '../../../ui/Empty'
import { LabeledTextarea } from '../../../ui/Field'
import type { Notice } from '../types'
import styles from '../Zones.module.css'
import frm from '../../../ui/Form.module.css'
import { noticeFromFailure } from '../../../lib/notice'
import { Notifier } from '../../../ui/Notifier'

/*
`modalEditZoneFile`, new in v15.5 (index.html:5083-5120, zone.js:1238-1316 in
v15.5.1). It reads the zone with `zones/export` into a textarea and saves it
back with `zones/import?overwriteZone=true`: the whole zone is replaced by what
the editor holds.

Four things copied from upstream on purpose:

  · **A failed read does not alert.** `zones/export` is asked for as text, so
    an error envelope lands FORMATTED inside the editor (zone.js:1262-1263).
    Only a request that never arrives alerts, in the dialog.
  · **"Overwrite SOA Serial" goes back to unchecked on every opening**
    (zone.js:1244); the editor's text is NOT cleared. Upstream only overwrites
    it when the read succeeds, so after a failed read the textarea still holds
    whatever the previous opening left there, and "Save" —which is never
    disabled— would send it. It is replicated: clearing it would send an empty
    file instead, which with `overwriteZone=true` leaves the zone with its SOA
    alone.
  · **On success it reloads the zone only if the zone view is open**
    (zone.js:1302-1303); from the list nothing is reloaded. That is the
    caller's `onSaved`.
  · **The editor does not wrap lines** (`white-space: nowrap`,
    index.html:5098): a zone file is read by columns.
*/

export function EditZoneFile({
  zone,
  open,
  token,
  node = '',
  onClose,
  onSaved,
}: {
  zone: string
  open: boolean
  token: string | null
  node?: string
  onClose: () => void
  onSaved: (a: Notice) => void
}) {
  const [text, setText] = useState('')
  const [overwriteSoaSerial, setOverwriteSoaSerial] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  // `showEditZoneFileModal` (zone.js:1238-1278).
  useEffect(() => {
    if (!open) return
    let current = true
    setOverwriteSoaSerial(false)
    setLoading(true)
    setLoaded(false)
    setBusy(false)
    // `HTTPRequest` hides the dialog's alert before every request (common.js:90).
    setNotice(null)

    void exportZoneText(token, zone, node).then((response) => {
      if (!current) return
      setLoading(false)
      if (response == null) {
        // The `error` branch: the loader goes, the editor stays hidden.
        setNotice({ type: 'danger', title: 'Error!', text: 'Unable to connect to the server. Please try again.' })
        return
      }
      setText(response)
      setLoaded(true)
    })

    return () => {
      current = false
    }
  }, [open, token, zone, node])

  // `saveEditZoneFile` (zone.js:1280-1316).
  async function save() {
    setNotice(null)
    setBusy(true)
    const outcome = await saveZoneFile(token, zone, text, overwriteSoaSerial, node)

    if (outcome.kind !== 'ok') {
      setBusy(false)
      setNotice(noticeFromFailure(outcome))
      return
    }

    onClose()
    onSaved({ type: 'success', title: 'Zone Saved!', text: 'The zone file was saved successfully.' })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="medium"
      title={`Edit Zone File - ${zone}`}
      actions={
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          Save
        </Button>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {loading && <Loading>Loading zone file…</Loading>}

      {loaded && (
        <div className={styles.fields}>
          <div className={frm.mrowCtl}>
            <LabeledTextarea
              label="Zone File Editor"
              mono
              className={`${styles.areaTall} ${styles.noWrap}`}
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className={frm.mrowCtl}>
            <label className={styles.chk}>
              <input
                type="checkbox"
                checked={overwriteSoaSerial}
                onChange={(e) => setOverwriteSoaSerial(e.target.checked)}
              />
              Overwrite SOA Serial
            </label>
            <div className={styles.help}>
              Enable this option to overwrite existing SOA record serial with the SOA record serial
              specified in the zone file editor.
            </div>
          </div>

          <Alert type="info" title="Note!">
            The $ORIGIN and $TTL values will be automatically set if not specified.
          </Alert>
          <Alert type="warning" title="Warning!">
            Overwrite SOA serial option when used to set a lower SOA serial value than the
            current SOA serial will cause secondary zones to fail to sync.
          </Alert>
        </div>
      )}
    </Dialog>
  )
}
