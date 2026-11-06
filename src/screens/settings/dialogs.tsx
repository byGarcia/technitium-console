import { FilePick } from '../../ui/FilePick'
import { useState } from 'react'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Alert } from '../../ui/Alert'
import { DialogField, DialogForm, DialogGroup, dialogForm as df } from '../../ui/DialogForm'
import { BACKUP_ITEMS } from '../../api/settings'
import { Check } from './parts'

/*
The "are you sure?" step is `ui/Confirm`, the same dialog the other five
screens use. It is re-exported under the name it is asked for by here.
*/
export { Confirm } from '../../ui/Confirm'

/*
The thirteen items as a checklist in two columns on the raised step
(`ui/DialogForm`'s `.checklist`), filled down the first column and then the
second, so they still read in upstream's order. Each item's files, the
parenthesis its label ends in, go under its name in the help's colour: the same
words in the same label, so the box is still named by all of them.
*/
function ItemList({
  selection,
  onChange,
  prefix,
}: {
  selection: Record<string, boolean>
  onChange: (s: Record<string, boolean>) => void
  prefix: string
}) {
  return (
    <div className={df.checklist}>
      {BACKUP_ITEMS.map((e) => {
        const cut = e.label.lastIndexOf(' (')
        const name = cut > 0 && e.label.endsWith(')') ? e.label.slice(0, cut) : e.label
        const files = name === e.label ? null : e.label.slice(cut + 1)
        return (
          <label key={`${prefix}-${e.key}`} className={df.chk}>
            <input
              type="checkbox"
              checked={selection[e.key] === true}
              onChange={(ev) => onChange({ ...selection, [e.key]: ev.target.checked })}
            />
            <span>
              {name}
              {files != null && (
                <>
                  {' '}
                  <span className={df.files}>{files}</span>
                </>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export interface DialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  selection: Record<string, boolean>
  onSelection: (s: Record<string, boolean>) => void
  notice: { title: string; text: string } | null
  busy?: boolean
}

/** The "Backup Settings" modal (index.html:6283-6380). */
export function BackupDialog({
  open,
  onOpenChange,
  selection,
  onSelection,
  notice,
  busy,
  onBackup,
}: DialogProps & { onBackup: () => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Backup Settings"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={onBackup}>
            Backup
          </Button>
        </>
      }
    >
      <DialogForm>
        {notice && (
          <Alert type="warning" title={notice.title}>
            {notice.text}
          </Alert>
        )}
        <DialogGroup label="The backup process will create a zip file for the items selected below:">
          <ItemList selection={selection} onChange={onSelection} prefix="backup" />
        </DialogGroup>
        <div className={df.notices}>
          <Alert type="info" title="Note!">
            The Web Service or Optional Protocols TLS certificate (.pfx or .p12) files will be
            included in the backup only if they exist within the DNS Server's config folder.
          </Alert>
          <Alert type="info" title="Note!">
            It may take several minutes to generate the backup zip file if log files are selected to
            be backed up which will depend on the size of the log files on the disk.
          </Alert>
        </div>
      </DialogForm>
    </Dialog>
  )
}

/** The "Restore Settings" modal (index.html:6392-6512). */
export function RestoreDialog({
  open,
  onOpenChange,
  selection,
  onSelection,
  notice,
  busy,
  onRestore,
}: DialogProps & { onRestore: (file: File | null, remove: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [remove, setDelete] = useState(true)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Restore Settings"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => onRestore(file, remove)}>
            Restore
          </Button>
        </>
      }
    >
      {/* The `Warning!` stays after the items: its words are about "above
          selected items". */}
      <DialogForm>
        {notice && (
          <Alert type="warning" title={notice.title}>
            {notice.text}
          </Alert>
        )}
        <DialogField label="Backup Zip File">
          {(id) => <FilePick id={id} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
        </DialogField>
        <DialogGroup label="The restore process will restore all the selected items from the backup zip file:">
          <ItemList selection={selection} onChange={onSelection} prefix="restore" />
        </DialogGroup>
        <DialogGroup label="Restore options:">
          <Check
            label="Delete Existing Files For Selected Items"
            checked={remove}
            onChange={setDelete}
          />
        </DialogGroup>
        <Alert type="warning" title="Warning!">
          The restore process will overwrite existing config files on disk for above selected items
          and reload new settings including user accounts from the backup. The current logged in
          user account and current session will be added automatically.
        </Alert>
      </DialogForm>
    </Dialog>
  )
}
