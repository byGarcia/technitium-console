import { useId, useRef, useState } from 'react'
import { addDomain, type DomainList } from '../../api/zonelists'
import { Panel, Body } from '../../ui/Panel'
import { Field, Input } from '../../ui/Field'
import { Loading } from '../../ui/Empty'
import { PermissionButton } from '../../ui/PermissionButton'
import { loadQuickList, type QuickEntry } from '../../lib/quick-lists'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { checkDomain, verdictOf, type Verdict } from './check-domain'
import { DomainCheck } from './DomainCheck'
import { moreLists } from './extra-lists'
import { missing, type Permissions } from './permissions'
import styles from './Blocking.module.css'

/*
"Block or allow a domain": upstream's single field with its verbs beside it
(index.html:768-777), which this console had split: `Block` went up to the page
header and the field stayed in the tree, labelled next to `Browse`, so it read as a
search box. The panel title and the field label `Domain` are OURS (upstream's field
has only its `example.com` placeholder); the `Block` / `Allow` buttons, the calls,
the empty-field warning and the success sentences are upstream's
(other-zones.js:171-200, 348-375).

ENTER BLOCKS. Upstream's form is submitted by `btnBlockZone`, so pressing Enter in
the field blocks; this console's tree field navigated instead.

CHECK is OURS, and so are its words: the button `Check`, the panel title's `Check, `
(it read "Block or allow a domain"), the empty-field sentence `Please enter a domain
name to check.` (worded as upstream's two) and the verdict (`DomainCheck.tsx`).
Unlike Block and Allow, whose alerts are upstream's and go to the page, a check that
cannot answer says why UNDER THE FIELD, where its answer would have been: an empty
field, or the server's own message (`Invalid domain name [x y]: …` is the server
validating the name). It
lives here and not in a tab of its own because it asks about the same name the two
verbs act on: the answer lands under the field, and the next step (`Block`,
`Allow`) is already beside it. It needs `DnsClient: View`, the permission of the
call it makes (WebServiceApi.cs:147), and draws its padlock like the other two.
Enter still blocks: Check is never the form's submit.

The verdict answers the name it was asked for, so it goes as soon as the field
changes, and after a Block or an Allow, which changes the answer.
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
  const [checking, setChecking] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  /** Why the last check has no verdict: an empty field, or the server's message. */
  const [problem, setProblem] = useState<string | null>(null)
  const problemId = useId()
  const [catalog, setCatalog] = useState<QuickEntry[]>([])
  /** Numbers the checks, so a slow answer cannot land over a newer question. */
  const asked = useRef(0)

  const checkNeed = missing(permissions, 'DnsClient.canView')

  async function check() {
    const domain = field.trim()
    if (domain === '') {
      forget()
      setProblem('Please enter a domain name to check.')
      entry.current?.focus()
      return
    }

    const mine = ++asked.current
    setVerdict(null)
    setProblem(null)
    setChecking(true)
    const [outcome, named] = await Promise.all([
      checkDomain(token, domain, {
        settings: missing(permissions, 'Settings.canView'),
        allowed: missing(permissions, 'Allowed.canView'),
      }),
      /* The names the Lists tab gives its rows: Technitium's catalogue, then ours. */
      loadQuickList('quick-block-lists').then((c) => [...c, ...moreLists(c)]),
    ])
    if (mine !== asked.current) return
    setChecking(false)
    if (outcome.kind !== 'ok') {
      setProblem(noticeFromFailure(outcome).text)
      return
    }
    setCatalog(named)
    setVerdict(verdictOf(outcome.data))
  }

  /** Whatever was on screen answered another question. */
  function forget() {
    asked.current++
    setChecking(false)
    setVerdict(null)
    setProblem(null)
  }

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
    forget()
    onNotice(
      list === 'allowed'
        ? { type: 'success', title: 'Allowed!', text: `Domain '${domain}' was added to Allowed Zone successfully.` }
        : { type: 'success', title: 'Blocked!', text: `Domain '${domain}' was added to Blocked Zone successfully.` },
    )
    onChanged(list, domain)
  }

  return (
    <Panel title="Check, block or allow a domain">
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
                className={styles.bad}
                placeholder="example.com"
                value={field}
                aria-invalid={problem != null || undefined}
                aria-describedby={problem != null ? problemId : undefined}
                onChange={(e) => {
                  setField(e.target.value)
                  forget()
                }}
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
          <PermissionButton
            type="button"
            disabled={checking}
            permission={checkNeed}
            onClick={() => void check()}
          >
            Check
          </PermissionButton>
        </form>
        {/* One live region for the whole answer: the wait and the verdict that
            replaces it are announced once each. */}
        <div aria-live="polite">
          {problem != null && (
            <div id={problemId} className={styles.invalid}>
              {problem}
            </div>
          )}
          {checking && <Loading compact announce={false} />}
          {verdict != null && <DomainCheck verdict={verdict} catalog={catalog} />}
        </div>
      </Body>
    </Panel>
  )
}
