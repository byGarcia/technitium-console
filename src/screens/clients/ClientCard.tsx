import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useHandoff } from '../../app/handoff'
import type { ChartData, TopKind } from '../../api/dashboard'
import type { DhcpLease } from '../../api/dhcp'
import type { QueryLogEntry } from '../../api/logs'
import { Button } from '../../ui/Button'
import { Card, statStyles } from '../../ui/StatCard'
import { Table } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Empty, Failure, Loading } from '../../ui/Empty'
import { copyText } from '../../lib/copy-text'
import { useDomainAction } from '../../lib/allow-block'
import { dateTime, fromNow } from '../../lib/dates'
import type { Notice } from '../../lib/notice'
import { num2, percentage } from '../dashboard/metrics'
import { tokenForLabel } from '../dashboard/palette'
import { Line } from '../dashboard/Panels'
import { TopRowMenu } from '../dashboard/TopRowMenu'
import { rowClass } from '../logs/QueryLogs'
import type { LoggingApp } from '../blocking/logging-app'
import { LockedBody } from '../blocking/Locked'
import type { Need } from '../blocking/permissions'
import type { TypeCount } from '../blocking/blocked-sample'
import {
  DETAIL_SAMPLE, activity, clientCard, isHeavy, label, latest,
  type ClientRow, type DomainCount,
} from './clients-model'
import { useQuerySample } from './query-sample'
import dash from '../dashboard/Dashboard.module.css'
import logStyles from '../logs/Logs.module.css'
import styles from './Clients.module.css'

/*
A CLIENT'S CARD (CONVENTIONS.md, deviation 25, round 2 of 2026-11-06): the right half
of the Clients page on a wide screen, the page itself on a narrow one. OURS. Every
figure comes from a call upstream's console already makes:

  · its name, queries and tags: the page's row (`dashboard/stats/getTop` and the
    page's log sample, `clients-model.ts`);
  · its lease: `dhcp/leases/list` (DHCP's own call), read by the page only with
    `DhcpServer: View`, matched by address. Only what the lease says: its MAC
    address, its host name and its scope;
  · everything else: `logs/query` filtered by `clientIpAddress`, the filter Query
    Logs has: the newest `DETAIL_SAMPLE` (500) entries of every type, through the
    query logs app, on the node the page's sample reads. From them alone
    (`clientCard`): the queries read, the blocked share (the three blocked
    classes), the cache hit rate (`Cached` over all), the median `responseRtt` of
    the entries that carry one (the cell is not drawn when none does), the
    activity over the sample's own span cut in 24 slices, its top and top blocked
    domains, its protocols and record types, and its ten newest queries.

The log entries carry no node, so there is no "answered by" in a cluster: the
aggregate reads the connected node's log and says `on <node>`.

Its actions are upstream's jumps: `Open in Query Logs` is Query Logs for the client
(the Dashboard's Top Clients menu, main.js:2796), each domain carries Top Domains' or
Top Blocked Domains' menu (`TopRowMenu`). `Copy IP` copies the address (`copyText`).

Its words, all OURS save upstream's `Top Domains`, `Top Blocked Domains`, `Query
Types`, `Protocol`, `Response Type`, `Domain`, `Type` and the response types the server
writes: `Heavy blocking` and `Rate limited` (the tags), `IP`, `MAC`, `Host`, `Scope`,
`Last query`, `N ago`, `Open in Query Logs`, `Copy IP`, `Copied`, `In the latest N
queries` (and `In the latest query`), `on <node>`, `Queries`, `Blocked`, `Cache hit
rate`, `Median response time`, `N blocked`, `N cached`, `of N timed`, `Activity in
the latest N queries`, `Protocols`, `Record Types`, `Latest Queries`, `When`,
`Result`, `Time`, `N ms`, `No queries from this client.`, `No blocked queries.`
(Recently Blocked's), `No query logging app` (Recently Blocked's), `Could not load
this data.` (the Overview's), `No Data` (upstream's) and each bar's `<name>: N`.
*/

export function ClientCard({
  row,
  token,
  app,
  node,
  logNode,
  where,
  logsNeed,
  lease,
  refreshOn,
  onNotice,
  heading = true,
}: {
  row: ClientRow
  token: string | null
  app: LoggingApp
  /** The page's node selector, for the jumps (the aggregate included). */
  node: string
  /** The node whose log is read: empty with the aggregate. */
  logNode: string
  /** ` on <node>` with the aggregate, or empty. */
  where: string
  logsNeed: Need | undefined
  /** Its DHCP lease, when one hands out its address. */
  lease: DhcpLease | null
  refreshOn: unknown
  onNotice: (n: Notice) => void
  /** Its name as the card's title; off where the page's own title already says it. */
  heading?: boolean
}) {
  const handoff = useHandoff()
  const action = useDomainAction(token, onNotice)
  const sample = useQuerySample({
    token,
    app,
    node: logNode,
    clientIp: row.ip,
    limit: DETAIL_SAMPLE,
    refreshOn,
    enabled: logsNeed == null,
  })
  const entries = sample.kind === 'ok' ? sample.entries : null
  const card = useMemo(() => (entries != null ? clientCard(entries) : null), [entries])
  const titleId = useId()

  let gap: ReactNode = null
  if (logsNeed != null) gap = <LockedBody need={logsNeed} />
  else if (sample.kind === 'none') gap = <Empty compact>No query logging app</Empty>
  else if (sample.kind === 'loading') gap = <Loading compact />
  else if (sample.kind === 'failed') gap = <Failure>Could not load this data.</Failure>
  else if (card == null || card.total === 0) gap = <Empty compact>No queries from this client.</Empty>

  const n = card?.total ?? 0
  const basis = n === 1 ? `In the latest query${where}` : `In the latest ${num2(n)} queries${where}`

  return (
    <section className={styles.card} aria-labelledby={heading ? titleId : undefined} aria-label={heading ? undefined : label(row)}>
      <header className={styles.cardHead}>
        <div className={styles.cardWho}>
          {heading && (
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle} id={titleId}>{label(row)}</h2>
              <Tags row={row} />
            </div>
          )}
          {!heading && <Tags row={row} />}
          <dl className={styles.cardFacts}>
            <Fact name="IP" mono>{row.ip}</Fact>
            {lease != null && lease.hardwareAddress !== '' && <Fact name="MAC" mono>{lease.hardwareAddress}</Fact>}
            {lease?.hostName != null && lease.hostName !== '' && <Fact name="Host">{lease.hostName}</Fact>}
            {lease != null && <Fact name="Scope">{lease.scope}</Fact>}
            {card?.last != null && (
              <Fact name="Last query">
                <time dateTime={card.last} title={dateTime(card.last)}>{fromNow(card.last)}</time>
              </Fact>
            )}
          </dl>
        </div>
        <div className={styles.cardActions}>
          <Button size="sm" variant="primary" onClick={() => handoff?.showQueryLogs(null, row.ip, node)}>
            Open in Query Logs
          </Button>
          <CopyIp ip={row.ip} />
        </div>
      </header>

      {gap != null ? (
        <div className={styles.cardGap}>{gap}</div>
      ) : (
        card != null &&
        entries != null && (
          <>
            <p className={styles.basis}>{basis}</p>
            <div className={`${statStyles.grid} ${styles.figures}`} data-cells={card.medianRtt == null ? 3 : 4}>
              <Card title="Queries" colour="var(--ch-total)">
                <div className={statStyles.body}>
                <div className={statStyles.figure}>{num2(card.total)}</div>
                </div>
              </Card>
              <Card title="Blocked" colour="var(--ch-block)">
                <div className={statStyles.body}>
                <div className={statStyles.figure}>{percentage(card.blocked, card.total)}</div>
                <div className={statStyles.caption}>{`${num2(card.blocked)} blocked`}</div>
                </div>
              </Card>
              <Card title="Cache hit rate" colour="var(--ch-cache)">
                <div className={statStyles.body}>
                <div className={statStyles.figure}>{percentage(card.cached, card.total)}</div>
                <div className={statStyles.caption}>{`${num2(card.cached)} cached`}</div>
                </div>
              </Card>
              {card.medianRtt != null && (
                <Card title="Median response time" colour="var(--ch-rec)">
                <div className={statStyles.body}>
                  <div className={statStyles.figure}>{`${card.medianRtt.toFixed(1)} ms`}</div>
                  <div className={statStyles.caption}>
                    {`of ${num2(entries.filter((e) => e.responseRtt != null).length)} timed`}
                  </div>
                </div>
                </Card>
              )}
            </div>

            <Activity entries={entries} n={card.total} />

            <div className={styles.pair}>
              <Domains title="Top Domains" kind="TopDomains" rows={card.domains} node={node} action={action} tone="--ch-total" />
              <Domains title="Top Blocked Domains" kind="TopBlockedDomains" rows={card.blockedDomains} node={node} action={action} tone="--ch-block" />
            </div>
            <div className={styles.pair}>
              <Split title="Protocols" parts={card.protocols} />
              <Counts title="Record Types" parts={card.types} />
            </div>

            <Latest entries={latest(entries)} />
          </>
        )
      )}
    </section>
  )
}

/* The tags the data proves (`clients-model.ts`, THE TWO TAGS). */
export function Tags({ row }: { row: ClientRow }) {
  const heavy = isHeavy(row)
  if (!heavy && !row.rateLimited) return null
  return (
    <span className={styles.tags}>
      {heavy && <span className={styles.tagBlock}>Heavy blocking</span>}
      {row.rateLimited && <span className={styles.tagWarn}>Rate limited</span>}
    </span>
  )
}

function Fact({ name, mono = false, children }: { name: string; mono?: boolean; children: ReactNode }) {
  return (
    <div>
      <dt>{name}</dt>
      <dd className={mono ? styles.mono : undefined}>{children}</dd>
    </div>
  )
}

/* Copies the address and says so for two seconds, as the update dialog's Copy. */
function CopyIp({ ip }: { ip: string }) {
  const [copied, setCopied] = useState(false)
  const at = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])
  return (
    <div ref={at} className={styles.copy}>
      <Button size="sm" onClick={() => void copyText(ip, at.current ?? undefined).then(setCopied)}>
        {copied ? 'Copied' : 'Copy IP'}
      </Button>
    </div>
  )
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** A slice's start in the browser's time: `HH:mm`, with the day when the span passes one. */
function sliceLabel(at: number, withDay: boolean): string {
  const d = new Date(at)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withDay ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}` : time
}

/* The sample over its own span: Total and Blocked per slice, the Dashboard's line. */
function Activity({ entries, n }: { entries: QueryLogEntry[]; n: number }) {
  const id = useId()
  const data = useMemo<ChartData | null>(() => {
    const a = activity(entries)
    if (a == null) return null
    const span = a.starts.length > 1 ? a.starts[a.starts.length - 1] - a.starts[0] : 0
    const withDay = span > 20 * 3600 * 1000
    return {
      labels: a.starts.map((s) => sliceLabel(s, withDay)),
      datasets: [
        { label: 'Total', data: a.total },
        { label: 'Blocked', data: a.blocked },
      ],
    }
  }, [entries])
  if (data == null) return null
  return (
    <section className={styles.activity} aria-labelledby={id}>
      <h3 className={dash.partTitle} id={id}>
        {n === 1 ? 'Activity in the latest query' : `Activity in the latest ${num2(n)} queries`}
      </h3>
      <Line data={data} height={170} />
    </section>
  )
}

/* A list of domains, drawn as the Dashboard's top lists: rank, name, count, menu, bar. */
function Domains({
  title,
  kind,
  rows,
  node,
  action,
  tone,
}: {
  title: string
  kind: TopKind
  rows: DomainCount[]
  node: string
  action: ReturnType<typeof useDomainAction>
  tone: string
}) {
  const id = useId()
  const largest = rows[0]?.count ?? 0
  return (
    <section className={styles.part} aria-labelledby={id}>
      <h3 className={dash.partTitle} id={id}>{title}</h3>
      {rows.length === 0 ? (
        <Empty compact>{kind === 'TopBlockedDomains' ? 'No blocked queries.' : 'No Data'}</Empty>
      ) : (
        <div className={styles.rows} style={{ ['--bar' as string]: `var(${tone})` }}>
          {rows.map((r, i) => (
            <div className={dash.toprow} key={r.domain}>
              <span className={dash.topRank}>{i + 1}</span>
              <span className={dash.n} title={r.domain}>
                <span className={`${dash.topLabel} ${styles.mono}`}>{r.domain}</span>
              </span>
              <span className={dash.c}>{num2(r.count)}</span>
              <TopRowMenu kind={kind} name={r.domain} node={node} action={action} />
              <span className={dash.topBar} role="img" aria-label={`${r.domain}: ${num2(r.count)}`}>
                <i style={{ width: `${largest > 0 ? (r.count / largest) * 100 : 0}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* Record types as bars, one line each: the name, its count, its bar. */
function Counts({ title, parts }: { title: string; parts: TypeCount[] }) {
  const id = useId()
  const largest = parts[0]?.count ?? 0
  if (parts.length === 0) return null
  return (
    <section className={styles.part} aria-labelledby={id}>
      <h3 className={dash.partTitle} id={id}>{title}</h3>
      <div className={styles.rows} style={{ ['--bar' as string]: 'var(--ch-total)' }}>
        {parts.slice(0, 6).map((t) => (
          <div className={`${dash.toprow} ${styles.countRow}`} key={t.type}>
            <span className={dash.n}>
              <span className={`${dash.topLabel} ${styles.mono}`}>{t.type}</span>
            </span>
            <span className={dash.c}>{num2(t.count)}</span>
            <span className={dash.topBar} role="img" aria-label={`${t.type}: ${num2(t.count)}`}>
              <i style={{ width: `${largest > 0 ? (t.count / largest) * 100 : 0}%` }} />
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* A breakdown as a stacked bar and its legend, as Blocked by client's types. */
function Split({ title, parts }: { title: string; parts: TypeCount[] }) {
  const id = useId()
  const total = parts.reduce((n, t) => n + t.count, 0)
  if (parts.length === 0) return null
  return (
    <section className={styles.part} aria-labelledby={id}>
      <h3 className={dash.partTitle} id={id}>{title}</h3>
      <div className={dash.stack}>
        {parts.map((t, i) => (
          <i
            key={t.type}
            className={dash.segment}
            title={`${t.type}: ${num2(t.count)} (${percentage(t.count, total)})`}
            style={{ flexGrow: t.count, background: `var(${tokenForLabel(t.type, i)})` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className={`${dash.stackLegend} ${dash.legend}`}>
        {parts.map((t, i) => (
          <span key={t.type} className={`${dash.lg} ${dash.lgStill}`} title={num2(t.count)}>
            <i style={{ background: `var(${tokenForLabel(t.type, i)})` }} />
            {t.type} <b>{percentage(t.count, total)}</b>
          </span>
        ))}
      </div>
    </section>
  )
}

/* The newest queries, one line each, with Query Logs' coloured response pill. */
function Latest({ entries }: { entries: QueryLogEntry[] }) {
  const id = useId()
  return (
    <section className={styles.latest} aria-labelledby={id}>
      <h3 className={dash.partTitle} id={id}>Latest Queries</h3>
      <Table
        stack
        tableClass={styles.latestTable}
        header={
          <>
            <th>When</th>
            <th>Domain</th>
            <th>Type</th>
            <th>Result</th>
            <th className={styles.numHead}>Time</th>
          </>
        }
        columns={5}
      >
        {entries.map((e) => (
          <tr key={`${e.rowNumber}:${e.timestamp}`}>
            <td className={styles.when}>
              <time dateTime={e.timestamp} title={dateTime(e.timestamp)}>{fromNow(e.timestamp)}</time>
            </td>
            <td className={`${styles.mono} ${tbl.lead} ${styles.domainCell}`}>{e.qname === '' ? '.' : (e.qname ?? '')}</td>
            <td className={styles.mono}>{e.qtype ?? ''}</td>
            <td>
              <span className={`${logStyles.tone} ${rowClass(e)}`}>{e.responseType}</span>
            </td>
            <td className={styles.num}>{e.responseRtt != null ? `${e.responseRtt.toFixed(2)} ms` : '—'}</td>
          </tr>
        ))}
      </Table>
    </section>
  )
}
