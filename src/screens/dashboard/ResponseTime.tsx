import { useMemo } from 'react'
import { Body, Panel } from '../../ui/Panel'
import { Empty, Loading } from '../../ui/Empty'
import { SampleState, type DashboardSample } from './dashboard-sample'
import { BUCKETS, FEW, SLOW_MS, ms, responseTimes, wholePercent } from './response-time'
import styles from './ResponseTime.module.css'

/*
Response Time, on the Dashboard (OURS, CONVENTIONS.md deviation 28): how long the
server waited for the upstream answers among the newest 1,000 logged queries, as
the median, the 95th percentile, the share over 100 ms and a histogram. The read is
the Dashboard's one sample of the log (`dashboard-sample.tsx`); on the cluster
aggregate it is the log of the node the console is connected to, and the card says so.

What it says first is how many answers it stands on (2026-11-06): only the queries
that went upstream carry a time, and on a server that answers most from its cache
that is a handful of the thousand. So the caption gives that count against the
sample, and under 20 timed answers the second figure is `Slowest`: with fewer than
20 values the nearest-rank 95th percentile IS the slowest one, and naming it so
does not dress one reading up as a statistic. The share over 100 ms is in whole
percents (`<1%` for a few, never `0%` when one is), the precision ten readings have.

Its words, all OURS: `Response Time`, `Median`, `95th percentile`, `Slowest`, `Over
100 ms`, `How long upstream took to answer the queries this server could not answer
from its cache, its zones or its block lists.`, `N of the last M queries went upstream`
(`on <node>` after it), `No query in the latest N went upstream.`, `milliseconds`, and
the bucket labels.
*/

export function ResponseTime({ sample, where }: { sample: DashboardSample; where: string }) {
  const times = useMemo(() => (sample.kind === 'ok' ? responseTimes(sample.entries) : null), [sample])
  const top = times != null ? Math.max(1, ...times.counts) : 1

  return (
    <Panel
      title="Response Time"
      className={styles.panel}
      actions={times != null && times.timed > 0 ? (
        <span className={styles.caption}>
          <b>{times.timed.toLocaleString('en-US')}</b> of the last {times.sampled.toLocaleString('en-US')} {times.sampled === 1 ? 'query' : 'queries'} went upstream{where}
        </span>
      ) : undefined}
    >
      <Body>
        {sample.kind !== 'ok' ? (
          <SampleState sample={sample} />
        ) : times == null ? (
          <Loading compact />
        ) : times.timed === 0 ? (
          <Empty compact>No query in the latest {times.sampled.toLocaleString('en-US')} went upstream{where}.</Empty>
        ) : (
          <div className={styles.grid}>
            <div>
              <p className={styles.lead}>
                How long upstream took to answer the queries this server could not answer from its cache, its zones or its block lists.
              </p>
              <dl className={styles.facts}>
                <div>
                  <dt>Median</dt>
                  <dd>{ms(times.p50)}</dd>
                </div>
                <div>
                  <dt>{times.timed < FEW ? 'Slowest' : '95th percentile'}</dt>
                  <dd>{ms(times.p95)}</dd>
                </div>
                <div>
                  <dt>Over {SLOW_MS} ms</dt>
                  <dd data-slow={times.slowShare > 0 ? '' : undefined}>{wholePercent(times.slowShare)}</dd>
                </div>
              </dl>
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
