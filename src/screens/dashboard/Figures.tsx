import type { ChartData, Stats } from '../../api/dashboard'
import { num2, percentage, type Metric } from './metrics'
import { formatChange, type Changes } from './compare'
import { tokenForLabel } from './palette'
import { Spark } from './Spark'
import styles from './Dashboard.module.css'

/*
The eleven figures, in upstream's labels, as the cockpit draws them (Adrián's
choice of 2026-10-15): one block that answers "how much, of what" without
scrolling.

`Total Queries` is the one read first, so it is the larger card and spans both rows,
with its trend along its foot. The other ten are compact cards in two rows of five:
`Clients`, then the response codes (`No Error`, `Server Failure`, `NX Domain`,
`Refused`) and how the answer was obtained (`Authoritative`, `Recursive`, `Cached`,
`Blocked`, `Dropped`), which is upstream's own order for those nine. Upstream's words
for each figure do not change; only their weight and their place do.

Every card reads in the same order: what it is, how much with its share of the
total, and its change against the previous period when there is one. The trend
beside it is the figure's series in the Queries chart, and the colour of its edge is
that series' colour.
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

What it is compared with is said once, in the `Total Queries` card (`long`), and in
full to assistive technology and on hover on every card.
*/
function Change({ ratio, against, long = false }: { ratio?: number; against: string; long?: boolean }) {
  if (ratio == null) return null
  const text = formatChange(ratio)
  const arrow = text.startsWith('+') ? '\u25b2 ' : text.startsWith('\u2212') ? '\u25bc ' : ''
  return (
    <span className={styles.change} title={`${text} vs ${against}`}>
      <span aria-hidden="true">{arrow}<b>{text.replace(/^[+\u2212]/, '')}</b></span>
      {long && <span aria-hidden="true"> vs {against}</span>}
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
  hero = false,
  onOpen,
}: {
  m: Metric
  s?: Stats
  total: number
  changes: Changes | null
  /** What the change is against, in words ("previous hour"). */
  against: string
  /** The main chart as drawn, for the trend. */
  chart?: ChartData
  /** `Total Queries`: the larger card, which also says what the change is against. */
  hero?: boolean
  /** The card's jump to Query Logs (`Metric.open`), when it has one and Query Logs
   *  is there to land on. */
  onOpen?: () => void
}) {
  const colour = `var(${tokenForLabel(m.label, 0)})`
  const share = m.pct && s ? percentage(s[m.k], total) : null
  const ratio = s ? changes?.[m.k] : undefined
  return (
    <div className={`${styles.tile} ${hero ? styles.hero : styles.fig}`} style={{ ['--tc' as string]: colour }}>
      <div className={styles.k}>{m.label}</div>
      <div className={styles.body}>
        <div className={styles.text}>
          {/* With no data it is NOT a zero: it is a dash, and dimmed. A zero is a
              true figure, and here it would be a lie. */}
          <div className={styles.line}>
            <Figure className={`${styles.v}${s ? '' : ` ${styles.noData}`}`} text={s ? num2(s[m.k]) : '\u2014'} />
            {share != null && <span className={styles.p}>{share}</span>}
          </div>
          {/* The gap is a HARD space so a card with nothing to add keeps the line's
              height and its neighbours' figures stay level. */}
          <div className={styles.ctx}>
            <Change ratio={ratio} against={against} long={hero} />
            {ratio == null && '\u00a0'}
          </div>
        </div>
        <Spark data={series(chart, m.series)} colour={colour} className={styles.spark} />
      </div>
      {/* Upstream's card is a link to Query Logs (v15.6.2). Here a button laid over
          the whole card, so the card's own reading order stays as it is; its name
          is the card's label and its title upstream's menu text. */}
      {onOpen && (
        <button type="button" className={styles.open} aria-label={m.label} title="Show Query Logs" onClick={onOpen} />
      )}
    </div>
  )
}
