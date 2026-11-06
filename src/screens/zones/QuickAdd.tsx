import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { addRecord } from '../../api/records'
import type { Zone } from '../../api/zones'
import { Field, Input } from '../../ui/Field'
import { PermissionButton } from '../../ui/PermissionButton'
import { noticeFromFailure } from '../../lib/notice'
import { planQuickAdd } from './quick-add'
import type { Notice } from './types'
import styles from './QuickAdd.module.css'

/*
The quick add of a host record in the zone list's toolbar (deviation 34; the rules
and the words are in `quick-add.ts`). One line: the name, the address, upstream's
two PTR boxes as the Add Record dialog has them (the second enabled only while the
first is ticked, and unticking the first leaves the second as it was, zone.js:
543-546), and Add.

It sends `zones/records/add` to the node the screen reads, exactly as the dialog
does, and reports with the dialog's own notices: `Record Added!` with a way into
the zone, or the server's `Error!`. A refusal is said before anything is sent, and
the field it is about takes the focus. After an add the fields empty and the list
is read again (`onAdded`), so its serials, its last change and its cards count it.

Its words, OURS: `Open <zone>` on the success notice and the placeholders
`host.example.lan` and `192.168.1.10 or 2001:db8::10`. The band's title, `Add
Record`, is upstream's dialog title, and its labels `Domain` and `IP Address` are
upstream's words.
*/

export function QuickAdd({
  token,
  node,
  zones,
  canModify,
  defaultRecordTtl,
  onNotice,
  onAdded,
  onOpenZone,
  onAddZone,
}: {
  token: string | null
  node: string
  /** The zones the list knows: the summary's every zone of this node. */
  zones: Zone[]
  canModify: boolean
  defaultRecordTtl: number
  onNotice: (n: Notice) => void
  /** The list reads itself again after an add. */
  onAdded: () => Promise<void>
  onOpenZone: (zone: string) => void
  onAddZone: () => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [ptr, setPtr] = useState(false)
  const [createPtrZone, setCreatePtrZone] = useState(false)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  async function add() {
    const plan = planQuickAdd({ name, address, ptr, createPtrZone }, zones, defaultRecordTtl)
    if (!plan.ok) {
      onNotice({
        ...plan.notice,
        ...(plan.noZone ? { action: { label: 'Add Zone', run: onAddZone } } : {}),
      })
      ;(plan.field === 'name' ? nameRef : addressRef).current?.focus()
      return
    }

    setBusy(true)
    const outcome = await addRecord(token, plan.body, node)
    setBusy(false)
    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }

    setName('')
    setAddress('')
    onNotice({
      type: 'success',
      title: 'Record Added!',
      text: 'Resource record was added successfully.',
      action: { label: `Open ${plan.zone}`, run: () => onOpenZone(plan.zone) },
    })
    /* After the list's own read, which puts the focus in its Name filter as
       upstream's `refreshZones` does: the next host goes in here. */
    await onAdded()
    nameRef.current?.focus()
  }

  const onEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && canModify && !busy) void add()
  }

  return (
    <div className={styles.band} role="group" aria-labelledby={titleId}>
      <span id={titleId} className={styles.title}>
        Add Record
      </span>
      <div className={styles.name}>
        <Field inline label="Domain">
          {(id) => (
            <Input
              id={id}
              ref={nameRef}
              mono
              placeholder="host.example.lan"
              autoComplete="off"
              spellCheck={false}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onEnter}
            />
          )}
        </Field>
      </div>
      <div className={styles.address}>
        <Field inline label="IP Address">
          {(id) => (
            <Input
              id={id}
              ref={addressRef}
              mono
              placeholder="192.168.1.10 or 2001:db8::10"
              autoComplete="off"
              spellCheck={false}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={onEnter}
            />
          )}
        </Field>
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={ptr} onChange={(e) => setPtr(e.target.checked)} />
        Add reverse (PTR) record
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={createPtrZone}
          disabled={!ptr}
          onChange={(e) => setCreatePtrZone(e.target.checked)}
        />
        Create reverse zone if it does not exists
      </label>
      <PermissionButton
        permission={canModify ? undefined : 'Zones.canModify'}
        lead="add"
        disabled={busy}
        onClick={() => void add()}
      >
        Add
      </PermissionButton>
    </div>
  )
}
