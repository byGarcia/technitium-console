import type { ChartData, Stats } from '../../api/dashboard'
import { num2, percentage, type Metric } from './metrics'
import { formatChange, type Changes } from './compare'
import { tokenForLabel } from './palette'
import { Spark } from './Spark'
import styles from './Dashboard.module.css'

/*
The eleven figures, in upstream's labels, drawn in two weights.

The four read first sit in a row of their own, larger and with their trend: how
much was asked (`Total Queries`), how much the server refused to resolve
(`Blocked`), how much it answered from memory (`Cached`) and how many asked
(`Clients`). The other seven follow in a quieter band, in the two families the
server counts them by: the response code (`No Error`, `Server Failure`, `NX
Domain`, `Refused`) and how the answer was obtained (`Authoritative`, `Recursive`,
`Dropped`, which with `Cached` and `Blocked` are the five slices of Query Response
Types). Upstream's order and words for each figure do not change; only their weight
and their place do.

Every card reads in the same order: what it is, how much, and against what (its
share of the total, and its change against the previous period when there is one).
The colour of its edge is the colour of its series in the charts below.
*/

/*
A figure that shrinks to fit its card instead of spilling out of it (issue #2: a
Block List of 2,551,031 domains ran past the `Server` rail at 1440). The card is a
size container and the figure's font is the smaller of its normal size and the
width that this many monospace characters can have; `--len` carries the count.
Short figures keep their size, so only the one that would not fit gives way.
*/
export function Figure({ className, text }: { className: string; text: string }) {
  return (
    <div className={className} style={{ ['--len' as string]: String(text.length) }}>
      {text}
    </div>
  )
}

/*
The change against the previous period: an arrow and the size of the change, one
decimal, in the muted tone of the rest of the context line. The arrow, not a sign,
is what tells it apart from the share beside it at a glance: two bare percentages
side by side read as two shares. It is not coloured up or down: more blocked queries
are not good or bad by themselves, and red and green would say they were.

What it is compared with is said once, beside the period picker, and in full to
assistive technology and on hover on every card.
*/
function Change({ ratio, against }: { ratio?: number; against: string }) {
  if (ratio == null) return null
  const text = formatChange(ratio)
  const arrow = text.startsWith('+') ? '\u25b2 ' : text.startsWith('\u2212') ? '\u25bc ' : ''
  return (
    <span className={styles.change} title={`${text} vs ${against}`}>
      <span aria-hidden="true">{arrow}{text.replace(/^[+\u2212]/, '')}</span>
      <span className={styles.offscreen}>{text} vs {against}</span>
    </span>
  )
}

function series(chart: ChartData | undefined, label: string): number[] {
  return chart?.datasets.find((d) => d.label === label)?.data.map(Number) ?? []
}

export function StatCard({
  m,
  s,
  total,
  changes,
  against,
  chart,
  isKey = false,
}: {
  m: Metric
  s?: Stats
  total: number
  changes: Changes | null
  /** What the change is against, in words ("previous hour"). */
  against: string
  /** The main chart as drawn, for the trend. */
  chart?: ChartData
  isKey?: boolean
}) {
  const colour = `var(${tokenForLabel(m.label, 0)})`
  const share = m.pct && s ? percentage(s[m.k], total) : null
  const ratio = s ? changes?.[m.k] : undefined
  const text = (
    <div className={styles.tileText}>
      <div className={styles.k}>{m.label}</div>
      {/* With no data it is NOT a zero: it is a dash, and dimmed. A zero is a true
          figure, and here it would be a lie. */}
      <Figure className={`${styles.v}${s ? '' : ` ${styles.noData}`}`} text={s ? num2(s[m.k]) : '—'} />
      {/* The gap is a HARD space so a card with nothing to add keeps the line's
          height and its neighbours' figures stay level. */}
      <div className={styles.ctx}>
        {share != null && <span className={styles.p}>{share}</span>}
        <Change ratio={ratio} against={against} />
        {share == null && ratio == null && ' '}
      </div>
    </div>
  )
  return (
    <div className={`${styles.tile} ${isKey ? styles.key : styles.detail}`} style={{ ['--tc' as string]: colour }}>
      {text}
      {isKey && <Spark data={series(chart, m.series)} colour={colour} className={styles.keySpark} />}
    </div>
  )
}
