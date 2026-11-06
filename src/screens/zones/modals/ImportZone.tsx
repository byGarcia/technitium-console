import { FilePick } from '../../../ui/FilePick'
import { useEffect, useRef, useState } from 'react'
import { importZone } from '../../../api/zones'
import { Alert } from '../../../ui/Alert'
import { Button } from '../../../ui/Button'
import { Dialog } from '../../../ui/Dialog'
import { Check } from '../../../ui/Check'
import { Field, Textarea } from '../../../ui/Field'
import type { Notice } from '../types'
import z from './zone-dialog.module.css'
import { Group, Tile } from './zone-dialog'
import { noticeFromFailure } from '../../../lib/notice'
import { Notifier } from '../../../ui/Notifier'

/*
`modalImportZone` (zone.js:1318 and 1342 in v15.5.1). v15.5 renamed its title
from "Import - " to "Import Zone - " and stopped the text editor from wrapping
(index.html:5127 and 5186). Two ways of handing over the file
(uploading it or pasting it), and **the "file is missing" alert only exists in the
first**: if the text editor is empty, upstream sends the request all the same and
lets the server answer. It is replicated. (It does not fail: v15.5.1 answers `ok`
to an empty body and imports nothing, unless "Overwrite Zone" is checked, and
then it empties the zone down to its SOA.)
*/

type Mode = 'File' | 'Text'

export function ImportZone({
  zone,
  open,
  token,
  node = '',
  onClose,
  onDone,
}: {
  zone: string
  open: boolean
  token: string | null
  node?: string
  onClose: () => void
  onDone: (a: Notice) => void
}) {
  const [mode, setMode] = useState<Mode>('File')
  const [zoneFile, setZoneFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [overwrite, setOverwrite] = useState(true)
  const [overwriteZone, setOverwriteZone] = useState(false)
  const [overwriteSoaSerial, setOverwriteSoaSerial] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  // `showImportZoneModal`: on opening it returns to the defaults, which are NOT
  // all false: "Overwrite Existing Records" starts checked.
  useEffect(() => {
    if (!open) return
    setMode('File')
    setZoneFile(null)
    setText('')
    setOverwrite(true)
    setOverwriteZone(false)
    setOverwriteSoaSerial(false)
    setNotice(null)
  }, [open])

  async function runImport() {
    if (mode === 'File' && zoneFile == null) {
      setNotice({ type: 'warning', title: 'Missing!', text: 'Please select a zone file to import.' })
      file.current?.focus()
      return
    }

    setBusy(true)
    const outcome = await importZone(
      token,
      zone,
      mode === 'File' ? { file: zoneFile! } : { text },
      { overwrite, overwriteZone, overwriteSoaSerial },
      node,
    )
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    onClose()
    onDone({ type: 'success', title: 'Zone Imported!', text: 'The zone file was imported successfully.' })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="medium"
      title={`Import Zone - ${zone}`}
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void runImport()}>
            Import
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {/*
      Redrawn on 2026-11-05, same controls in upstream's order: the three import
      options as one list with each help under its box, how the file is handed
      over as two tiles, then the file or the editor and upstream's note; its
      warning opens the dialog (2026-11-06).
      Every label sits above its control (`zone-dialog.module.css`).
      */}
      <div className={z.form}>
        {/* Before the options it is about (the design's rule: a warning can
            change the decision, so it is read first); upstream has it last.
            The `Note!` stays after the file it explains. */}
        <Alert type="warning" title="Warning!">
          Overwrite SOA serial option when used to set a lower SOA serial value than the
          current SOA serial will cause secondary zones to fail to sync and require a manual
          resync.
        </Alert>

        <Group label="Import Options">
          <div className={`${z.block} ${z.list}`}>
            <Check
              label="Overwrite Existing Records"
              checked={overwrite}
              onChange={setOverwrite}
              help="Enable this option to overwrite existing records for the record types being imported."
            />
            <Check
              label="Overwrite Zone"
              checked={overwriteZone}
              onChange={setOverwriteZone}
              help="Enable this option to delete all existing records from the zone before importing new records."
            />
            <Check
              label="Overwrite SOA Serial"
              checked={overwriteSoaSerial}
              onChange={setOverwriteSoaSerial}
              help="Enable this option to overwrite existing SOA record serial with the imported SOA record serial."
            />
          </div>
        </Group>

        <Group label="Import Type" radios={z.tiles}>
          <Tile name="importType" icon="upload" checked={mode === 'File'} onChange={() => setMode('File')}>
            Zone File
          </Tile>
          <Tile name="importType" icon="edit" checked={mode === 'Text'} onChange={() => setMode('Text')}>
            Text Editor
          </Tile>
        </Group>

        {/* Both stay mounted and the other one is hidden, as upstream does
            (zone.js:184-197): the file input keeps the file it shows, so going
            File, Text, File neither forgets it nor uploads a file it no longer shows. */}
        <div hidden={mode !== 'File'}>
          <Field label="Zone File">
            {(id) => (
              <FilePick id={id} ref={file} onChange={(e) => setZoneFile(e.target.files?.[0] ?? null)} />
            )}
          </Field>
        </div>
        <div hidden={mode !== 'Text'}>
          <Field label="Text Editor">
            {(id) => (
              <>
                <Textarea
                  id={id}
                  mono
                  className={z.editor}
                  spellCheck={false}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className={z.help}>Enter the records to be imported above in standard zone file format.</div>
              </>
            )}
          </Field>
        </div>

        <Alert type="info" title="Note!">
          The $ORIGIN and $TTL values will be automatically set if not specified.
        </Alert>
      </div>
    </Dialog>
  )
}
