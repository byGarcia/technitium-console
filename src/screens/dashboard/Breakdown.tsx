import { useId, type ReactNode } from 'react'
import type { ChartData } from '../../api/dashboard'
import { tokenForLabel } from './palette'
import { num2, percentage } from './metrics'
import { Legend, Placeholder, hasData, useHidden } from './Panels'
import { Panel } from '../../ui/Panel'
import styles from './Dashboard.module.css'

/*
The three breakdowns in one card, as the cockpit draws them: Query Response Types,
Query Types and Protocol Types, each a stacked bar with its legend under it. The
data, the labels and the percentages are the ones the doughnuts carried, written
with the same `percentage()` as the cards; a stacked bar says the same shares in a
third of the room, which is what lets the four lists sit in one row.

What each part answers to, and why it is not the same in the three:

  · Query Response Types keeps upstream's legend: pressing an entry switches its
    slice off (chartLegendOnClick, main.js:2560) and the bar closes over it, as the
    ring did. The entries come back with a new response (`useHidden`).
  · Query Types and Protocol Types had no slice to hide since they were drawn as
    bars (deviation 7), so their entries are the jump to Query Logs for that value
    (the bars' "Show Query Logs"), where Query Logs has a field for it.
  · A segment of any of the three takes a click to Query Logs for its value, as a
    slice of the ring did. Like the ring, it is a pointer target only: the keyboard
    reaches the same jumps through the legends.

Each part orders its values as the ring and the bars did: Query Response Types in
the server's order, the other two longest first.
*/

type Jump = (label: string) => (() => void) | undefined

interface Entry {
  label: string
  value: number
  colour: string
}

function entriesOf(data: ChartData, sorted: boolean): Entry[] {
  const values = (data.datasets[0]?.data ?? []).map((v) => Number(v) || 0)
  const rows = (data.labels ?? []).map((label, i) => ({ label: String(label), value: values[i] ?? 0 }))
  if (sorted) rows.sort((a, b) => b.value - a.value)
  return rows.map((r, i) => ({ ...r, colour: `var(${tokenForLabel(r.label, i)})` }))
}

/* The bar: one segment per value above zero, as wide as its share of what is shown. */
function Stack({ entries, total, hidden, jump }: {
  entries: Entry[]
  total: number
  hidden?: ReadonlySet<string>
  jump?: Jump
}) {
  return (
    <div className={styles.stack}>
      {entries
        .filter((e) => e.value > 0 && !hidden?.has(e.label))
        .map((e) => {
          const go = jump?.(e.label)
          const title = `${e.label}: ${num2(e.value)} (${percentage(e.value, total)})`
          const style = { flexGrow: e.value, background: e.colour }
          return go != null ? (
            <button
              key={e.label}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={styles.segment}
              data-segment={e.label}
              title={title}
              style={style}
              onClick={go}
            />
          ) : (
            <i key={e.label} className={styles.segment} data-segment={e.label} title={title} style={style} aria-hidden="true" />
          )
        })}
    </div>
  )
}

function Part({ title, data, failure, children }: {
  title: string
  data?: ChartData
  failure: boolean
  children: (data: ChartData) => ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.part} aria-labelledby={id}>
      <h2 className={styles.partTitle} id={id}>{title}</h2>
      {hasData(data) ? children(data) : <Placeholder failure={failure} empty="No data for this period." />}
    </section>
  )
}

/* Query Response Types: upstream's legend, which switches a slice off. */
function Responses({ data, resetOn, failure, jump }: {
  data?: ChartData
  resetOn?: unknown
  failure: boolean
  jump?: Jump
}) {
  const { hidden, toggle } = useHidden(resetOn ?? data)
  return (
    <Part title="Query Response Types" data={data} failure={failure}>
      {(d) => {
        const entries = entriesOf(d, false)
        const total = entries.reduce((a, e) => a + e.value, 0)
        return (
          <>
            <Stack entries={entries} total={total} hidden={hidden} jump={jump} />
            <div className={styles.stackLegend}>
              <Legend
                entries={entries.map((e) => ({ label: e.label, datum: percentage(e.value, total) }))}
                hidden={hidden}
                onToggle={toggle}
              />
            </div>
          </>
        )
      }}
    </Part>
  )
}

/* Query Types and Protocol Types: each entry is the jump for its value. */
function Types({ title, data, failure, jump }: {
  title: string
  data?: ChartData
  failure: boolean
  jump?: Jump
}) {
  return (
    <Part title={title} data={data} failure={failure}>
      {(d) => {
        const entries = entriesOf(d, true)
        const total = entries.reduce((a, e) => a + e.value, 0)
        return (
          <>
            <Stack entries={entries} total={total} jump={jump} />
            <div className={`${styles.stackLegend} ${styles.legend}`}>
              {entries.map((e) => {
                const go = jump?.(e.label)
                const inner = (
                  <>
                    <i style={{ background: e.colour }} />
                    {e.label} <b>{percentage(e.value, total)}</b>
                  </>
                )
                return go != null ? (
                  <button key={e.label} type="button" className={styles.lg} title="Show Query Logs" onClick={go}>
                    {inner}
                  </button>
                ) : (
                  <span key={e.label} className={`${styles.lg} ${styles.lgStill}`}>{inner}</span>
                )
              })}
            </div>
          </>
        )
      }}
    </Part>
  )
}

export function Breakdown({
  responses,
  responsesResetOn,
  queryTypes,
  protocols,
  failure,
  responseJump,
  typeJump,
  protocolJump,
}: {
  responses?: ChartData
  /** What switches every slice back on: the server's response (see `useHidden`). */
  responsesResetOn?: unknown
  queryTypes?: ChartData
  protocols?: ChartData
  failure: boolean
  responseJump?: Jump
  typeJump?: Jump
  protocolJump?: Jump
}) {
  return (
    <Panel className={styles.breakdown}>
      <div className={styles.parts}>
        <Responses data={responses} resetOn={responsesResetOn} failure={failure} jump={responseJump} />
        <Types title="Query Types" data={queryTypes} failure={failure} jump={typeJump} />
        <Types title="Protocol Types" data={protocols} failure={failure} jump={protocolJump} />
      </div>
    </Panel>
  )
}
