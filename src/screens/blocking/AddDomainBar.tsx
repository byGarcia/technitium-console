import { useEffect, useId, useRef, useState } from 'react'
import { dropParams, readParam } from '../../lib/url-state'
import { addDomain, type DomainList } from '../../api/zonelists'
import { readRuleExport } from '../../api/blocking'
import { Icon } from '../../ui/Icon'
import { Panel, Body } from '../../ui/Panel'
import { Input } from '../../ui/Field'
import { Loading } from '../../ui/Empty'
import { PermissionButton } from '../../ui/PermissionButton'
import { loadQuickList, type QuickEntry } from '../../lib/quick-lists'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { checkDomain, verdictOf, type Verdict } from './check-domain'
import { DomainCheck } from './DomainCheck'
import { moreLists } from './extra-lists'
import { missing, type Permissions } from './permissions'
import { asciiName, ruleHint } from './rule-match'
import { mergeRules, type Rule } from './rules-model'
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

A COMMAND BAR (2026-11-06): one line across the Overview under its header, the
title on the left as the field's visible name, then the field, Block, Allow and
Check, and the answer under the whole line. It was a panel with its title in a band
and the field labelled `Domain` over it, beside the status block. The field is still
named `Domain`, for assistive technology: the title beside it says what it is for.

ALREADY ONE OF YOUR RULES? (2026-11-06, CONVENTIONS.md, deviation 32), OURS with
its words (`rule-match.ts`: `Already blocked: it is one of your rules.`, `Already
blocked by your rule <rule>, which covers its subdomains.`, the same two for
allowed, `It wins over your blocked rule <rule>.`, `Not one of your rules.` and its
two halves, `Your blocked rules were not checked: …` and the allowed one, `Check
asks the block lists.`, and `Could not read your rules.`). As the name is typed, the
line under the field says whether one of your own rules, the name or a parent,
already covers it. The rules are the Rules table's own when the bar sits on Rules
(`rules`); on Overview the bar reads `blocked/export` and `allowed/export` itself,
each only with its View permission, ONCE, the first time a name is typed, and keeps
them; a Block or an Allow made here drops them, so the next name reads them again.
Never a read per keystroke, and never the DNS query Check makes: the block lists
are Check's to answer. It is tied to the field with `aria-describedby`, not a live
region, so a screen reader is not read a sentence per letter.
*/
const HINT_CLASS = { blocked: styles.hintBlocked, allowed: styles.hintAllowed, none: styles.hintNone } as const

export function AddDomainBar({
  token,
  permissions,
  onNotice,
  onChanged,
  rules,
  rulesFailed = false,
}: {
  token: string | null
  permissions: Permissions
  onNotice: (n: Notice) => void
  onChanged: (list: DomainList, domain: string) => void
  /** The rules the screen already holds (Rules' table), null while it reads them.
      Left out, the bar reads them itself, once (Overview). */
  rules?: readonly Rule[] | null
  /** The screen's read of `rules` failed. */
  rulesFailed?: boolean
}) {
  const [field, setField] = useState('')
  const [busy, setBusy] = useState(false)
  const entry = useRef<HTMLInputElement>(null)
  const [checking, setChecking] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  /** Why the last check has no verdict: an empty field, or the server's message. */
  const [problem, setProblem] = useState<string | null>(null)
  const problemId = useId()
  const fieldId = useId()
  const [catalog, setCatalog] = useState<QuickEntry[]>([])
  /** Numbers the checks, so a slow answer cannot land over a newer question. */
  const asked = useRef(0)

  const checkNeed = missing(permissions, 'DnsClient.canView')
  const blockedNeed = missing(permissions, 'Blocked.canView')
  const allowedNeed = missing(permissions, 'Allowed.canView')
  const hintId = useId()

  /*
  The bar's own copy of the rules, when the screen gives none: `undefined` until a
  name is first typed, then the read in flight, the rules, or a failure.
  */
  const [own, setOwn] = useState<{ rules: Rule[] | null; failed: boolean } | undefined>(undefined)
  const ownAsked = useRef(0)
  const retryFor = useRef<string | null>(null)
  const wantsOwn = rules === undefined && (blockedNeed == null || allowedNeed == null)
  useEffect(() => {
    /* A read that failed is tried again on the next name typed. */
    if (!wantsOwn || (own !== undefined && !own.failed) || field.trim() === '') return
    if (own?.failed === true && own.rules === null && ownAsked.current > 0 && retryFor.current === field) return
    retryFor.current = field
    const mine = ++ownAsked.current
    setOwn({ rules: null, failed: false })
    const read = (list: DomainList, may: boolean) => (may ? readRuleExport(list, token) : null)
    void Promise.all([read('blocked', blockedNeed == null), read('allowed', allowedNeed == null)]).then(([b, a]) => {
      if (mine !== ownAsked.current) return
      const failed = [b, a].some((o) => o != null && o.kind !== 'ok')
      setOwn({
        rules: failed ? null : mergeRules(b?.kind === 'ok' ? b.data : null, a?.kind === 'ok' ? a.data : null),
        failed,
      })
    })
  }, [wantsOwn, own, field, token, blockedNeed, allowedNeed])
  useEffect(() => () => {
    ownAsked.current++
  }, [])

  const known = rules !== undefined ? rules : (own?.rules ?? null)
  const knownFailed = rules !== undefined ? rulesFailed : (own?.failed ?? false)
  const ascii = asciiName(field)
  const hint = ascii == null || problem != null
    ? null
    : knownFailed
      ? { tone: 'none' as const, text: 'Could not read your rules.' }
      : known == null
        ? null
        : ruleHint(ascii, known, { blocked: blockedNeed, allowed: allowedNeed })

  /*
  `?check=<domain>`: the command palette's `Check <domain> in Blocking` (deviation
  26). The name goes into the field and is checked once, as a click on Check would;
  the parameter leaves the bar by replacing the entry.
  */
  useEffect(() => {
    const asked = readParam('check')
    if (asked == null) return
    dropParams(['check'])
    setField(asked)
    void check(asked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function check(name?: string) {
    const domain = (name ?? field).trim()
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
    /* The rules changed: the bar's own copy is read again with the next name. */
    if (rules === undefined) {
      ownAsked.current++
      setOwn(undefined)
    }
    onNotice(
      list === 'allowed'
        ? { type: 'success', title: 'Allowed!', text: `Domain '${domain}' was added to Allowed Zone successfully.` }
        : { type: 'success', title: 'Blocked!', text: `Domain '${domain}' was added to Blocked Zone successfully.` },
    )
    onChanged(list, domain)
  }

  return (
    <Panel className={styles.commandPanel}>
      <Body className={styles.commandBody}>
        <form
          className={styles.add}
          onSubmit={(e) => {
            e.preventDefault()
            void run('blocked')
          }}
        >
          <h2 className={styles.commandTitle}>Check, block or allow a domain</h2>
          <div className={styles.commandField}>
            <label className={styles.offscreen} htmlFor={fieldId}>
              Domain
            </label>
            <Input
              id={fieldId}
              ref={entry}
              mono
              className={styles.bad}
              search
              placeholder="example.com"
              value={field}
              aria-invalid={problem != null || undefined}
              aria-describedby={problem != null ? problemId : hint != null ? hintId : undefined}
              onChange={(e) => {
                setField(e.target.value)
                forget()
              }}
            />
            {/* Under the field it is about, not under the title (2026-11-06). */}
            {problem != null && (
              <div id={problemId} className={styles.invalid} aria-live="polite">
                {problem}
              </div>
            )}
            {hint != null && (
              <div id={hintId} className={`${styles.ruleHint} ${HINT_CLASS[hint.tone]}`}>
                {hint.tone !== 'none' && <Icon name={hint.tone} size={14} />}
                <span>{hint.text}</span>
              </div>
            )}
          </div>
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
          <PermissionButton lead="search"
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
          {checking && <Loading compact announce={false} />}
          {verdict != null && <DomainCheck verdict={verdict} catalog={catalog} />}
        </div>
      </Body>
    </Panel>
  )
}
