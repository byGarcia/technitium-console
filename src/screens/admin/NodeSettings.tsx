import { useEffect, useMemo, useState } from 'react'
import { readSettings } from '../../api/settings'
import type { ClusterNode } from '../../api/admin-cluster'
import { Panel } from '../../ui/Panel'
import { Loading } from '../../ui/Empty'
import { Tag } from '../../ui/Tag'
import { Check } from '../../ui/Check'
import { Table } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Locked } from '../blocking/Locked'
import { noticeFromFailure } from '../../lib/notice'
import { compareSettings, summary, type NodeAnswer } from './node-settings'
import styles from './NodeSettings.module.css'

/*
SETTINGS ACROSS NODES (OURS, CONVENTIONS.md deviation 31, 2026-11-06). Under the
Cluster table while the cluster is initialised: `settings/get` once per node, with
the node's name in `node` as Settings sends it (the server proxies the read to
that node), and a table with one column per node and one row per setting of the
curated set in `node-settings.ts`. Read only: nothing here writes.

  · The rows whose values differ go first, marked `Differs`, and the line over the
    table says `All settings agree` or `N settings differ`; `Show only
    differences` hides the rest.
  · A node that does not answer keeps its column, marked `Unavailable`, empty, and
    a line under the summary names it with the server's message.
  · Without `Settings: View` nothing is read and the card says which permission is
    missing.
  · It reads again each time the Cluster sub-tab reads the cluster's state (its
    arrival and Refresh).

Its words, all OURS: the title `Settings Across Nodes`, `Setting`, `Differs`,
`All settings agree`, `N settings differ` (`1 setting differs`), `Only one node
answered`, `No node answered`, `Show only differences`, `Unavailable`, `<node> did
not answer:`, and the words of `node-settings.ts`.
*/

export function NodeSettings({
  token,
  nodes,
  canView,
  refreshOn,
}: {
  token: string | null
  nodes: ClusterNode[]
  /** `Settings.canView`: the server's permission for `settings/get`. */
  canView: boolean
  /** Read again whenever this changes: the cluster state Cluster just read. */
  refreshOn: unknown
}) {
  const names = nodes.map((n) => n.name)
  const key = names.join('\n')
  const [answers, setAnswers] = useState<NodeAnswer[] | null>(null)
  const [onlyDiffs, setOnlyDiffs] = useState(false)

  useEffect(() => {
    if (!canView) return
    let live = true
    setAnswers(null)
    const list = key === '' ? [] : key.split('\n')
    void Promise.all(
      list.map(async (node): Promise<NodeAnswer> => {
        const r = await readSettings(token, node)
        return r.kind === 'ok'
          ? { node, kind: 'ok', settings: r.data }
          : { node, kind: 'failed', message: noticeFromFailure(r).text }
      }),
    ).then((a) => {
      if (live) setAnswers(a)
    })
    return () => {
      live = false
    }
  }, [token, key, canView, refreshOn])

  const comparison = useMemo(() => (answers == null ? null : compareSettings(answers)), [answers])

  if (!canView) return <Locked title="Settings Across Nodes" need="Settings.canView" />

  const failed = (answers ?? []).filter((a) => a.kind === 'failed')
  const rows = comparison == null ? [] : onlyDiffs ? comparison.rows.filter((r) => r.differs) : comparison.rows
  const tone = comparison == null || comparison.answered < 2 ? 'neutral' : comparison.differing === 0 ? 'ok' : 'warn'

  return (
    <Panel
      title="Settings Across Nodes"
      className={styles.panel}
      actions={
        comparison != null && (
          <Check
            label="Show only differences"
            checked={onlyDiffs}
            disabled={comparison.differing === 0}
            onChange={setOnlyDiffs}
          />
        )
      }
    >
      {answers == null || comparison == null ? (
        <Loading compact />
      ) : (
        <>
          <div className={styles.status}>
            <p className={styles.summary} data-tone={tone}>
              {summary(comparison)}
            </p>
            {failed.map((f) => (
              <p key={f.node} className={styles.failed}>
                <span className={styles.node}>{f.node}</span> did not answer: {f.kind === 'failed' && f.message}
              </p>
            ))}
          </div>
          <Table
            stack
            className={styles.table}
            header={
              <>
                <th>Setting</th>
                {answers.map((a) => (
                  <th key={a.node} data-unavailable={a.kind === 'failed' ? '' : undefined}>
                    <span className={styles.head}>{a.node}</span>
                    {/* Only the node's name otherwise: a stacked row labels each
                        value with this header's text (`ui/Table`), and the type is
                        in the node table just above. */}
                    {a.kind === 'failed' && (
                      <>
                        {' '}
                        <Tag tone="warn">Unavailable</Tag>
                      </>
                    )}
                  </th>
                ))}
              </>
            }
            columns={answers.length + 1}
          >
            {rows.map((r) => (
              <tr key={r.key} data-differs={r.differs ? '' : undefined}>
                <td className={`${tbl.lead} ${styles.setting}`}>
                  <span className={styles.group}>{r.group}</span>
                  <span className={styles.label}>{r.label}</span>
                  {r.differs && <Tag tone="warn">Differs</Tag>}
                </td>
                {r.values.map((v, i) => (
                  /* A block, so a list stacked under its node's label hangs under
                     its first line (`ui/Table`). */
                  <td key={answers[i].node}>{v != null && <div className={styles.value}>{v}</div>}</td>
                ))}
              </tr>
            ))}
          </Table>
        </>
      )}
    </Panel>
  )
}
