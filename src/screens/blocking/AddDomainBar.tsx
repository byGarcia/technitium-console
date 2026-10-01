import { useRef, useState } from 'react'
import { addDomain, type DomainList } from '../../api/zonelists'
import { Panel, Body } from '../../ui/Panel'
import { Field, Input } from '../../ui/Field'
import { PermissionButton } from '../../ui/PermissionButton'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { missing, type Permissions } from './permissions'
import styles from './Blocking.module.css'

/*
"Block or allow a domain": upstream's single field with its verbs beside it
(index.html:768-777), which this console had split — `Block` went up to the page
header and the field stayed in the tree, labelled next to `Browse`, so it read as a
search box. The panel title is OURS; the calls, the empty-field warning and the
success sentences are upstream's (other-zones.js:171-200, 348-375).

ENTER BLOCKS. Upstream's form is submitted by `btnBlockZone`, so pressing Enter in
the field blocks; this console's tree field navigated instead.
*/
export function AddDomainBar({
  token,
  permissions,
  onNotice,
  onChanged,
}: {
  token: string | null
  permissions: Permissions
  onNotice: (n: Notice) => void
  onChanged: (list: DomainList, domain: string) => void
}) {
  const [field, setField] = useState('')
  const [busy, setBusy] = useState(false)
  const entry = useRef<HTMLInputElement>(null)

  async function run(list: DomainList) {
    const domain = field

    // The alert goes BEFORE any call, and leaves the focus in the field:
    // other-zones.js:171-176 and 348-353.
    if (domain === '') {
      onNotice({
        type: 'warning',
        title: 'Missing!',
        text: list === 'allowed' ? 'Please enter a domain name to allow.' : 'Please enter a domain name to block.',
      })
      entry.current?.focus()
      return
    }

    setBusy(true)
    const outcome = await addDomain(list, token, domain)
    setBusy(false)
    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }

    setField('')
    onNotice(
      list === 'allowed'
        ? { type: 'success', title: 'Allowed!', text: `Domain '${domain}' was added to Allowed Zone successfully.` }
        : { type: 'success', title: 'Blocked!', text: `Domain '${domain}' was added to Blocked Zone successfully.` },
    )
    onChanged(list, domain)
  }

  return (
    <Panel title="Block or allow a domain">
      <Body>
        <form
          className={styles.add}
          onSubmit={(e) => {
            e.preventDefault()
            void run('blocked')
          }}
        >
          <Field label="Domain">
            {(id) => (
              <Input
                id={id}
                ref={entry}
                mono
                placeholder="example.com"
                value={field}
                onChange={(e) => setField(e.target.value)}
              />
            )}
          </Field>
          <PermissionButton
            type="submit"
            variant="primary"
            disabled={busy}
            permission={missing(permissions, 'Blocked.canModify')}
          >
            Block
          </PermissionButton>
          <PermissionButton
            type="button"
            disabled={busy}
            permission={missing(permissions, 'Allowed.canModify')}
            onClick={() => void run('allowed')}
          >
            Allow
          </PermissionButton>
        </form>
      </Body>
    </Panel>
  )
}
