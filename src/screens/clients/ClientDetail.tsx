import { useId, useMemo } from 'react'
import { useHandoff } from '../../app/handoff'
import type { TopKind } from '../../api/dashboard'
import { Button } from '../../ui/Button'
import { Empty, Failure, Loading } from '../../ui/Empty'
import { useDomainAction } from '../../lib/allow-block'
import { dateTime, fromNow } from '../../lib/dates'
import type { Notice } from '../../lib/notice'
import { num2, percentage } from '../dashboard/metrics'
import { tokenForLabel } from '../dashboard/palette'
import { TopRowMenu } from '../dashboard/TopRowMenu'
import type { LoggingApp } from '../blocking/logging-app'
import { LockedBody } from '../blocking/Locked'
import type { Need } from '../blocking/permissions'
import { DETAIL_SAMPLE, clientDetail, type DomainCount } from './clients-model'
import { useQuerySample } from './query-sample'
import type { TypeCount } from '../blocking/blocked-sample'
import dash from '../dashboard/Dashboard.module.css'
import styles from './Clients.module.css'

/*
One client, opened under its row of the Clients table (CONVENTIONS.md, deviation 25).
OURS. Its data is `logs/query` filtered by `clientIpAddress`, the filter Query Logs
has: page 1 of the newest `DETAIL_SAMPLE` (500) entries, every response type,
through the query logs app the page resolved (`useLoggingApp`), on the node the
page's sample reads. It counts, from those entries alone (`clientDetail`): the
domains it asked for most, the domains it got blocked most, its query types and
its response types, and when its newest query was. It says what that is based on,
`In the last N queries` (`on <node>` with the cluster aggregate), since the log has
no per-period counts.

Its actions are upstream's: `Show Query Logs` for the client (the Dashboard's Top
Clients menu, main.js:2796), and on each domain the menu Top Domains and Top Blocked
Domains carry (`TopRowMenu`: Show Query Logs, Query DNS Server, Block Domain or
Allow Domain). The two types are stacked bars with their legends, drawn as Blocked
by client's `Blocked by type` (`blocking/BlockedBy.tsx`) in the Dashboard's colours.

Its words, all OURS save upstream's `Show Query Logs`, `Top Domains`, `Top Blocked
Domains`, `Query Types` and `Query Response Types`: `In the last N queries` (and `In
the last query`), `on <node>`, `Last query`, `No queries from this client.`, `No
blocked queries.` (Recently Blocked's), `No query logging app` (Recently Blocked's),
`Could not load this data.` (the Overview's), `No Data` (upstream's), `Actions for
<domain>` and each bar's `<name>: N`.
*/
export function ClientDetail({
  ip,
  token,
  app,
  node,
  logNode,
  where,
  logsNeed,
  refreshOn,
  onNotice,
}: {
  ip: string
  token: string | null
  app: LoggingApp
  /** The page's node selector, for the jumps (the aggregate included). */
  node: string
  /** The node whose log is read: empty with the aggregate. */
  logNode: string
  /** ` on <node>` with the aggregate, or empty. */
  where: string
  logsNeed: Need | undefined
  refreshOn: unknown
  onNotice: (n: Notice) => void
}) {
  const handoff = useHandoff()
  const action = useDomainAction(token, onNotice)
  const sample = useQuerySample({
    token,
    app,
    node: logNode,
    clientIp: ip,
    limit: DETAIL_SAMPLE,
    refreshOn,
    enabled: logsNeed == null,
  })
  const detail = useMemo(() => (sample.kind === 'ok' ? clientDetail(sample.entries) : null), [sample])

  const show = (
    <Button size="sm" onClick={() => handoff?.showQueryLogs(null, ip, node)}>
      Show Query Logs
    </Button>
  )

  /* Without the log, why goes on the head's line, beside the jump: nothing follows. */
  const without = logsNeed != null
    ? <LockedBody need={logsNeed} />
    : sample.kind === 'none' ? <p className={styles.quiet}>No query logging app</p> : null
  let body
  if (without != null) body = null
  else if (sample.kind === 'loading') body = <Loading compact />
  else if (sample.kind === 'failed') body = <Failure>Could not load this data.</Failure>
  else if (detail == null || detail.total === 0) body = <Empty compact>No queries from this client.</Empty>
  else body = null

  const basis = detail != null && detail.total > 0
    ? detail.total === 1 ? `In the last query${where}` : `In the last ${detail.total.toLocaleString()} queries${where}`
    : null

  return (
    <div className={styles.detail} aria-label={ip} role="group">
      <div className={styles.detailHead}>
        <div className={styles.detailFacts}>
          {without}
          {basis != null && <span className={styles.basis}>{basis}</span>}
          {detail?.last != null && (
            <span className={styles.lastSeen}>
              Last query <time dateTime={detail.last}>{dateTime(detail.last)}</time>{' '}
              <span className={styles.ago}>({fromNow(detail.last)})</span>
            </span>
          )}
        </div>
        {show}
      </div>
      {body != null ? (
        <div className={styles.detailGap}>{body}</div>
      ) : (
        without == null && detail != null && (
          <div className={styles.detailGrid}>
            <Domains title="Top Domains" kind="TopDomains" rows={detail.domains} node={node} action={action} tone="--ch-total" />
            <Domains
              title="Top Blocked Domains"
              kind="TopBlockedDomains"
              rows={detail.blocked}
              node={node}
              action={action}
              tone="--ch-block"
            />
            <div className={styles.types}>
              <Split title="Query Types" parts={detail.types} />
              <Split title="Query Response Types" parts={detail.responses} />
            </div>
          </div>
        )
      )}
    </div>
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
        <div className={styles.domains} style={{ ['--bar' as string]: `var(${tone})` }}>
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

/* A breakdown as a stacked bar and its legend, as Blocked by client's types. */
function Split({ title, parts }: { title: string; parts: TypeCount[] }) {
  const id = useId()
  const total = parts.reduce((n, t) => n + t.count, 0)
  if (parts.length === 0) return null
  return (
    <section aria-labelledby={id}>
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
