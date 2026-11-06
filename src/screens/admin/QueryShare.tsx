import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { RANGE_LABEL, type Range } from '../../api/dashboard'
import { Panel } from '../../ui/Panel'
import { Loading, Failure, Empty } from '../../ui/Empty'
import { Segmented } from '../../ui/Segmented'
import { Locked } from '../blocking/Locked'
import { nodeToken } from '../dashboard/palette'
import { readShares, sharesOf, type NodeRead } from './query-share'
import styles from './QueryShare.module.css'

/*
QUERIES ACROSS NODES (OURS, CONVENTIONS.md deviation 40, 2026-11-06). Under the
Cluster table while the cluster is initialised: the period's `Total Queries` of each
node (`dashboard/stats/get` with that node's `node`, `query-share.ts`) as one bar
split by node, each segment in the node's colour (`nodeToken`, by its place in the
list of nodes, the one Cache and the Dashboard give it), and under it a line per
node with its count and its share. Last Day first, with the Dashboard's periods
beside the title (not Custom, which needs its two dates); it reads again with each
period and each time the sub-tab reads the cluster's state (arrival and Refresh).

A node that does not answer is left out of the bar and named once, with the
server's message. Without `Dashboard: View` nothing is read and the card is locked.

Its words, all OURS: the title `Queries Across Nodes`, its sentence, `<node> did not
answer: <message>` (deviation 31's), `No node answered.` and `No queries for this
period.` (the Dashboard's). The period labels are upstream's (`RANGE_LABEL`).
*/

const PERIODS = ['LastHour', 'LastDay', 'LastWeek', 'LastMonth', 'LastYear'] as const satisfies readonly Range[]

export function QueryShare({
  token,
  nodes,
  canView,
  refreshOn,
}: {
  token: string | null
  /** The cluster's nodes, in the server's order: a node's colour is its place here. */
  nodes: readonly string[]
  /** `Dashboard.canView`: the server's permission for `dashboard/stats/get`. */
  canView: boolean
  refreshOn: unknown
}) {
  const key = nodes.join('\n')
  const [range, setRange] = useState<Range>('LastDay')
  const [reads, setReads] = useState<{ range: Range; reads: NodeRead[] } | null>(null)

  useEffect(() => {
    if (!canView) return
    let live = true
    void readShares(token, range, key === '' ? [] : key.split('\n')).then((r) => {
      if (live) setReads({ range, reads: r })
    })
    return () => {
      live = false
    }
  }, [token, key, canView, range, refreshOn])

  const current = reads != null && reads.range === range ? reads.reads : null
  const shares = useMemo(() => (current == null ? null : sharesOf(current)), [current])

  if (!canView) return <Locked title="Queries Across Nodes" need="Dashboard.canView" />

  const colour = (node: string) => ({ '--nd': `var(${nodeToken(Math.max(0, nodes.indexOf(node)))})` }) as CSSProperties

  return (
    <Panel
      title="Queries Across Nodes"
      className={styles.panel}
      actions={
        <Segmented
          label="Period"
          compact
          options={PERIODS.map((r) => ({ id: r, label: RANGE_LABEL[r] }))}
          active={range}
          onChoose={setRange}
        />
      }
    >
      <div className={styles.body}>
        <p className={styles.note}>
          Total Queries for the period, split by the node that answered them.
        </p>
        {shares == null ? (
          <Loading compact />
        ) : shares.shares.length === 0 ? (
          <Failure>No node answered.</Failure>
        ) : shares.total === 0 ? (
          <Empty compact>No queries for this period.</Empty>
        ) : (
          <>
            <div className={styles.bar} aria-hidden="true">
              {shares.shares.map((s) =>
                s.count > 0 ? (
                  <span key={s.node} className={styles.segment} style={{ ...colour(s.node), flexGrow: s.fraction }} />
                ) : null,
              )}
            </div>
            <ul className={styles.list}>
              {shares.shares.map((s) => (
                <li key={s.node}>
                  <span className={styles.node} style={colour(s.node)}>{s.node}</span>
                  <span className={styles.count}>{s.count.toLocaleString()}</span>
                  <span className={styles.percent}>{s.percent}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {shares != null &&
          shares.failed.map((f) => (
            <p key={f.node} className={styles.failed}>
              <span className={styles.failedNode}>{f.node}</span> did not answer: {f.message}
            </p>
          ))}
      </div>
    </Panel>
  )
}
