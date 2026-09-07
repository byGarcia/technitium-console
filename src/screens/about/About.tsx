import { type ReactNode } from 'react'
import { SectionHeader } from '../../ui/SectionHeader'
import { fromNow, dateTime } from '../../lib/dates'
import styles from './About.module.css'
import { Body, Panel } from '../../ui/Panel'
import { publicUrl } from '../../app/base'

interface Info { version: string; uptimestamp: string; dnsServerDomain: string }

/* The two destinations that repeat, so text and title do not drift apart. */
const API_DOCS = 'https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md'
const DONATE = 'https://go.technitium.com/?id=35'

/** External link: always in a new tab and without handing over the `opener`. */
function Link({
  href,
  cls,
  children,
}: {
  href: string
  cls?: string
  children: ReactNode
}) {
  return (
    <a className={cls} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/*
There is no update panel here, and there was one.

It had a `Check for Update` button and four sentences —«No update available. You
are running the latest version.», «Update notifications are turned off for this
server.», «Unable to check for updates.» and the button's own label— and **none of
the four exists upstream**: not in its `index.html`, not in its `main.js`.
Checked against the `ref` instance on 2026-09-04, contracting this screen.

Upstream checks once, on login, and says so in the chrome —a link that is visible
from all twelve screens— and nowhere else. This console does the same, in
`app/Versions`, where the notice rides on the version it is about. A second,
forced check on the one screen nobody visits was duplicating that notice with
four literals the product does not say.

What stays is the `Server` panel: version and uptime are facts upstream's own
About shows, right under the title.
*/
export function About({ info }: { info?: Info }) {
  return (
    <>
      <SectionHeader title="About" />
    <div className={styles.grid}>
      <Panel>
        <Body>
          <div className={styles.head}>
            {/* Technitium's logo, not an initial of ours. Upstream puts it right
                here (`index.html:3483`) and the file travels in `public/img/`
                since the scaffolding: we had it and were not using it. */}
            <img className={styles.mark} src={publicUrl('img/logo.png')} alt="" width={38} height={38} />
            <div>
              <h2 className={styles.h1}>Technitium DNS Server</h2>
              <div className={styles.view}>Version {info?.version ?? '—'}</div>
            </div>
          </div>
          {/*
          The text and the links are upstream's, literal.

          This screen had been left with the prose and without the destinations:
          of the original panel's nine links, one survived (GitHub). "Help
          Topics", "Support" and "Donate" were missing entirely, and in the ones
          that remained the text still said "read the change log" without "change
          log" leading anywhere.

          It is not a styling detail. A fork that deletes the author's donation
          link, support address and documentation from their panel is removing
          functionality from someone else's product it claims only to be
          repainting; it is of the same family as replacing their logo with an
          initial of its own.
          */}
          <div className={styles.prose}>
            <p>Copyright (C) 2026 Shreyas Zare (shreyas@technitium.com)</p>
            <p>
              This program comes with ABSOLUTELY NO WARRANTY. This is free software, and you are
              welcome to redistribute it under certain conditions.
            </p>
            <p>
              Source code available under{' '}
              <Link href="https://go.technitium.com/?id=24">GNU General Public License v3.0</Link>{' '}
              on <Link href="https://github.com/TechnitiumSoftware/DnsServer">GitHub</Link>
            </p>

            <h4><Link href="https://go.technitium.com/?id=23">What&apos;s New?</Link></h4>
            <p>
              Read the <Link href="https://go.technitium.com/?id=23">change log</Link> to know
              what&apos;s new in this release.
            </p>

            <h4><Link href={API_DOCS}>API Documentation</Link></h4>
            <p>
              The DNS Server HTTP API allows any 3rd party app or script to configure the DNS Server.
              The HTTP API is used by this web console and thus all the actions that this web console
              does can be performed via the API. Read the{' '}
              <Link href={API_DOCS}>HTTP API documentation</Link> for complete details.
            </p>

            <h4><Link href="https://go.technitium.com/?id=25">Help Topics</Link></h4>
            <p>
              Read the latest{' '}
              <Link href="https://go.technitium.com/?id=25">online help topics</Link> which
              contains the DNS Server user manual and covers frequently asked questions.
            </p>

            <h4>Support</h4>
            <p>
              For support, send an email to{' '}
              <Link href="mailto:support@technitium.com">support@technitium.com</Link>.
            </p>
            <p>
              Follow{' '}
              <Link href="https://mastodon.social/@technitium">@technitium@mastodon.social</Link>{' '}
              on Mastodon.
              <br />
              Checkout <Link href="https://blog.technitium.com/">Technitium Blog</Link>.
            </p>
            <p>
              Join <Link href="https://www.reddit.com/r/technitium/">/r/technitium</Link> on Reddit.
            </p>

            <h4><Link href={DONATE}>Donate</Link></h4>
            <p>
              Make a contribution to Technitium and help making new software, updates, and features
              possible.
            </p>
            <p>
              <Link href={DONATE} cls={styles.target}>Donate Now!</Link>
            </p>
          </div>
        </Body>
      </Panel>

      <div className={styles.col}>
        <Panel title="Server">
          <Body>
            <dl className={styles.kv}>
              <dt>Version</dt><dd>{info?.version ?? '—'}</dd>
              <dt>Domain</dt><dd>{info?.dnsServerDomain ?? '—'}</dd>
              <dt>Up since</dt><dd>{info ? dateTime(info.uptimestamp) : '—'}</dd>
              <dt>Uptime</dt><dd>{info ? fromNow(info.uptimestamp) : '—'}</dd>
            </dl>
          </Body>
        </Panel>
      </div>
    </div>
    </>
  )
}
