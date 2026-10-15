import type { ChartData } from '../../api/dashboard'
import { num2, percentage } from './metrics'
import styles from './Dashboard.module.css'

/*
Query Types and Protocol Types as bars, longest first, each with its count and its
share of the chart's total.

They were doughnuts like Query Response Types, and a doughnut is the wrong shape for
both: Query Types brings up to ten types plus `Others` (the server trims it,
WebServiceDashboardApi.cs:408), and nobody compares a 0.3 % angle with a 0.1 % one;
Protocol Types is usually one protocol at 100 %, a whole ring for one fact. The
data, the labels and the percentages are the same ones the doughnut's legend
carried, written with the same `percentage()` as the cards.

The doughnut's legend switched a slice off on click (upstream's chartLegendOnClick,
main.js:2560). A list of bars has no slice to hide and keeps every figure in view,
so that toggle is not offered here; what a bar offers instead is the jump to Query
Logs filtered by its value, where Query Logs has that filter (deviation 6 in
CONVENTIONS.md). `Others` is not a value and has no jump.
*/
export function TypeBars({
  data,
  aria,
  colour,
  jump,
}: {
  data: ChartData
  /** The panel title, which names the list. */
  aria: string
  /** The bars' colour token: these encode size, not identity, so one per list. */
  colour: string
  /** The jump for a label, or nothing when that label has none. */
  jump?: (label: string) => (() => void) | undefined
}) {
  const values = (data.datasets[0]?.data ?? []).map((v) => Number(v) || 0)
  const total = values.reduce((a, n) => a + n, 0)
  const rows = (data.labels ?? [])
    .map((label, i) => ({ label: String(label), value: values[i] ?? 0 }))
    .sort((a, b) => b.value - a.value)
  const largest = Math.max(0, ...rows.map((r) => r.value))

  return (
    <ul className={styles.bars} aria-label={aria} style={{ ['--bar' as string]: `var(${colour})` }}>
      {rows.map((r) => {
        const go = jump?.(r.label)
        const inner = (
          <>
            <span className={styles.barLabel}>{r.label}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <i style={{ width: `${largest > 0 ? (r.value / largest) * 100 : 0}%` }} />
            </span>
            <span className={styles.barCount}>{num2(r.value)}</span>
            <span className={styles.barShare}>{percentage(r.value, total)}</span>
          </>
        )
        return (
          <li key={r.label}>
            {go != null ? (
              <button type="button" className={styles.barRow} title="Show Query Logs" onClick={go}>
                {inner}
              </button>
            ) : (
              <div className={styles.barRow}>{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
