import { useMemo } from 'react'
import { Body, Panel } from '../../ui/Panel'
import { Empty, Loading } from '../../ui/Empty'
import { flowOf, place, type FlowNode } from './resolution'
import { SampleState, type DashboardSample } from './dashboard-sample'
import styles from './Resolution.module.css'

/*
From query to answer, on the Dashboard (OURS, CONVENTIONS.md deviation 29): the
newest logged queries (the same read as Response Time) flowing from all of them,
through how the server answered them, to what it answered. Each band is as thick
as its queries. A kind or a code with a name opens Query Logs filtered by it, as
the Dashboard's other charts do, with no period: the sample is the newest queries,
not the period.

Its words, all OURS: `From query to answer`, `Queries`, `Other`, `From the
latest N logged queries` / `on <node>`, `No queries logged yet.`. The kinds and codes
are upstream's names.
*/

const H = 260
const GAP = 10
const BAR = 14
const X = { all: 170, how: 492, what: 986 }

function band(x1: number, a1: number, b1: number, x2: number, a2: number, b2: number): string {
  const m = (x1 + x2) / 2
  return `M${x1},${a1} C${m},${a1} ${m},${a2} ${x2},${a2} L${x2},${b2} C${m},${b2} ${m},${b1} ${x1},${b1} Z`
}

export function Resolution({
  sample,
  where,
  open,
}: {
  sample: DashboardSample
  where: string
  /** Opens Query Logs filtered by a kind or a code; absent where it cannot land. */
  open?: (filter: { responseType?: string; rcode?: string }) => void
}) {
  const flow = useMemo(() => (sample.kind === 'ok' ? flowOf(sample.entries) : null), [sample])

  return (
    <Panel
      title="From query to answer"
      className={styles.panel}
      actions={
        flow != null && flow.total > 0 ? (
          <span className={styles.caption}>
            From the latest {flow.total.toLocaleString('en-US')} logged queries{where}
          </span>
        ) : undefined
      }
    >
      <Body>
        {sample.kind !== 'ok' ? (
          <SampleState sample={sample} />
        ) : flow == null ? (
          <Loading compact />
        ) : flow.total === 0 ? (
          <Empty compact>No queries logged yet.</Empty>
        ) : (
          <Diagram flow={flow} open={open} />
        )}
      </Body>
    </Panel>
  )
}

function Diagram({ flow, open }: { flow: NonNullable<ReturnType<typeof flowOf>>; open?: (f: { responseType?: string; rcode?: string }) => void }) {
  const howAt = place(flow.how.map((n) => n.count), H, GAP)
  const whatAt = place(flow.what.map((n) => n.count), H, GAP)
  const scaleHow = (i: number) => (flow.how[i].count === 0 ? 0 : howAt[i].h / flow.how[i].count)
  const scaleWhat = (j: number) => (flow.what[j].count === 0 ? 0 : whatAt[j].h / flow.what[j].count)

  /* The left column is one bar, the whole height: the bands to the kinds stack down
     all of it in their order, each as thick as its share. */
  const allBands: { a: number; b: number }[] = []
  {
    let y = 0
    for (const n of flow.how) {
      const h = (n.count / flow.total) * H
      allBands.push({ a: y, b: y + h })
      y += h
    }
  }
  /* From each kind to each code: stacked down the kind in code order, and down the code in kind order. */
  const outAt = flow.how.map((_, i) => howAt[i].y)
  const inAt = flow.what.map((_, j) => whatAt[j].y)
  const links: { d: string; tone: string; key: string; title: string }[] = []
  flow.how.forEach((h, i) => {
    flow.what.forEach((w, j) => {
      const n = flow.links[i][j]
      if (n === 0) return
      const t1 = n * scaleHow(i)
      const t2 = n * scaleWhat(j)
      links.push({
        key: `${i}-${j}`,
        tone: h.tone,
        title: `${h.label} → ${w.label}: ${n.toLocaleString('en-US')}`,
        d: band(X.how + BAR, outAt[i], outAt[i] + t1, X.what, inAt[j], inAt[j] + t2),
      })
      outAt[i] += t1
      inAt[j] += t2
    })
  })

  const label = (n: FlowNode, at: { y: number; h: number }, side: 'how' | 'what', filter: 'responseType' | 'rcode') => {
    const text = (
      <>
        <span className={styles.name}>{n.label}</span> <span className={styles.count}>{n.count.toLocaleString('en-US')}</span>
      </>
    )
    const style = { top: `${((at.y + at.h / 2) / H) * 100}%` }
    const cls = `${styles.label} ${side === 'how' ? styles.labelHow : styles.labelWhat}`
    const can = open != null && n.value != null
    if (at.h < 12) return null
    return can ? (
      <button key={`${side}-${n.label}`} type="button" className={cls} style={style} onClick={() => open?.({ [filter]: n.value as string })} title={`Open Query Logs: ${n.label}`}>
        {text}
      </button>
    ) : (
      <span key={`${side}-${n.label}`} className={cls} style={style}>
        {text}
      </span>
    )
  }

  return (
    <div className={styles.diagram}>
      <div className={styles.plot}>
      <svg className={styles.svg} viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" role="img" aria-label="Flow of the latest logged queries from how they were answered to what was answered">
        {flow.how.map((n, i) => (
          <path
            key={`all-${n.label}`}
            className={styles.link}
            style={{ fill: `var(${n.tone})` }}
            d={band(X.all + BAR, allBands[i].a, allBands[i].b, X.how, howAt[i].y, howAt[i].y + howAt[i].h)}
          >
            <title>{`Queries → ${n.label}: ${n.count.toLocaleString('en-US')}`}</title>
          </path>
        ))}
        {links.map((l) => (
          <path key={l.key} className={styles.link} style={{ fill: `var(${l.tone})` }} d={l.d}>
            <title>{l.title}</title>
          </path>
        ))}
        <rect className={styles.node} x={X.all} y={0} width={BAR} height={H} />
        {flow.how.map((n, i) => (
          <rect key={`h-${n.label}`} className={styles.node} style={{ fill: `var(${n.tone})` }} x={X.how} y={howAt[i].y} width={BAR} height={Math.max(1, howAt[i].h)} />
        ))}
        {flow.what.map((n, j) => (
          <rect key={`w-${n.label}`} className={styles.node} style={{ fill: `var(${n.tone})` }} x={X.what} y={whatAt[j].y} width={BAR} height={Math.max(1, whatAt[j].h)} />
        ))}
      </svg>
      <span className={`${styles.label} ${styles.labelAll}`} style={{ top: '50%' }}>
        <span className={styles.name}>Queries</span>
        <span className={styles.count}>{flow.total.toLocaleString('en-US')}</span>
      </span>
      {flow.how.map((n, i) => label(n, howAt[i], 'how', 'responseType'))}
      {flow.what.map((n, j) => label(n, whatAt[j], 'what', 'rcode'))}
      </div>
      {/* On a narrow card the codes leave the bands for a legend under them. */}
      <ul className={styles.legend}>
        {flow.what.map((n) => (
          <li key={n.label}>
            <span className={styles.swatch} style={{ background: `var(${n.tone})` }} aria-hidden="true" />
            {open != null && n.value != null ? (
              <button type="button" className={styles.legendItem} onClick={() => open({ rcode: n.value as string })}>
                {n.label} <span className={styles.count}>{n.count.toLocaleString('en-US')}</span>
              </button>
            ) : (
              <span className={styles.legendItem}>
                {n.label} <span className={styles.count}>{n.count.toLocaleString('en-US')}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
