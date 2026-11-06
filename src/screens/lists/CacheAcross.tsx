import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { ListNode } from '../../api/zonelists'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import { Card, Count, statStyles } from '../../ui/StatCard'
import { DataFoot, DataTable, End } from '../../ui/DataTable'
import { Table } from '../../ui/Table'
import { Button } from '../../ui/Button'
import { Empty, Failure, Loading } from '../../ui/Empty'
import { Tag } from '../../ui/Tag'
import tbl from '../../ui/Table.module.css'
import { nodeToken } from '../dashboard/palette'
import { RecordData, RecordTtl, RecordType } from './Records'
import {
  answered, filterRows, mergeAcross, readAcross, spreadOf, zonesAcross,
  type NodeCache, type Spread,
} from './cache-across'
import styles from './Lists.module.css'

/*
CACHE ACROSS THE CLUSTER (deviation 35 in CONVENTIONS.md, 2026-11-06). The `All
nodes` view of Cache, on an initialised cluster only: the domain on screen read
from every node (`cache-across.ts`), once each, with that node's `node`, and laid
out side by side.

  · A card per node with how many records it holds at the domain (the count Cache
    already writes in its foot, from the same answer), and once, beside them, that
    each node keeps its own cache.
  · One table of the records, merged by name, type and value, with one TTL column
    per node: the time left on that node when it was read, or `not cached here`.
  · Three filters with their counts: `All`, `On every node` and `On some nodes
    only`, measured over the nodes that answered.
  · A node whose read failed says so on its card and in its column's header, and
    its cells say `not read`: what it holds is unknown, not empty.

It sends nothing else: Flush Cache and Delete stay on the node chosen in the
selector, as they are, and the screen's own read of that node still draws the
header and the path. Every word here is OURS and part of deviation 35: `All
nodes`, the sentence below, `records at`, `Could not read this node.`, `Not read`,
`not read`, `not cached here`, `Could not read any node.`, the three filters, the
foot's `across N nodes`, `on every node` and `on some nodes only`, and the empty
table's `No record here is on every node.` and `... on some nodes only.`
*/

const OWN_CACHE =
  'Each node keeps its own cache: a name can be cached on one node and not on another, with a different time left on each.'

const SPREAD_LABEL: Record<Spread, string> = {
  all: 'All',
  every: 'On every node',
  some: 'On some nodes only',
}

export function CacheAcross({
  token,
  nodes,
  node,
  nodeTitle,
  toolbar,
  band,
}: {
  token: string | null
  nodes: ClusterNode[]
  /** The screen's answer for the chosen node: each new one (a move, Refresh, the
   *  read after Flush or Delete) reads every node again, for its domain. */
  node: ListNode
  nodeTitle: string
  /** The screen's Domain field and Browse, as the one-node card has them. */
  toolbar: ReactNode
  /** The zones under the domain as the screen draws them (`Children`). */
  band: (zones: string[]) => ReactNode
}) {
  const [reads, setReads] = useState<NodeCache[] | null>(null)
  const [spread, setSpread] = useState<Spread>('all')
  const key = nodes.map((n) => n.name).join('\n')
  const domain = node.domain

  useEffect(() => {
    let cancelled = false
    void readAcross(token, domain, nodes).then((r) => {
      if (!cancelled) setReads(r)
    })
    return () => {
      cancelled = true
    }
    // `nodes` is read through its names: the Shell hands a new array on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, node, key])

  const rows = useMemo(() => (reads == null ? [] : mergeAcross(reads)), [reads])
  const held = useMemo(() => (reads == null ? [] : answered(reads)), [reads])
  const every = rows.filter((r) => spreadOf(r, held) === 'every').length
  const counts: Record<Spread, number> = { all: rows.length, every, some: rows.length - every }
  const shown = filterRows(rows, spread, held)
  const zones = reads == null ? node.zones : zonesAcross(reads)
  const readOf = (name: string) => reads?.find((r) => r.node === name)

  return (
    <>
      {/* A cell per node, and the sentence that each keeps its own cache as the
          strip's last cell. */}
      <div className={statStyles.grid}>
        {nodes.map((n, i) => {
          const read = readOf(n.name)
          return (
            <Card key={n.name} title={n.name} colour={`var(${nodeToken(i)})`}>
              <div className={statStyles.body}>
                {read == null ? (
                  <Loading compact announce={i === 0} />
                ) : read.kind === 'failed' ? (
                  <div className={styles.nodeFailed} role="status">
                    <strong>Could not read this node.</strong> {read.message}
                  </div>
                ) : (
                  <>
                    <div className={statStyles.figure}><Count value={read.records.length} /></div>
                    <div className={statStyles.caption}>
                      records at <span className={styles.mono}>{nodeTitle}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )
        })}
        <p className={styles.acrossNote}>{OWN_CACHE}</p>
      </div>

      <DataTable
        toolbar={
          <>
            {toolbar}
            <End>
              <div className={styles.spread} role="group" aria-label="Records across nodes">
                {(['all', 'every', 'some'] as const).map((s) => (
                  <Button key={s} size="sm" aria-pressed={spread === s} disabled={reads == null} onClick={() => setSpread(s)}>
                    {SPREAD_LABEL[s]} {reads == null ? '' : counts[s]}
                  </Button>
                ))}
              </div>
            </End>
          </>
        }
        foot={
          <DataFoot
            count={
              reads == null ? null : spread === 'all' ? (
                <>
                  {rows.length} records at <span className={styles.mono}>{nodeTitle}</span> across{' '}
                  {nodes.length} nodes
                </>
              ) : (
                <>
                  {shown.length} of {rows.length} records at <span className={styles.mono}>{nodeTitle}</span>,{' '}
                  {spread === 'every' ? 'on every node' : 'on some nodes only'}
                </>
              )
            }
          />
        }
      >
        {zones.length > 0 && band(zones)}
        {reads == null ? (
          <div className={styles.empty}><Loading announce={false} /></div>
        ) : held.length === 0 ? (
          <div className={styles.empty}><Failure>Could not read any node.</Failure></div>
        ) : shown.length > 0 ? (
          <Table
            stack
            header={
              <>
                <th style={{ width: 110 }}>Type</th>
                <th>Data</th>
                {nodes.map((n, i) => {
                  const read = readOf(n.name)
                  return (
                    <th key={n.name} className={styles.nodeHead}>
                      <span className={styles.nodeName} style={{ '--nd': `var(${nodeToken(i)})` } as CSSProperties}>
                        {n.name}
                      </span>
                      {read?.kind === 'failed' && <> <Tag tone="dan">Not read</Tag></>}
                    </th>
                  )
                })}
              </>
            }
          >
            {shown.map((row) => {
              const name = row.record.nameIdn ?? row.record.name
              const differentName = row.record.name !== domain && name !== domain
              return (
                <tr key={row.key}>
                  <td className={tbl.lead}>
                    <RecordType type={row.record.type} />
                    {differentName && <span className={styles.name}>{name === '' ? '<ROOT>' : name}</span>}
                  </td>
                  <td>
                    <RecordData r={row.record} />
                  </td>
                  {nodes.map((n) => {
                    const read = readOf(n.name)
                    const copy = row.held.get(n.name)
                    return (
                      <td key={n.name} className={styles.ttl}>
                        {read?.kind === 'failed' ? (
                          <span className={styles.notHere}>not read</span>
                        ) : copy != null ? (
                          <RecordTtl r={copy} />
                        ) : (
                          <span className={styles.notHere}>not cached here</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </Table>
        ) : (
          <div className={styles.empty}>
            <Empty title="No records at this node">
              {spread !== 'all'
                ? `No record here is ${spread === 'every' ? 'on every node' : 'on some nodes only'}.`
                : zones.length > 0
                  ? 'This node only contains sub-domains. Open one to see its records.'
                  : 'This node has no records and no sub-domains.'}
            </Empty>
          </div>
        )}
      </DataTable>
    </>
  )
}
