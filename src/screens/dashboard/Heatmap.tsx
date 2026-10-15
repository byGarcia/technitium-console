import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { getHours } from '../../api/dashboard'
import { Body, Panel } from '../../ui/Panel'
import { Failure, Loading } from '../../ui/Empty'
import { heatRows, hourRequests, level, stitchHours, weekSpan, type HeatCell } from './heatmap'
import { spanFilters } from './jump'
import type { QueryLogsFilters } from '../../app/handoff'
import { num2 } from './metrics'
import styles from './Heatmap.module.css'

/*
The week by hour (deviation 7 in CONVENTIONS.md; the arithmetic and why it takes
more than one request are in `heatmap.ts`). The words are OURS: the title, the
weekday names, each cell's "HH:00 to HH:00: N queries", the hint "Click a cell for
that hour's Query Logs" and the scale's "Quiet" and "Busy".

It reads on its own clock, not the period's: the same week whatever period the
figures above show, from the node they read. It is asked once per node and per
hour: a minute reload of Last Hour hands it the same hour and asks nothing, and the
first reload after the hour turns asks again.

Each cell opens Query Logs for its hour, through the row menus' jump, when Query
Logs is there to land on. The grid is one stop for the keyboard: the arrows move
inside it, Home and End go to the ends of a row.
*/

const HOUR = 3_600_000
const pad = (n: number) => String(n).padStart(2, '0')
const clock = (at: number) => `${pad(new Date(at).getHours())}:${pad(new Date(at).getMinutes())}`

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ok'; hours: Map<number, number>; now: number }

export function Heatmap({
  token,
  node,
  hour,
  jump,
}: {
  token: string | null
  node: string
  /** The start of the hour in progress, by the browser's clock: a new one asks again. */
  hour: number
  /** Opens Query Logs with these filters, or nothing when it cannot. */
  jump?: (filters: QueryLogsFilters) => void
}) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const now = hour + HOUR - 1
    const span = weekSpan(now)
    const asks = hourRequests(span.from, span.to)
    setState({ kind: 'loading' })
    if (asks == null) {
      setState({ kind: 'failed' })
      return
    }
    void Promise.all(asks.map((a) => getHours(token, a.start, a.end, node))).then((answers) => {
      if (cancelled) return
      const charts = answers.flatMap((a) => (a.kind === 'ok' ? [a.data] : []))
      const hours = charts.length === answers.length ? stitchHours(charts, span.from, span.to) : null
      setState(hours == null ? { kind: 'failed' } : { kind: 'ok', hours, now })
    })
    return () => {
      cancelled = true
    }
  }, [token, node, hour])

  const rows = useMemo(() => (state.kind === 'ok' ? heatRows(state.hours, state.now) : []), [state])
  const max = Math.max(0, ...rows.flatMap((r) => r.cells.map((c) => c?.count ?? 0)))

  /* The roving focus: which cell holds the grid's one tab stop. */
  const [at, setAt] = useState<[number, number]>([-1, -1])
  const grid = useRef<HTMLDivElement>(null)
  const move = (e: KeyboardEvent, r: number, c: number) => {
    const next: Record<string, [number, number]> = {
      ArrowLeft: [r, Math.max(0, c - 1)],
      ArrowRight: [r, Math.min(23, c + 1)],
      ArrowUp: [Math.max(0, r - 1), c],
      ArrowDown: [Math.min(rows.length - 1, r + 1), c],
      Home: [r, 0],
      End: [r, 23],
    }
    const to = next[e.key]
    if (to == null) return
    e.preventDefault()
    setAt(to)
    grid.current?.querySelector<HTMLElement>(`[data-cell="${to[0]}-${to[1]}"]`)?.focus()
  }

  /* The tab stop is the chosen cell, or the latest hour when that one has none. */
  const valid = (r: number, c: number) => rows[r]?.cells[c] != null
  const last = (() => {
    for (let r = rows.length - 1; r >= 0; r--) for (let c = 23; c >= 0; c--) if (valid(r, c)) return [r, c] as const
    return [0, 0] as const
  })()
  const stop = valid(at[0], at[1]) ? at : last

  const name = (day: string, cell: HeatCell) =>
    `${day}, ${clock(cell.from)} to ${clock(cell.to)}: ${num2(cell.count)} ${cell.count === 1 ? 'query' : 'queries'}`

  return (
    <Panel title="Queries per Hour, Last 7 Days">
      <Body>
        {state.kind === 'loading' && <Loading compact />}
        {state.kind === 'failed' && <Failure>Could not load this data.</Failure>}
        {/* A quiet week is drawn, not replaced by the empty box: zero is a true
            figure, and every cell still says so. */}
        {state.kind === 'ok' && (
          <div className={styles.wrap}>
            <div className={styles.grid} ref={grid} role="grid" aria-label="Queries per Hour, Last 7 Days">
              <div className={styles.hours} aria-hidden="true">
                <span />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h}>{h % 6 === 0 ? pad(h) : ''}</span>
                ))}
              </div>
              {rows.map((row, r) => (
                <div className={styles.row} role="row" key={row.day}>
                  <span className={styles.day} role="rowheader" aria-label={row.label}>{row.short}</span>
                  {row.cells.map((cell, c) => {
                    if (cell == null) return <span key={c} className={styles.none} role="gridcell" aria-label={`${row.label}, ${pad(c)}:00: no data`} />
                    const shade = styles[`h${level(cell.count, max)}`]
                    const label = name(row.label, cell)
                    const focus = stop[0] === r && stop[1] === c ? 0 : -1
                    return jump != null ? (
                      <span key={c} role="gridcell">
                        <button
                          type="button"
                          data-cell={`${r}-${c}`}
                          className={`${styles.cell} ${shade}`}
                          aria-label={label}
                          title={label}
                          tabIndex={focus}
                          onFocus={() => setAt([r, c])}
                          onKeyDown={(e) => move(e, r, c)}
                          onClick={() => jump(spanFilters(cell.from, cell.to))}
                        />
                      </span>
                    ) : (
                      <span key={c} role="gridcell" className={`${styles.cell} ${shade}`} aria-label={label} title={label} />
                    )
                  })}
                </div>
              ))}
            </div>
            {/* Under the grid, what a click does (only when it can) and the scale,
                from no queries to the busiest hour; each cell says its count. */}
            <div className={styles.foot}>
              {jump != null ? <span>Click a cell for that hour&apos;s Query Logs</span> : <span />}
              <span className={styles.scale} aria-hidden="true">
                Quiet
                {[1, 2, 3, 4, 5].map((l) => <i key={l} className={`${styles.cell} ${styles[`h${l}`]}`} />)}
                Busy
              </span>
            </div>
          </div>
        )}
      </Body>
    </Panel>
  )
}
