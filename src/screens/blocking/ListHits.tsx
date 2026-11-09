import { useEffect, useRef, useState } from 'react'
import { listApps } from '../../api/apps'
import { resolve } from '../../api/dnsclient'
import { readSettings } from '../../api/settings'
import type { QuickEntry } from '../../lib/quick-lists'
import { loadQuickList } from '../../lib/quick-lists'
import { noticeFromFailure } from '../../lib/notice'
import { minuteStamp } from '../../lib/dates'
import { isAdvancedBlocking } from '../apps/app-kinds'
import { num2 } from '../dashboard/metrics'
import { Panel, Body } from '../../ui/Panel'
import { PermissionButton } from '../../ui/PermissionButton'
import { RouteLink } from '../../ui/RouteLink'
import { Empty, Failure, Loading } from '../../ui/Empty'
import {
  blockingReasons, reportSilence, reportedListName, serverOwnAddress,
  type BlockReason, type Missing, type ReportSilence,
} from './check-domain'
import { moreLists } from './extra-lists'
import { requiresText } from './permissions'
import {
  cachedReport, countLists, LOOKUP_CAP, namesToCount, planLookups, readBlockedLog, storeReport,
  type CountedList, type CountResult, type LoggedNames,
} from './list-hits'
import type { LoggingApp } from './logging-app'
import dash from '../dashboard/Dashboard.module.css'
import styles from './Overview.module.css'

/*
"Blocked by list": which lists the current blocked log matched, counted once
when Count lists is pressed. It does not run on a timer or when the tab opens.
The log read is `logs/query` (`readBlockedLog`) and each distinct name is one
TXT lookup through DNS Client (`dnsClient/resolve`, type TXT), the same report
Check reads. A later click reuses names already resolved.

Logs belong to ONE node. With the cluster aggregate it reads the node the
console is connected to and says `on <node>`, as Recently Blocked does.

Before any lookup it reads `settings/get` for the same node. When blocking is
disabled or paused, `Allow TXT Blocking Report` is off, or the Blocking Bypass
List covers 127.0.0.1 or ::1, it sends nothing and says why. Without
`Settings: View` it says the settings were not checked and sends nothing.
The first two do not stop it when the Advanced Blocking app is installed
(`apps/list`, read only then): that app blocks and reports by itself.
Changing the node, the token or the logs app clears the rows. An answer still
in flight is not drawn under the new node.

Its words, all OURS: `Blocked by list`, `on <node>`, `Count lists`,
`Not counted yet. One click reads the current blocked log, skips this server's own address, and sends at most 100 lookups. Each lookup is logged as blocked from this server.`,
`Allow TXT Blocking Report has to be enabled, or this server does not say which list matched.`,
`Reading the blocked log…`, `No blocked queries in the current log.`,
`N blocked queries in the log` (and `1 blocked query in the log`), `No list reported`,
`Lookup failed`, `N names` (and `1 name`), `<list>: N blocked`, `Block list`, and the
note under the rows (`Counted once from the current log.`,
`Skipped N from this server's own address.`, `This click sent N lookups.` and
`This click sent 1 lookup.`, `Each one is logged as blocked from this server.`,
`and reused N cached names.` and `and reused 1 cached name.`,
`N names were not looked up.` and `1 name was not looked up.`,
`Built-in lists count every match. The Advanced Blocking app names only the first list.`,
`Advanced Blocking answers for this server's own group, not the client's.`,
`Newest blocked queries only.`).
The lines when nothing is looked up: `Blocking is paused, so nothing was looked up.`,
`Blocking is disabled, so nothing was looked up.`,
`Allow TXT Blocking Report is off, so this server does not say which list matched. Nothing was looked up.`,
`This server's own address, <ip>, is on the Blocking Bypass List, so a lookup from here is never blocked. Nothing was looked up.`,
`The blocking settings were not checked.`, `Could not read the blocking settings. Nothing was looked up.`,
and the link `Blocking › Settings`.
`Advanced Blocking` is the name drawn when the app reports no list URL. `Block list`
is the name drawn when a URL has no catalogue name and no file name.
*/

const LOOKUP_WIDTH = 4

interface Report {
  ok: boolean
  reasons: BlockReason[]
}

interface Counted {
  at: string
  logged: LoggedNames
  result: CountResult
  lookups: number
  cacheHits: number
  truncated: boolean
  omittedDomains: number
  catalog: readonly QuickEntry[]
}

type Held = ReportSilence | { kind: 'unread'; missing: Missing }

type View =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'failed'; text: string }
  | { kind: 'held'; held: Held }
  | { kind: 'ok'; counted: Counted }

async function mapPool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const workers = Math.min(limit, items.length)
  if (workers === 0) return
  let cursor = 0
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: workers }, () => run()))
}

function listLabel(list: CountedList, catalog: readonly QuickEntry[]): string {
  if (list.app || list.url === '') {
    return list.group != null && list.group !== '' ? `Advanced Blocking · ${list.group}` : 'Advanced Blocking'
  }
  return reportedListName(list.url, catalog) ?? fileName(list.url)
}

function fileName(url: string): string {
  try {
    const parsed = new URL(url)
    const seg = parsed.pathname.split('/').filter((part) => part !== '').pop()
    return seg || parsed.hostname || 'Block list'
  } catch {
    const seg = url.split('/').filter((part) => part !== '').pop()
    return seg || 'Block list'
  }
}

function note(counted: Counted): string {
  const parts: string[] = []
  if (counted.truncated) parts.push('Newest blocked queries only.')
  parts.push('Counted once from the current log.')
  if (counted.logged.skippedLoopback > 0) {
    parts.push(`Skipped ${num2(counted.logged.skippedLoopback)} from this server's own address.`)
  }
  const lookups = `${num2(counted.lookups)} ${counted.lookups === 1 ? 'lookup' : 'lookups'}`
  const reused = counted.cacheHits > 0
    ? ` and reused ${num2(counted.cacheHits)} cached ${counted.cacheHits === 1 ? 'name' : 'names'}`
    : ''
  const sent = `This click sent ${lookups}${reused}.`
  parts.push(counted.lookups > 0 ? `${sent} Each one is logged as blocked from this server.` : sent)
  if (counted.omittedDomains === 1) parts.push('1 name was not looked up.')
  else if (counted.omittedDomains > 1) parts.push(`${num2(counted.omittedDomains)} names were not looked up.`)
  parts.push('Built-in lists count every match. The Advanced Blocking app names only the first list.')
  parts.push("Advanced Blocking answers for this server's own group, not the client's.")
  return parts.join(' ')
}

function heldText(held: Held): string {
  switch (held.kind) {
    case 'off':
      return held.paused
        ? 'Blocking is paused, so nothing was looked up.'
        : 'Blocking is disabled, so nothing was looked up.'
    case 'unreported':
      return 'Allow TXT Blocking Report is off, so this server does not say which list matched. Nothing was looked up.'
    case 'bypassed':
      return `This server's own address, ${held.ip}, is on the Blocking Bypass List, so a lookup from here is never blocked. Nothing was looked up.`
    case 'unread':
      return 'need' in held.missing
        ? `The blocking settings were not checked. ${requiresText(held.missing.need)}`
        : 'Could not read the blocking settings. Nothing was looked up.'
  }
}

const SETTINGS_LINK = <RouteLink to={{ section: 'blocking', sub: 'Settings' }}>Blocking › Settings</RouteLink>

export function ListHits({
  token,
  app,
  node,
  aggregate,
  serverDomain,
  dnsNeed,
  settingsNeed,
}: {
  token: string | null
  /** The query logs app, already resolved (`useLoggingApp`). */
  app: Extract<LoggingApp, { kind: 'ok' }>['app']
  /** The Overview's node selector. */
  node: string
  aggregate: boolean
  serverDomain: string | undefined
  /** `DnsClient.canView` when it is missing. The count looks names up. */
  dnsNeed?: string
  /** `Settings.canView` when it is missing. The count reads the blocking settings first. */
  settingsNeed?: string
}) {
  const [view, setView] = useState<View>({ kind: 'idle' })
  const asked = useRef(0)
  const target = aggregate ? '' : node
  /* The rows on screen answer one node. A new token, node or app starts empty. */
  const context = `${token ?? ''}|${target}|${app.name}|${app.classPath}|${settingsNeed ?? ''}`
  const shown = useRef(context)

  useEffect(() => {
    if (shown.current === context) return
    shown.current = context
    asked.current += 1
    setView({ kind: 'idle' })
  }, [context])

  async function count() {
    const mine = ++asked.current
    const where = target
    setView({ kind: 'busy' })
    if (settingsNeed != null) {
      setView({ kind: 'held', held: { kind: 'unread', missing: { need: settingsNeed } } })
      return
    }
    const [settingsOutcome, page, catalog] = await Promise.all([
      readSettings(token, where),
      readBlockedLog(token, app, where),
      loadQuickList('quick-block-lists').then((entries) => [...entries, ...moreLists(entries)]),
    ])
    if (mine !== asked.current) return
    if (settingsOutcome.kind !== 'ok') {
      setView({ kind: 'held', held: { kind: 'unread', missing: { failed: true } } })
      return
    }
    let silence = reportSilence(settingsOutcome.data)
    if (silence != null && silence.kind !== 'bypassed') {
      const apps = await listApps(token, where)
      if (mine !== asked.current) return
      if (apps.kind === 'ok' && (apps.data.response.apps ?? []).some(isAdvancedBlocking)) {
        silence = reportSilence(settingsOutcome.data, Date.now(), true)
      }
    }
    if (silence != null) {
      setView({ kind: 'held', held: silence })
      return
    }
    if (page.kind !== 'ok') {
      setView({ kind: 'failed', text: noticeFromFailure(page).text })
      return
    }
    const logged = namesToCount(page.data.entries, serverOwnAddress(settingsOutcome.data))
    const plan = planLookups(logged.names, (name) => cachedReport(where, name) != null)
    const stats = { lookups: 0, cacheHits: plan.cached.length }
    const found = new Map<string, Report>()
    for (const row of plan.cached) {
      const cached = cachedReport(where, row.name)
      if (cached == null) continue
      found.set(row.name, { ok: cached.ok, reasons: cached.reasons })
    }

    await mapPool(plan.fetch, LOOKUP_WIDTH, async (row) => {
      stats.lookups++
      const outcome = await resolve(token, {
        server: 'this-server',
        domain: row.name,
        type: 'TXT',
        protocol: 'UDP',
        dnssec: false,
        eDnsClientSubnet: '',
        node: where,
      })
      const report: Report = outcome.kind === 'ok'
        ? { ok: true, reasons: blockingReasons(outcome.data.response?.result) }
        : { ok: false, reasons: [] }
      storeReport(where, row.name, report)
      found.set(row.name, report)
    })
    if (mine !== asked.current) return

    const result = countLists([...plan.cached, ...plan.fetch], found)
    /* A row with no question name was not looked up. It adds to the failed hits
       and not to the name count: there is no name to count. */
    if (logged.unnamedHits > 0) result.unresolved.hits += logged.unnamedHits
    setView({
      kind: 'ok',
      counted: {
        at: new Date().toISOString(),
        logged,
        result,
        lookups: stats.lookups,
        cacheHits: stats.cacheHits,
        truncated: page.data.truncated,
        omittedDomains: plan.omittedDomains,
        catalog,
      },
    })
  }

  return (
    <Panel
      title={aggregate && serverDomain != null ? (
        <>
          Blocked by list <span className={styles.where}>on {serverDomain}</span>
        </>
      ) : 'Blocked by list'}
      actions={(
        <PermissionButton type="button" permission={dnsNeed} disabled={view.kind === 'busy'} onClick={() => void count()}>
          Count lists
        </PermissionButton>
      )}
    >
      <Body>
        <div aria-live="polite">
          {view.kind === 'idle' && (
            <Empty compact>
              {`Not counted yet. One click reads the current blocked log, skips this server's own address, and sends at most ${num2(LOOKUP_CAP)} lookups. Each lookup is logged as blocked from this server. Allow TXT Blocking Report has to be enabled, or this server does not say which list matched.`}
            </Empty>
          )}
          {view.kind === 'busy' && <Loading compact>Reading the blocked log…</Loading>}
          {view.kind === 'failed' && <Failure>{view.text}</Failure>}
          {view.kind === 'held' && (
            <Empty compact>
              {heldText(view.held)}
              {view.held.kind !== 'unread' && <> {SETTINGS_LINK}</>}
            </Empty>
          )}
          {view.kind === 'ok' && <Rows counted={view.counted} />}
        </div>
      </Body>
    </Panel>
  )
}

function Rows({ counted }: { counted: Counted }) {
  const extras = [
    counted.result.unmatched.hits > 0
      ? { key: 'unmatched', label: 'No list reported', hits: counted.result.unmatched.hits, domains: counted.result.unmatched.domains, dim: true }
      : null,
    counted.result.unresolved.hits > 0
      ? { key: 'unresolved', label: 'Lookup failed', hits: counted.result.unresolved.hits, domains: counted.result.unresolved.domains, dim: true }
      : null,
  ].filter((row) => row != null)
  const rows = [
    ...counted.result.lists.map((list) => ({
      key: `${list.app}\n${list.url}\n${list.group ?? ''}`,
      label: listLabel(list, counted.catalog),
      title: list.url,
      hits: list.hits,
      domains: list.domains,
      dim: false,
    })),
    ...extras.map((row) => ({ ...row, title: '' })),
  ]
  const largest = Math.max(1, ...rows.map((row) => row.hits))
  const when = minuteStamp(counted.at)

  if (counted.logged.blockedQueries === 0 && counted.logged.skippedLoopback === 0) {
    return <Empty compact>No blocked queries in the current log.</Empty>
  }

  return (
    <div className={styles.listCount}>
      <div className={styles.listHead}>
        <span>
          {counted.logged.blockedQueries === 1
            ? '1 blocked query in the log'
            : `${num2(counted.logged.blockedQueries)} blocked queries in the log`}
        </span>
        {when !== '' && <span className={styles.time}>{when}</span>}
      </div>
      {rows.length === 0 ? (
        <Empty compact>No blocked queries in the current log.</Empty>
      ) : (
        <div className={styles.clients} style={{ ['--bar' as string]: 'var(--ch-block)' }}>
          {rows.map((row, i) => (
            <div className={`${dash.toprow} ${row.dim ? dash.dim : ''}`} key={row.key} title={row.title || undefined}>
              <span className={dash.topRank}>{i + 1}</span>
              <span className={dash.n}>
                <span className={dash.topLabel}>{row.label}</span>
                {row.domains > 0 && (
                  <span className={dash.topDomain}>
                    {`${num2(row.domains)} ${row.domains === 1 ? 'name' : 'names'}`}
                  </span>
                )}
              </span>
              <span className={dash.c}>{num2(row.hits)}</span>
              <span />
              <span className={dash.topBar} role="img" aria-label={`${row.label}: ${num2(row.hits)} blocked`}>
                <i style={{ width: `${(row.hits / largest) * 100}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
      <p className={styles.listNote}>{note(counted)}</p>
    </div>
  )
}
