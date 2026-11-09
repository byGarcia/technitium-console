import { useRef, useState } from 'react'
import { resolve } from '../../api/dnsclient'
import type { QuickEntry } from '../../lib/quick-lists'
import { loadQuickList } from '../../lib/quick-lists'
import { noticeFromFailure } from '../../lib/notice'
import { minuteStamp } from '../../lib/dates'
import { num2 } from '../dashboard/metrics'
import { Panel, Body } from '../../ui/Panel'
import { PermissionButton } from '../../ui/PermissionButton'
import { Empty, Failure, Loading } from '../../ui/Empty'
import { blockingReasons, reportedListName, type BlockReason } from './check-domain'
import { moreLists } from './extra-lists'
import {
  cachedReport, countLists, namesToCount, readBlockedLog, storeReport,
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

Its words, all OURS: `Blocked by list`, `on <node>`, `Count lists`,
`Not counted yet. One click reads the current blocked log and skips 127.0.0.1 and ::1.`,
`Reading the blocked log…`, `No blocked queries in the current log.`,
`N blocked queries in the log` (and `1 blocked query in the log`), `No list reported`,
`Lookup failed`, `N names` (and `1 name`), `<list>: N blocked`, `Block list`, and the
note under the rows (`Counted once from the current log.`,
`Skipped N from 127.0.0.1 or ::1.`, `This click sent N lookups.` and
`This click sent 1 lookup.`, `and reused N cached names.` and `and reused 1 cached name.`,
`Built-in lists count every match. The Advanced Blocking app names only the first list.`,
`Newest blocked queries only.`).
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
  catalog: readonly QuickEntry[]
}

type View =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'failed'; text: string }
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
    parts.push(`Skipped ${num2(counted.logged.skippedLoopback)} from 127.0.0.1 or ::1.`)
  }
  const lookups = `${num2(counted.lookups)} ${counted.lookups === 1 ? 'lookup' : 'lookups'}`
  const reused = counted.cacheHits > 0
    ? ` and reused ${num2(counted.cacheHits)} cached ${counted.cacheHits === 1 ? 'name' : 'names'}`
    : ''
  parts.push(`This click sent ${lookups}${reused}.`)
  parts.push('Built-in lists count every match. The Advanced Blocking app names only the first list.')
  return parts.join(' ')
}

export function ListHits({
  token,
  app,
  node,
  aggregate,
  serverDomain,
  dnsNeed,
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
}) {
  const [view, setView] = useState<View>({ kind: 'idle' })
  const asked = useRef(0)
  const target = aggregate ? '' : node

  async function count() {
    const mine = ++asked.current
    setView({ kind: 'busy' })
    const [page, catalog] = await Promise.all([
      readBlockedLog(token, app, target),
      loadQuickList('quick-block-lists').then((entries) => [...entries, ...moreLists(entries)]),
    ])
    if (mine !== asked.current) return
    if (page.kind !== 'ok') {
      setView({ kind: 'failed', text: noticeFromFailure(page).text })
      return
    }
    const logged = namesToCount(page.data.entries)
    const stats = { lookups: 0, cacheHits: 0 }
    const found = new Map<string, Report>()

    await mapPool(logged.names, LOOKUP_WIDTH, async (row) => {
      const cached = cachedReport(target, row.name)
      if (cached != null) {
        stats.cacheHits++
        found.set(row.name, { ok: cached.ok, reasons: cached.reasons })
        return
      }
      stats.lookups++
      const outcome = await resolve(token, {
        server: 'this-server',
        domain: row.name,
        type: 'TXT',
        protocol: 'UDP',
        dnssec: false,
        eDnsClientSubnet: '',
        node: target,
      })
      const report: Report = outcome.kind === 'ok'
        ? { ok: true, reasons: blockingReasons(outcome.data.response?.result) }
        : { ok: false, reasons: [] }
      storeReport(target, row.name, report)
      found.set(row.name, report)
    })
    if (mine !== asked.current) return

    const result = countLists(logged.names, found)
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
            <Empty compact>Not counted yet. One click reads the current blocked log and skips 127.0.0.1 and ::1.</Empty>
          )}
          {view.kind === 'busy' && <Loading compact>Reading the blocked log…</Loading>}
          {view.kind === 'failed' && <Failure>{view.text}</Failure>}
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
