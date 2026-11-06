import { type ReactNode } from 'react'
import { SectionHeader } from '../../ui/SectionHeader'
import { dateTime } from '../../lib/dates'
import { Panel } from '../../ui/Panel'
import { DomainName } from '../../ui/DomainName'
import { BrandMark } from '../../app/BrandMark'
import { Icon, type IconName } from '../../ui/Icon'
import styles from './About.module.css'

interface Info { version: string; uptimestamp: string; dnsServerDomain: string }

/*
ABOUT READS LIKE THE OTHER SCREENS (deviation 9 in CONVENTIONS.md, rewritten on
2026-11-06). Upstream's About is one centred column: the logo, the name, `Version
X`, `Server up since …`, and then its prose, heading after heading
(`index.html:3641-3680`). Here the same words are laid out the way Zones and Cache
are:

  · The header is the object: Technitium's logo, `Technitium DNS Server` and the
    server's domain under it, with the path `About ›` above.
  · Three cards say what is running: the DNS Server's version, how long it has
    been up (and since when), and this console's version and licence.
  · Upstream's sections are blocks of their own: `Documentation` (What's New?, API
    Documentation and Help Topics as link rows, each with its sentence),
    `Support` (its four destinations as rows), `License` and `Donate`. Every
    sentence and every destination is upstream's, word for word.
  · The console's own column, under its card: `On GitHub` (its four destinations)
    and `Support the Console`.

Everything comes from the session the chrome already holds (`info`): this screen
asks the server for nothing, so it has no loading and no failure state. Whether
there is an update is not said here: the chrome checks once and marks the version
it concerns (`app/Versions`), and that answer does not reach this screen.

There was an update panel here once, with a `Check for Update` button and four
sentences, none of which exists upstream (checked against the `ref` instance on
2026-09-04). It is gone and the tests keep it gone.
*/

/* The two destinations that repeat, so text and title do not drift apart. */
const WHATS_NEW = 'https://go.technitium.com/?id=23'
const API_DOCS = 'https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md'
const HELP = 'https://go.technitium.com/?id=25'
const DONATE = 'https://go.technitium.com/?id=35'
/* This console's repository and where it is funded (`.github/FUNDING.yml`). */
const CONSOLE_REPO = 'https://github.com/byGarcia/technitium-console'
const CONSOLE_LINKS: readonly [string, string][] = [
  ['Source code', ''],
  ['Release notes', '/releases'],
  ['Report a problem', '/issues'],
  ['Ideas and questions', '/discussions'],
]
const FUNDING: readonly [string, string][] = [
  ['GitHub Sponsors', 'https://github.com/sponsors/byGarcia'],
  ['Ko-fi', 'https://ko-fi.com/bygarcia'],
  ['Liberapay', 'https://liberapay.com/bygarcia'],
  ['PayPal', 'https://www.paypal.com/paypalme/adriangmolina'],
]

/** External link: always in a new tab and without handing over the `opener`. */
function Link({ href, cls, children }: { href: string; cls?: string; children: ReactNode }) {
  return (
    <a className={cls} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/*
A destination as a row: the whole row opens it, the way the console's own rows
did. The row's link is `primary`: its box is stretched over the row, so the row is
one target of a full row's height. A sentence under it keeps its own inline link
(upstream writes both, `What's New?` and `change log`), raised above the stretched
box so it stays a target of its own.
*/
function LinkRow({ icon = 'external', children, note }: { icon?: IconName; children: ReactNode; note?: ReactNode }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowText}>
        {children}
        {note != null && <p className={styles.rowNote}>{note}</p>}
      </div>
      <Icon name={icon} size={14} className={styles.rowIcon} />
    </li>
  )
}

/** The link that stands for its row (`LinkRow`): a link inside the row's
 *  sentence, or the row's name (`label`), bolder as a heading (`title`). */
function Primary({ href, look = 'inline', children }: { href: string; look?: 'inline' | 'label' | 'title'; children: ReactNode }) {
  const cls = [styles.primary, look !== 'inline' && styles.label, look === 'title' && styles.rowTitle]
    .filter(Boolean)
    .join(' ')
  return (
    <Link href={href} cls={cls}>
      {children}
    </Link>
  )
}

/*
How long the server has been up, from the start time the session carries. OURS:
upstream writes only `moment().fromNow()` ("2 days ago"), which reads as a date,
not a span. Two units, the largest first, as the Cache's TTLs read (`1h20m7s`).
*/
export function uptime(iso: string, now: number = Date.now()): string | null {
  const start = new Date(iso).getTime()
  if (Number.isNaN(start)) return null
  const minutes = Math.max(0, Math.floor((now - start) / 60000))
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

export function About({ info }: { info?: Info }) {
  const up = info ? uptime(info.uptimestamp) : null
  return (
    <>
      {/* The console's mark, the side panel's (`app/BrandMark`), where upstream
          puts its logo right above the name (`index.html:3644`). It was the old
          file until 2026-11-06. */}
      <SectionHeader
        section="About"
        title="Technitium DNS Server"
        mark={<BrandMark size={52} />}
        /* What is running, on the header's line (2026-11-06): an object's page says
           its facts under its name, as a zone says its serial, instead of a row of
           cards. */
        subtitle={
          <span className={styles.facts} aria-label="What is running">
            {info?.dnsServerDomain && (
              <span className={styles.domain}><DomainName name={info.dnsServerDomain} /></span>
            )}
            <span className={styles.fact}>
              DNS Server <b>{info?.version ?? '—'}</b>
            </span>
            <span className={styles.fact}>
              Uptime <b>{up ?? '—'}</b>
              {info && dateTime(info.uptimestamp) && <span className={styles.since}>since {dateTime(info.uptimestamp)}</span>}
            </span>
            <span className={styles.fact}>
              Web Console <b>{__CONSOLE_VERSION__}</b>
            </span>
          </span>
        }
      />

      <div className={styles.blocks}>
        {/* Technitium's, word for word: upstream's headings and sentences. */}
        <div className={styles.column}>
          <Panel title="Documentation">
            <ul className={styles.rows}>
              <LinkRow
                note={
                  <>
                    Read the <Link href={WHATS_NEW} cls={styles.inline}>change log</Link> to know
                    what&apos;s new in this release.
                  </>
                }
              >
                <Primary href={WHATS_NEW} look="title">What&apos;s New?</Primary>
              </LinkRow>
              <LinkRow
                note={
                  <>
                    The DNS Server HTTP API allows any 3rd party app or script to configure the DNS
                    Server. The HTTP API is used by this web console and thus all the actions that
                    this web console does can be performed via the API. Read the{' '}
                    <Link href={API_DOCS} cls={styles.inline}>HTTP API documentation</Link> for
                    complete details.
                  </>
                }
              >
                <Primary href={API_DOCS} look="title">API Documentation</Primary>
              </LinkRow>
              <LinkRow
                note={
                  <>
                    Read the latest{' '}
                    <Link href={HELP} cls={styles.inline}>online help topics</Link> which contains
                    the DNS Server user manual and covers frequently asked questions.
                  </>
                }
              >
                <Primary href={HELP} look="title">Help Topics</Primary>
              </LinkRow>
            </ul>
          </Panel>

          <Panel title="Support">
            <ul className={styles.rows}>
              <LinkRow icon="mail">
                For support, send an email to{' '}
                <Primary href="mailto:support@technitium.com">support@technitium.com</Primary>.
              </LinkRow>
              <LinkRow>
                Follow <Primary href="https://mastodon.social/@technitium">@technitium@mastodon.social</Primary>{' '}
                on Mastodon.
              </LinkRow>
              <LinkRow>
                Checkout <Primary href="https://blog.technitium.com/">Technitium Blog</Primary>.
              </LinkRow>
              <LinkRow>
                Join <Primary href="https://www.reddit.com/r/technitium/">/r/technitium</Primary> on Reddit.
              </LinkRow>
            </ul>
          </Panel>
        </div>

        <div className={styles.column}>
          <Panel title="License">
            <div className={styles.prose}>
              <p>Copyright (C) 2026 Shreyas Zare (shreyas@technitium.com)</p>
              <p>
                This program comes with ABSOLUTELY NO WARRANTY. This is free software, and you are
                welcome to redistribute it under certain conditions.
              </p>
              <p>
                Source code available under{' '}
                <Link href="https://go.technitium.com/?id=24" cls={styles.inline}>GNU General Public License v3.0</Link>{' '}
                on <Link href="https://github.com/TechnitiumSoftware/DnsServer" cls={styles.inline}>GitHub</Link>
              </p>
            </div>
          </Panel>

          {/* Upstream's `Donate` heading is a link to the same place as its
              `Donate Now!`; it stays one, as the panel's title. */}
          <Panel title={<Link href={DONATE} cls={styles.titleLink}>Donate</Link>}>
            <div className={styles.prose}>
              <p>
                Make a contribution to Technitium and help making new software, updates, and features
                possible.
              </p>
              <Link href={DONATE} cls={`${styles.button} ${styles.donate}`}>Donate Now!</Link>
            </div>
          </Panel>
        </div>

        {/* OURS (deviation 9): this console's column, under its card. */}
        <div className={`${styles.column} ${styles.console}`}>
          {/*
          First in its column and marked (2026-11-06): Technitium's Donate beside it
          is the one a reader meets first otherwise, and the two are not the same
          project. The line under the title says where each one goes.
          */}
          <Panel title="Support the Console" className={styles.support}>
            <div className={styles.prose}>
              <p>
                Free, and it stays free. A star or a good bug report helps as much as a donation.
              </p>
              <p className={styles.whereTo}>
                These go to this console&apos;s author. Technitium&apos;s Donate supports the DNS server.
              </p>
              <Link href={FUNDING[0][1]} cls={`${styles.button} ${styles.wide} ${styles.lead}`}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 14.2 6.9 13.2C3 9.7.5 7.4.5 4.6.5 2.3 2.3.5 4.6.5c1.3 0 2.5.6 3.4 1.6C8.9 1.1 10.1.5 11.4.5c2.3 0 4.1 1.8 4.1 4.1 0 2.8-2.5 5.1-6.4 8.6L8 14.2Z" /></svg>
                {FUNDING[0][0]}
              </Link>
              <div className={styles.funding}>
                <Link href={CONSOLE_REPO} cls={styles.button}>Star on GitHub</Link>
                {FUNDING.slice(1).map(([label, href]) => (
                  <Link key={label} href={href} cls={styles.button}>{label}</Link>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="On GitHub">
            <p className={styles.consoleNote}>
              <Link href={`${CONSOLE_REPO}/blob/main/LICENSE`}>GPL-3.0-or-later</Link>. An independent
              project, not affiliated with or endorsed by Technitium.
            </p>
            <ul className={styles.rows}>
              {CONSOLE_LINKS.map(([label, path]) => (
                <LinkRow key={label}>
                  <Primary href={`${CONSOLE_REPO}${path}`} look="label">{label}</Primary>
                </LinkRow>
              ))}
            </ul>
          </Panel>

        </div>
      </div>
    </>
  )
}
