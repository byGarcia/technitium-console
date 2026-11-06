import { useEffect, useState, type CSSProperties } from 'react'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import { Panel } from '../../ui/Panel'
import { Table } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Loading } from '../../ui/Empty'
import { PermissionButton } from '../../ui/PermissionButton'
import { nextUpdateText } from '../settings/panes/Blocking'
import { nodeToken } from '../dashboard/palette'
import { fromNow, minuteStamp } from '../../lib/dates'
import { lastUpdateOf } from './list-history'
import { nodeFailure, readListsOnNodes, type NodeLists } from './lists-on-nodes'
import styles from './ListsOnNodes.module.css'

/*
BLOCK LISTS ACROSS NODES (OURS, CONVENTIONS.md deviation 39, 2026-11-06). On an initialised
cluster, a card on the Lists tab with one row per node of the session's list: its
`Block List Domains`, when it last updated its lists and when it updates them next,
each from that node's own answer (`lists-on-nodes.ts`). Read when the tab opens and
again whenever the tab reads its counts (after a Save or an Update Now has waited
for the reload).

Update Now is upstream's one call, `settings/forceUpdateBlockLists`, which upstream
sends with no `node` (main.js:2342-2366). The server runs it on the node it reaches
and passes it on to every other node itself (WebServiceSettingsApi.cs:1964-2003),
so there is no per-node Update Now to offer: one button, named for what it does,
with upstream's confirmation and alert. On a cluster it is the strip's Update Now,
moved here; the Lists tab owns the call (`BlockLists.tsx`, `updateNow`).

Its words, all OURS: the title `Block Lists Across Nodes`, its sentence, the column
`Node`, `Last updated` (the strip's caption, as a column), `Next update`, `Update
Now on All Nodes`, `Did not answer: <message>` and `Not read`. `Block List Domains` is the
strip's figure; the next-update value is upstream's (`nextUpdateText`).
*/

export function ListsOnNodes({
  token,
  nodes,
  withCounts,
  modifyNeed,
  canUpdate,
  updating,
  refreshOn,
  onUpdate,
}: {
  token: string | null
  nodes: ClusterNode[]
  /** `Dashboard: View`: without it the counts are not asked for. */
  withCounts: boolean
  /** `Settings: Modify` when missing, for Update Now's padlock. */
  modifyNeed: string | undefined
  /** Update Now's own condition: saved lists, nothing in flight. */
  canUpdate: boolean
  /** Update Now was just triggered: all nodes are fetching until the wait ends. */
  updating: boolean
  /** Read again whenever this changes. */
  refreshOn: unknown
  onUpdate: () => void
}) {
  const key = nodes.map((n) => n.name).join('\n')
  const [reads, setReads] = useState<NodeLists[] | null>(null)

  useEffect(() => {
    let live = true
    const list = key === '' ? [] : key.split('\n').map((name) => ({ name, type: '' }))
    void readListsOnNodes(token, list, withCounts).then((r) => {
      if (live) setReads(r)
    })
    return () => {
      live = false
    }
  }, [token, key, withCounts, refreshOn])

  const columns = withCounts ? 4 : 3

  return (
    <Panel
      title="Block Lists Across Nodes"
      className={styles.panel}
      actions={
        <PermissionButton lead="refresh" size="sm" permission={modifyNeed} disabled={!canUpdate} onClick={onUpdate}>
          Update Now on All Nodes
        </PermissionButton>
      }
    >
      <p className={styles.note}>
        Every node fetches and holds its own copy of the lists, on its own timer. The server passes Update Now on
        to all nodes.
      </p>
      {reads == null ? (
        <Loading compact />
      ) : (
        <Table
          stack
          className={styles.table}
          columns={columns}
          header={
            <>
              <th>Node</th>
              {withCounts && <th>Block List Domains</th>}
              <th>Last updated</th>
              <th>Next update</th>
            </>
          }
        >
          {reads.map((r) => {
            const at = nodes.findIndex((n) => n.name === r.node)
            const failure = nodeFailure(r)
            const name = (
              <td className={tbl.lead}>
                <span className={styles.node} style={{ '--nd': `var(${nodeToken(at)})` } as CSSProperties}>
                  {r.node}
                </span>
              </td>
            )
            if (failure != null) {
              return (
                <tr key={r.node}>
                  {name}
                  <td colSpan={columns - 1} className={styles.failed}>Did not answer: {failure}</td>
                </tr>
              )
            }
            const s = r.schedule.kind === 'ok' ? r.schedule.value : null
            const last = s == null ? null : lastUpdateOf(s.next, s.interval)
            const notRead = (message: string) => (
              <span className={styles.notRead} title={message}>Not read</span>
            )
            return (
              <tr key={r.node}>
                {name}
                {withCounts && r.domains != null && (
                  <td>
                    {r.domains.kind === 'ok' ? (
                      <span className={styles.count}>{r.domains.value.toLocaleString()}</span>
                    ) : (
                      notRead(r.domains.message)
                    )}
                  </td>
                )}
                <td>
                  {r.schedule.kind === 'failed'
                    ? notRead(r.schedule.message)
                    : last == null
                      ? '—'
                      : (
                          <>
                            {minuteStamp(last)}
                            <span className={styles.ago}>{fromNow(last)}</span>
                          </>
                        )}
                </td>
                <td>
                  {r.schedule.kind === 'failed'
                    ? notRead(r.schedule.message)
                    : updating
                      ? nextUpdateText(new Date(0).toISOString())
                      : nextUpdateText(s?.next)}
                </td>
              </tr>
            )
          })}
        </Table>
      )}
    </Panel>
  )
}
