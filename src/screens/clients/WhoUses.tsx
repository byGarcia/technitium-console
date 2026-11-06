import { Panel, Body } from '../../ui/Panel'
import { num2, percentage } from '../dashboard/metrics'
import { label, type Busiest } from './clients-model'
import styles from './Clients.module.css'

/*
"Queries by client" (CONVENTIONS.md, deviation 25): the period's busiest clients as
one bar, each segment as wide as its share of the period's queries
(`dashboard/stats/getTop` over `totalQueries` of `dashboard/stats/get`), most first,
the rest of the traffic left as the bare track. A segment wide enough to hold a name
writes it (6 % of the bar and up); every segment names itself to the pointer and
the reader, and a click opens that client. The open one is marked.

OURS, all its words: `Queries by client`, its sentence, each segment's `<client>: N
queries (X%)`, and the caption `N queries. The N busiest clients are shown, covering
X% of the traffic.` (`The busiest client is shown` with one).
*/

/** A segment writes its name from this share of the bar. */
const NAMED = 0.06

export function WhoUses({
  busiest,
  totalQueries,
  selected,
  onSelect,
}: {
  busiest: Busiest
  totalQueries: number
  selected: string | null
  onSelect: (ip: string) => void
}) {
  if (busiest.rows.length === 0 || totalQueries === 0) return null
  const n = busiest.rows.length
  return (
    <Panel title="Queries by client">
      <Body className={styles.usesBody}>
        <p className={styles.usesHint}>Share of the period&apos;s queries. Click a segment to open that client.</p>
        <div className={styles.usesBar}>
          {busiest.rows.map(({ row, share }, i) => {
            const name = label(row)
            const text = `${name}: ${num2(row.hits)} queries (${percentage(row.hits, totalQueries)})`
            return (
              <button
                key={row.ip}
                type="button"
                className={styles.usesSegment}
                aria-label={text}
                title={text}
                aria-current={row.ip === selected || undefined}
                style={{
                  flexBasis: `${share * 100}%`,
                  ['--cl-mix' as string]: `${Math.max(22, 88 - i * 7)}%`,
                }}
                onClick={() => onSelect(row.ip)}
              >
                {share >= NAMED && <span className={styles.usesName}>{name}</span>}
              </button>
            )
          })}
        </div>
        <p className={styles.usesCaption}>
          {`${num2(totalQueries)} queries. ${n === 1 ? 'The busiest client is shown' : `The ${n} busiest clients are shown`}, covering ${Math.round(busiest.covered * 100)}% of the traffic.`}
        </p>
      </Body>
    </Panel>
  )
}
