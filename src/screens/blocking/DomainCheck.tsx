import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../ui/Icon'
import { RouteLink } from '../../ui/RouteLink'
import type { QuickEntry } from '../../lib/quick-lists'
import { reportedListName, type Missing, type Verdict } from './check-domain'
import { requiresText } from './permissions'
import styles from './DomainCheck.module.css'
import { DomainName } from '../../ui/DomainName'
import { UrlText } from '../../ui/UrlText'

/*
The verdict of "Check a domain", drawn under the field it answers (`check-domain.ts`
says how each one is reached). Every sentence here is OURS:
- the titles `Blocked by a block list`, `Blocked by N block lists`, `Blocked by your
  rule`, `Blocked`, `Allowed by your rule`, `Not blocked`, `Not blocked: blocking is
  disabled`, `Not blocked: blocking is paused` and `Cannot tell`;
- `Listed as`, `Rule`, and the links `Open Lists` and `Open Rules`;
- the two "cannot tell" sentences, which quote the server's labels `Blocking Bypass
  List` and `Allow TXT Blocking Report`, and their link `Settings › Blocking`;
- under a "Not blocked", what was not read: `Your allow rules were not checked.`,
  `The blocking settings were not checked.`, `Could not read your allow rules.` and
  `Could not read the blocking settings.`, with the padlock's `Requires X: Y`.

The next step is not here: it is the field's own `Block` and `Allow` right above,
which act on the same name, and the tab that holds the rule or the list.
*/

type Tone = 'blocked' | 'allowed' | 'neutral'

function look(v: Verdict): { title: string; icon: IconName; tone: Tone } {
  switch (v.kind) {
    case 'lists':
      return {
        title: v.lists.length === 1 ? 'Blocked by a block list' : `Blocked by ${v.lists.length} block lists`,
        icon: 'blocked',
        tone: 'blocked',
      }
    case 'rule':
      return { title: 'Blocked by your rule', icon: 'blocked', tone: 'blocked' }
    case 'other':
      return { title: 'Blocked', icon: 'blocked', tone: 'blocked' }
    case 'allowed':
      return { title: 'Allowed by your rule', icon: 'allowed', tone: 'allowed' }
    case 'off':
      return {
        title: v.paused ? 'Not blocked: blocking is paused' : 'Not blocked: blocking is disabled',
        icon: 'power',
        tone: 'neutral',
      }
    case 'bypassed':
    case 'unreported':
      return { title: 'Cannot tell', icon: 'warning', tone: 'neutral' }
    case 'clear':
      return { title: 'Not blocked', icon: 'check', tone: 'neutral' }
  }
}

function Unread({ missing, what, failed }: { missing: Missing; what: string; failed: string }) {
  if ('need' in missing) {
    return (
      <div className={styles.unread}>
        <Icon name="lock" size={13} /> {what} {requiresText(missing.need)}
      </div>
    )
  }
  return (
    <div className={styles.unread}>
      <Icon name="warning" size={13} /> {failed}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <span className={styles.label}>{label}</span> <span className={styles.mono}>{children}</span>
    </div>
  )
}

const BLOCKING_SETTINGS = <RouteLink to={{ section: 'settings', sub: 'Blocking' }}>Settings › Blocking</RouteLink>

export function DomainCheck({ verdict, catalog }: { verdict: Verdict; catalog: readonly QuickEntry[] }) {
  const { title, icon, tone } = look(verdict)

  return (
    <div className={styles.verdict} data-verdict={verdict.kind}>
      <span className={`${styles.mark} ${styles[tone]}`} aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        <div className={styles.name}><DomainName name={verdict.name} /></div>

        {verdict.kind === 'lists' && (
          <>
            <ul className={styles.lists}>
              {verdict.lists.map((url) => {
                const name = reportedListName(url, catalog)
                return (
                  <li key={url}>
                    {name != null && <span className={styles.listName}>{name}</span>}
                    <span className={styles.url}><UrlText url={url} /></span>
                  </li>
                )
              })}
            </ul>
            {verdict.domain.toLowerCase() !== verdict.name.toLowerCase() && (
              <Fact label="Listed as"><DomainName name={verdict.domain} /></Fact>
            )}
            <div className={styles.next}>
              <RouteLink to={{ section: 'blocking', sub: 'Lists' }}>Open Lists</RouteLink>
            </div>
          </>
        )}

        {(verdict.kind === 'rule' || verdict.kind === 'allowed') && (
          <>
            <Fact label="Rule"><DomainName name={verdict.domain} /></Fact>
            <div className={styles.next}>
              <RouteLink to={{ section: 'blocking', sub: 'Rules' }}>Open Rules</RouteLink>
            </div>
          </>
        )}

        {verdict.kind === 'other' &&
          verdict.texts.map((t, i) => (
            <div key={i} className={styles.url}>
              {t}
            </div>
          ))}

        {verdict.kind === 'bypassed' && (
          <div className={styles.why}>
            This server&apos;s own address, <span className={styles.mono}>{verdict.ip}</span>, is on the Blocking
            Bypass List, so the check is never blocked. {BLOCKING_SETTINGS}
          </div>
        )}

        {verdict.kind === 'unreported' && (
          <div className={styles.why}>
            Allow TXT Blocking Report is off, so this server does not say when it blocks. {BLOCKING_SETTINGS}
          </div>
        )}

        {verdict.kind === 'clear' && verdict.unread.allowed != null && (
          <Unread
            missing={verdict.unread.allowed}
            what="Your allow rules were not checked."
            failed="Could not read your allow rules."
          />
        )}
        {verdict.kind === 'clear' && verdict.unread.settings != null && (
          <Unread
            missing={verdict.unread.settings}
            what="The blocking settings were not checked."
            failed="Could not read the blocking settings."
          />
        )}
      </div>
    </div>
  )
}
