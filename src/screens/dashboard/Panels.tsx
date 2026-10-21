import { useEffect, useState, type ReactNode } from 'react'
import type { ChartData, TopEntry } from '../../api/dashboard'
import { Chart } from './Chart'
import { tokenForLabel } from './palette'
import { num2 } from './metrics'
import { Body, Panel } from '../../ui/Panel'
import { Button } from '../../ui/Button'
import { Empty, Failure } from '../../ui/Empty'
import styles from './Dashboard.module.css'

/*
The Dashboard's panels, each one a piece that does not know where it sits: a top
list (`Top`), the Queries line with its legend (`Line`) and the gap a region draws
when it has nothing (`Placeholder`). The three breakdowns are in `Breakdown.tsx`.
`Dashboard.tsx` only arranges them.
*/

/*
A chart with no value other than zero is not drawn: an empty canvas takes up the
same room and says nothing. It says there is no data instead.

It returns a TYPE GUARD rather than a plain `boolean`: asking it whether there is
data is precisely what proves the chart exists, so the compiler ought to hear
about it. Without that, `Split` had to accept `ChartData | undefined` and passed
it straight back to `Chart`, which does demand it, and the `undefined` went on
slipping in through the side door.
*/
export function hasData(d?: ChartData): d is ChartData {
  if (!d?.datasets?.length) return false
  return d.datasets.some((s) => (s.data ?? []).some((n) => Number(n) > 0))
}

export function Top({
  title,
  rows,
  isClient = false,
  onMore,
  failure,
  beforeMore,
  menu,
  tone,
}: {
  title: string
  rows: TopEntry[]
  /** The bars' colour: the series the list belongs to, as Blocking › Overview's
   *  top tables paint theirs (`TopTable.tsx`). */
  tone: string
  /** Each row's menu (`TopRowMenu`), at the end of the row as upstream draws it. */
  menu: (row: TopEntry) => ReactNode
  /** A client also shows the domain it resolved and whether it was rate limited. */
  isClient?: boolean
  onMore: () => void
  /** When the request failed: the gap is not drawn the way an empty one is. */
  failure: boolean
  /** The panel's own action, to the left of "More". Only the blocked-domains one
   *  uses it, with the blocking menu upstream puts there. */
  beforeMore?: ReactNode
}) {
  /* Upstream renders these entries in the server's order (main.js:2798-2857).
     Position and a relative bar only make that same order easier to scan. The bar
     sits on a track and wears its list's series colour: a grey rule two pixels high
     read as an underline, not as a size. */
  const visibleRows = rows.slice(0, 5)
  const largest = Math.max(0, ...visibleRows.map((row) => Number.isFinite(row.hits) ? row.hits : 0))

  return (
    <Panel
      title={title}
      className={styles.top}
      actions={
        <div className={styles.panelActions}>
          {beforeMore}
          {/* It was a bare `<button>`, with no class: the browser drew it with
              its default style, in the middle of a console with a system of its
              own. */}
          <Button size="sm" onClick={onMore}>
            More
          </Button>
        </div>
      }
    >
      <Body className={styles.pbAdjusted}>
        <div style={{ ['--bar' as string]: `var(${tone})` }}>
        {rows.length === 0 && <Placeholder failure={failure} empty="No data for this period." />}
        {visibleRows.map((f, i) => {
          /* One line: the name, a client's domain after it in a quieter tone, and
             the count. A long one ends in an ellipsis and is whole on hover; the
             row menu's actions carry the whole name too. */
          const domain = isClient && f.domain != null && f.domain !== '' ? f.domain : null
          const label = `${f.name}${f.rateLimited ? ' (rate limited)' : ''}`
          return (
            <div
              className={`${styles.toprow}${f.rateLimited ? ` ${styles.limited}` : ''}`}
              key={`${f.name}|${i}`}
            >
              <span className={styles.topRank}>{i + 1}</span>
              <span className={styles.n} title={domain != null ? `${label} ${domain}` : label}>
                <span className={styles.topLabel}>{label}</span>
                {domain != null && <span className={styles.topDomain}>{domain}</span>}
              </span>
              <span className={styles.c}>{num2(f.hits)}</span>
              {menu(f)}
              <span className={styles.topBar} aria-hidden="true">
                <i style={{ width: `${largest > 0 && Number.isFinite(f.hits) ? Math.max(0, f.hits) / largest * 100 : 0}%` }} />
              </span>
            </div>
          )
        })}
        </div>
      </Body>
    </Panel>
  )
}

/*
The legend, in HTML and not inside the canvas, and the same one for all four
charts.

Chart.js drew it inside the `<canvas>`, and that costs two things you only see by
measuring: **no tool can read it** (neither a DOM-reading test tool nor a screen
reader), and the figure that makes it useful does not fit in it: the count on the
line chart, the percentage on the doughnuts.

What does NOT change is the interaction: **clicking an entry hides it**, which is
what the stock `onClick` did and what has to be kept. Here it is a
`<button>` with `aria-pressed`, so it is also reachable by keyboard and announced;
inside the canvas it was neither.

Beside a doughnut (`table`) it is a small table: the count and the percentage in
two columns of their own, digits under digits, where it only gave the percentage.
*/
export function Legend({
  entries,
  hidden,
  onToggle,
  table = false,
}: {
  entries: { label: string; datum: string; count?: string }[]
  hidden: ReadonlySet<string>
  onToggle: (label: string) => void
  table?: boolean
}) {
  return (
    <div className={`${styles.legend}${table ? ` ${styles.legendTable}` : ''}`}>
      {entries.map((e, i) => {
        const off = hidden.has(e.label)
        return (
          <button
            type="button"
            key={e.label || i}
            className={`${styles.lg}${off ? ` ${styles.lgOff}` : ''}`}
            aria-pressed={!off}
            onClick={() => onToggle(e.label)}
          >
            <i style={{ background: `var(${tokenForLabel(e.label, i)})` }} />
            {table ? (
              <>
                {/* The spaces keep the name readable as words ("A 60 60.00%");
                    a grid draws no item for them. */}
                <span className={styles.lgName}>{e.label}</span>{' '}
                <b>{e.count}</b>{' '}
                <b>{e.datum}</b>
              </>
            ) : (
              <>
                {e.label} <b>{e.datum}</b>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/*
The line chart: one entry per SERIES, and its figure is the count for the period.
*/
export function Line({
  data,
  resetOn = data,
  onPick,
  height,
}: {
  data: ChartData
  resetOn?: unknown
  /** The canvas height; `Chart`'s own when not given. */
  height?: number
  /** A point's jump to Query Logs, by its index (deviation 7). */
  onPick?: (index: number) => void
}) {
  const { hidden, toggle } = useHidden(resetOn)
  const entries = data.datasets.map((d) => ({
    label: String(d.label ?? ''),
    datum: num2((d.data ?? []).reduce((a, n) => a + Number(n || 0), 0)),
  }))
  return (
    <>
      <Legend entries={entries} hidden={hidden} onToggle={toggle} />
      <Chart type="line" data={data} height={height} aria="Queries over time" separateLegend hidden={hidden} onPick={onPick} />
    </>
  )
}

/*
A region's gap: empty or failure, and **never the same drawing**.

It is the design rule that matters most on this screen: *dashed = empty, solid =
error, and they are never swapped*. Here it is not decoration: a failure drawn as
"no queries for this period" tells whoever administers a DNS that their server is
receiving no traffic, which is the most expensive lie in the console and the
easiest to believe, because it looks exactly like a normal answer.

The failure sentence is ONE and the same in all three regions on purpose: the
detail (what failed and when the last good data was) travels in the notice at the
top, which appears once. Repeating it per panel would say the same thing three
times and compete with it.
*/
export function Placeholder({ failure, empty }: { failure: boolean; empty: string }) {
  if (failure) return <Failure>Could not load this data.</Failure>
  return <Empty compact>{empty}</Empty>
}

/*
Which legend entries are switched off, and **they reset when new data arrives**.

The second half is not a convenience: without it, changing period or node rebuilds
the chart and the series come back on, but the button would stay at
`aria-pressed="false"`, the control saying one thing and the thing controlled
saying another. It would also change today's behaviour: Chart.js's stock legend
loses its state on every rebuild, so keeping it would be inventing a memory the
console does not have.

It resets on the identity of the server's response, which is what changes with
every reload, as upstream's rebuilt chart does. NOT on the live figures laid over
it every 2 seconds (`live.ts`): those would bring a switched-off series back before
the eye found it gone.
*/
export function useHidden(resetOn: unknown) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => setHidden(new Set()), [resetOn])
  const toggle = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(label)) next.add(label)
      return next
    })
  return { hidden, toggle }
}

