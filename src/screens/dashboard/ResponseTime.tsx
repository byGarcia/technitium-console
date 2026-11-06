import { useMemo } from 'react'
import { Body, Panel } from '../../ui/Panel'
import { Empty, Loading } from '../../ui/Empty'
import { RouteLink } from '../../ui/RouteLink'
import { LockedBody } from '../blocking/Locked'
import { useLoggingApp } from '../blocking/logging-app'
import { useQuerySample } from '../clients/query-sample'
import { BUCKETS, SLOW_MS, ms, responseTimes } from './response-time'
import styles from './ResponseTime.module.css'

/*
Response Time, on the Dashboard (OURS, CONVENTIONS.md deviation 28): how long the
server waited for the upstream answers among the newest 1,000 logged queries, as
the median, the 95th percentile, the share over 100 ms and a histogram. Read
through the first query logs app (`logs/query`, as Blocking's Blocked by client
reads it), again each time the Dashboard's statistics answer; on the cluster
aggregate, the log of the node the console is connected to, and the card says so.

Its words, all OURS: `Response Time`, `Median`, `95th percentile`, `Over 100 ms`,
`Upstream round-trip time of the latest logged queries that were not answered from
cache, a zone or a block.`, `In the last N queries` / `on <node>`, `N timed`,
`No timed queries in the latest N.`, `milliseconds`, and the bucket labels.
*/
export function ResponseTime({
  token,
  node,
  onConnected,
  serverDomain,
  canView,
  refreshOn,
}: {
  token: string | null
  /** The node whose log is read; empty for the connected one. */
  node: string
  /** The Dashboard reads the aggregate: the log is the connected node's. */
  onConnected: boolean
  serverDomain?: string
  canView: boolean
  refreshOn: unknown
}) {
  const app = useLoggingApp(token, canView)
  const sample = useQuerySample({ token, app, node, limit: 1000, refreshOn, enabled: canView })
  const times = useMemo(() => (sample.kind === 'ok' ? responseTimes(sample.entries) : null), [sample])
  const top = times != null ? Math.max(1, ...times.counts) : 1
  const where = onConnected && serverDomain != null && serverDomain !== '' ? ` on ${serverDomain}` : ''

  return (
    <Panel
      title="Response Time"
      className={styles.panel}
      actions={times != null ? <span className={styles.caption}>In the last {times.sampled === 1 ? 'query' : `${times.sampled.toLocaleString('en-US')} queries`}{where}</span> : undefined}
    >
      <Body>
        {!canView ? (
          <LockedBody need="Logs.canView" />
        ) : app.kind === 'none' ? (
          <Empty compact>
            Please install the &apos;Query Logs (Sqlite)&apos; DNS App or any other DNS app that supports query logging
            feature from the <RouteLink to={{ section: 'apps', sub: null }}>Apps</RouteLink> section.
          </Empty>
        ) : sample.kind === 'loading' ? (
          <Loading compact />
        ) : sample.kind !== 'ok' || times == null ? (
          <Empty compact>Could not load this data.</Empty>
        ) : times.timed === 0 ? (
          <Empty compact>No timed queries in the latest {times.sampled.toLocaleString('en-US')}.</Empty>
        ) : (
          <div className={styles.grid}>
            <div>
              <p className={styles.lead}>
                Upstream round-trip time of the latest logged queries that were not answered from cache, a zone or a block.
              </p>
              <dl className={styles.facts}>
                <div>
                  <dt>Median</dt>
                  <dd>{ms(times.p50)}</dd>
                </div>
                <div>
                  <dt>95th percentile</dt>
                  <dd>{ms(times.p95)}</dd>
                </div>
                <div>
                  <dt>Over {SLOW_MS} ms</dt>
                  <dd data-slow={times.slowShare > 0 ? '' : undefined}>{(times.slowShare * 100).toFixed(1)}%</dd>
                </div>
              </dl>
              <p className={styles.note}>{times.timed.toLocaleString('en-US')} timed</p>
            </div>
            <figure className={styles.histogram} aria-label="Response time histogram, in milliseconds">
              <div className={styles.bars}>
                {BUCKETS.map((b, i) => {
                  const n = times.counts[i]
                  return (
                    <div
                      key={b.label}
                      className={styles.bucket}
                      title={`${b.label} ms: ${n.toLocaleString('en-US')}`}
                      data-slow={b.upTo > SLOW_MS ? '' : undefined}
                    >
                      <span className={styles.count}>{n > 0 ? n.toLocaleString('en-US') : ''}</span>
                      <span className={styles.bar} style={{ height: `${n === 0 ? 0 : Math.max(3, (n / top) * 100)}%` }} />
                    </div>
                  )
                })}
              </div>
              <div className={styles.axis} aria-hidden="true">
                {BUCKETS.map((b) => (
                  <span key={b.label}>
                    <span className={styles.full}>{b.label}</span>
                    <span className={styles.short}>{b.short}</span>
                  </span>
                ))}
              </div>
              <figcaption className={styles.unit}>
                milliseconds<span className={styles.short}>, up to</span>
              </figcaption>
            </figure>
          </div>
        )}
      </Body>
    </Panel>
  )
}
