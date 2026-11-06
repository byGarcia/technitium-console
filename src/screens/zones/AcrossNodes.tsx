import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { readNodeZones, typeLabel } from '../../api/zones'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import { Button } from '../../ui/Button'
import { Loading } from '../../ui/Empty'
import { DomainName } from '../../ui/DomainName'
import { Tag, type TagTone } from '../../ui/Tag'
import { Table } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { DataTable, DataFoot, End } from '../../ui/DataTable'
import { Pagination } from '../../ui/Pagination'
import { pageWindow, statusText } from '../../lib/pagination'
import { zoneColour } from './zone-colours'
import {
  ACROSS_FILTERS,
  ACROSS_FILTER_LABEL,
  countAcross,
  healthText,
  matchesAcross,
  mergeAcrossNodes,
  type AcrossFilter,
  type AcrossRow,
  type NodeAnswer,
} from './across-nodes'
import zones from './Zones.module.css'
import styles from './AcrossNodes.module.css'

/*
The zone list across cluster nodes (deviation 33; the rules are in
`across-nodes.ts`). `zones/list` with no page, once per node, side by side: a
column per node with that node's zone type and serial, and the line's health.
Read only: the zone's name opens it as the list does, on the node the screen
reads; nothing else here acts.

Read on every load of the list behind it (`reload`: the list's Go, a refresh, a
new node), with the Name filter the list applied, and only the newest read lands.

Its words, OURS: the four filters, the four health words, `not on this node`,
`No answer`, `<node> did not answer: <message>`, `Health` and `N zones across M nodes`.
*/

const HEALTH_TONE: Record<AcrossRow['health'], TagTone> = {
  healthy: 'ok',
  some: 'warn',
  serial: 'warn',
  disabled: 'warn',
}

export function AcrossNodes({
  token,
  nodes,
  filterName,
  reload,
  filter,
  onFilter,
  page,
  onPage,
  perPage,
  onOpen,
  toolbar,
  band,
}: {
  token: string | null
  nodes: ClusterNode[]
  /** The Name filter the list applied, sent as upstream's `filterName`. */
  filterName: string
  reload: number
  filter: AcrossFilter
  onFilter: (f: AcrossFilter) => void
  page: number
  onPage: (page: number) => void
  perPage: number
  onOpen: (zone: string) => void
  /** The list's own toolbar controls, drawn first. */
  toolbar: ReactNode
  /** A full-width band under them (the quick add). */
  band?: ReactNode
}) {
  const [answers, setAnswers] = useState<NodeAnswer[] | null>(null)
  const seq = useRef(0)
  const nodeKey = nodes.map((n) => n.name).join('\n')

  useEffect(() => {
    const mine = ++seq.current
    const names = nodeKey === '' ? [] : nodeKey.split('\n')
    void Promise.all(
      names.map(async (node): Promise<NodeAnswer> => {
        const r = await readNodeZones(token, node, filterName)
        if (r.kind === 'ok') return { node, outcome: { ok: true, zones: r.data } }
        return {
          node,
          outcome: {
            ok: false,
            message: r.kind === 'error' ? (r.message ?? 'Unknown error.') : 'Invalid token or session expired.',
          },
        }
      }),
    ).then((all) => {
      if (mine === seq.current) setAnswers(all)
    })
  }, [token, nodeKey, filterName, reload])

  const rows = useMemo(() => (answers == null ? [] : mergeAcrossNodes(answers)), [answers])
  const counts = useMemo(() => countAcross(rows), [rows])
  const shown = rows.filter((r) => matchesAcross(r, filter))
  const totalPages = Math.max(1, Math.ceil(shown.length / perPage))
  const current = Math.min(Math.max(1, page), totalPages)
  const firstRow = (current - 1) * perPage + 1
  const onPageRows = shown.slice(firstRow - 1, firstRow - 1 + perPage)
  const state = statusText(firstRow, onPageRows.length, shown.length, current, totalPages, 'zones')
  const answered = answers?.filter((a) => a.outcome.ok).length ?? 0
  const failed = answers?.filter((a) => !a.outcome.ok) ?? []

  return (
    <DataTable
      toolbar={
        <>
          {toolbar}
          <End>
            {answers != null && (
              <span>{`${rows.length} ${rows.length === 1 ? 'zone' : 'zones'} across ${answered} ${answered === 1 ? 'node' : 'nodes'}`}</span>
            )}
          </End>
          <div className={styles.chips} role="group" aria-label="Filter">
            {ACROSS_FILTERS.map((f) => (
              <Button key={f} size="sm" aria-pressed={filter === f} onClick={() => onFilter(f)}>
                {ACROSS_FILTER_LABEL[f]}
                {answers != null && <> <span className={styles.chipCount}>{counts[f]}</span></>}
              </Button>
            ))}
          </div>
          {band}
        </>
      }
      foot={
        answers != null ? (
          <DataFoot count={state}>
            {totalPages > 1 && (
              <Pagination window={pageWindow(current, totalPages)} current={current} last={totalPages} onGoTo={onPage} />
            )}
          </DataFoot>
        ) : undefined
      }
    >
      {failed.length > 0 && (
        <ul className={styles.failed}>
          {failed.map((a) => (
            <li key={a.node}>
              <b>{a.node}</b>
              {` did not answer: ${a.outcome.ok ? '' : a.outcome.message}`}
            </li>
          ))}
        </ul>
      )}
      {answers == null ? (
        <Loading />
      ) : (
        <Table
          stack
          header={
            <>
              <th>Zone</th>
              {answers.map((a) => (
                <th key={a.node} className={styles.nodeHead}>
                  {/* Written as the node selector writes a node, `name (type)`: a
                      stacked row takes the header's text as each cell's label. */}
                  <span className={styles.nodeName}>{a.node}</span>{' '}
                  <span className={styles.nodeType}>
                    {a.outcome.ok
                      ? `(${(nodes.find((n) => n.name === a.node)?.type ?? '').toLowerCase()})`
                      : '(No answer)'}
                  </span>
                </th>
              ))}
              <th style={{ width: 150 }}>Health</th>
            </>
          }
        >
          {onPageRows.length === 0 ? (
            <tr>
              <td colSpan={answers.length + 2} className={tbl.noRows}>
                No Zone Found
              </td>
            </tr>
          ) : (
            onPageRows.map((r) => (
              <tr key={r.name}>
                <td className={`${tbl.stacked} ${tbl.lead} ${zones.zoneCell}`}>
                  <button type="button" className={`${zones.zoneLink} ${tbl.entity}`} onClick={() => onOpen(r.name)}>
                    <DomainName name={r.label} />
                  </button>
                </td>
                {answers.map((a) => {
                  const z = r.perNode[a.node]
                  return (
                    <td key={a.node}>
                      {z === undefined ? (
                        <span className={zones.quiet}>No answer</span>
                      ) : z === null ? (
                        <span className={zones.quiet}>not on this node</span>
                      ) : (
                        <span className={styles.held}>
                          <span className={zones.ztype}>
                            <span className={zones.zdot} style={{ background: zoneColour(z.type) }} />
                            {typeLabel(z.type)}
                          </span>
                          <span className={styles.facts}>
                            {z.soaSerial != null && <span className={zones.mono}>{z.soaSerial}</span>}
                            {z.disabled && <Tag>Disabled</Tag>}
                          </span>
                        </span>
                      )}
                    </td>
                  )
                })}
                <td>
                  <Tag tone={HEALTH_TONE[r.health]}>{healthText(r)}</Tag>
                </td>
              </tr>
            ))
          )}
        </Table>
      )}
    </DataTable>
  )
}
