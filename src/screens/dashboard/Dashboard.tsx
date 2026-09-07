import { useEffect, useState, type ReactNode } from 'react'
import {
  RANGE_LABEL, RANGES, getDashboardStats,
  type DashboardStats, type Range, type Stats, type TopKind, type TopEntry,
} from '../../api/dashboard'
import { Chart } from './Chart'
import { tokenForLabel } from './palette'
import { ClusterNodeSelect, AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { EnElCromo } from '../../app/ChromeSlot'
import { TopStats } from './TopStats'
import type { ChartData } from '../../api/dashboard'
import { SectionHeader } from '../../ui/SectionHeader'
import { Empty, Failure, Loading } from '../../ui/Empty'
import styles from './Dashboard.module.css'
import { Body, Panel } from '../../ui/Panel'
import { Button } from '../../ui/Button'
import { type AlertType } from '../../ui/Alert'
import { BlockingMenu } from './BlockingMenu'
import { rangeInstants, whatIsMissing, MSG_INICIO, MSG_FIN } from './custom-range'
import { Segmented } from '../../ui/Segmented'
import { noticeFromFailure } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

/*
The eleven metrics, in upstream's order and with its literal labels. Each one's
colour is that of its series in the main chart.
*/
/*
No colour here any more.

Each tile took its own hex and they contradicted the charts on the same screen:
"Authoritative" was olive up here and sky blue down in the doughnut, "Cached"
violet in the tile and teal in the chart. A label that changes colour halfway
down a page is not a style problem, it is the page disagreeing with itself.

The colour now comes from the same map the charts read, keyed by the same label.
*/
const METRICS: { k: keyof Stats; label: string; pct?: boolean }[] = [
  /*
  The total carries no percentage. Upstream writes a fixed "100%" there in the
  markup —`main.js` never updates it— which is decoration: the percentage of a
  total over itself says nothing. Really calculated, with the server freshly
  started it came out as "0%" under "Total Queries", which on top of informing
  nothing is confusing. The rule that stands is the one the clients tile already
  followed: the percentage is the share of the query total, and the total has no
  share of itself.
  */
  { k: 'totalQueries', label: 'Total Queries' },
  { k: 'totalNoError', label: 'No Error', pct: true },
  { k: 'totalServerFailure', label: 'Server Failure', pct: true },
  { k: 'totalNxDomain', label: 'NX Domain', pct: true },
  { k: 'totalRefused', label: 'Refused', pct: true },
  { k: 'totalAuthoritative', label: 'Authoritative', pct: true },
  { k: 'totalRecursive', label: 'Recursive', pct: true },
  { k: 'totalCached', label: 'Cached', pct: true },
  { k: 'totalBlocked', label: 'Blocked', pct: true },
  { k: 'totalDropped', label: 'Dropped', pct: true },
  { k: 'totalClients', label: 'Clients' },
]

/*
The eleven, split up: TWO totals and NINE in three families of three.

It is the split phase 3 decided, and it is about reading rather than placement.
The two totals —queries and clients— **share their unit with nothing**: one
counts questions and the other counts who asked them, so putting them in the same
grid as the rest invites a comparison that cannot be made. And neither carries a
percentage, which is the other thing that sets them apart.

The nine are parts of the total, and each row is a different question:

  · **how it ended**   — `No Error`, `Server Failure`, `NX Domain`
  · **why it was turned down** — `Refused`, `Blocked`, `Dropped`
  · **where it came from** — `Authoritative`, `Recursive`, `Cached`

The order is NOT the one in `METRICS`, and it does not matter: `tokenForLabel`
assigns the colour **by label** and only falls back to position for labels it does
not know, so reordering moves no colour at all. Proven in `palette.test.ts`,
which already asserts exactly that.
*/
const byLabel = (label: string) => METRICS.find((m) => m.label === label)!
const TOTALS = ['Total Queries', 'Clients'].map(byLabel)
const FAMILIES = [
  ['No Error', 'Server Failure', 'NX Domain'],
  ['Refused', 'Blocked', 'Dropped'],
  ['Authoritative', 'Recursive', 'Cached'],
].map((row) => row.map(byLabel))

const COUNTERS: { k: keyof Stats; label: string }[] = [
  { k: 'zones', label: 'Zones' },
  { k: 'cachedEntries', label: 'Cache' },
  { k: 'allowedZones', label: 'Allowed' },
  { k: 'blockedZones', label: 'Blocked' },
  { k: 'allowListZones', label: 'Allow List' },
  { k: 'blockListZones', label: 'Block List' },
]

/*
The numbers come out as in upstream, and upstream does NOT pin a locale: it uses
a bare `toLocaleString()` (main.js:2632-2650), that is, the browser's. They were
nailed to `es-ES`, so a server in English showed "84.930" as "84.930" but with
the dot meaning the opposite.
*/
const num2 = (n: number) => n.toLocaleString()

/*
The percentage carries no locale, neither in upstream nor here: it is
`toFixed(2)`, which always writes the dot (main.js:2652-2676). And with zero
queries it is a literal "0%", not "0.00%".
*/
export function percentage(value: number, total: number): string {
  if (total === 0) return '0%'
  return ((value * 100) / total).toFixed(2) + '%'
}

/*
A chart with no value other than zero is not drawn: an empty canvas takes up the
same room and says nothing. It says there is no data instead.

It returns a TYPE GUARD rather than a plain `boolean`: asking it whether there is
data is precisely what proves the chart exists, so the compiler ought to hear
about it. Without that, `Split` had to accept `ChartData | undefined` and passed
it straight back to `Chart`, which does demand it — and the `undefined` went on
slipping in through the side door.
*/
export function hasData(d?: ChartData): d is ChartData {
  if (!d?.datasets?.length) return false
  return d.datasets.some((s) => (s.data ?? []).some((n) => Number(n) > 0))
}

/*
A doughnut chart, with its legend outside the canvas.

Its entry is a LABEL and not a series —a doughnut has one dataset and as many
slices as `labels`— and its figure is the **percentage** of that chart's own
total. It is what the delivery draws and what the in-canvas legend could not say:
there, only the name fitted.

The percentage is worked out here and does not come from the server. It is
written with the same `percentage()` as the cards **on purpose**: two shapes of
the same number on one screen is worse than either of them.
*/
function Split({ title, data, failure }: { title: string; data?: ChartData; failure: boolean }) {
  const { hidden, toggle } = useHidden(data)
  /*
  `data` may NOT arrive, and the first version of this did not allow for it: it
  worked out the percentages before the `hasData` below and took the whole screen
  down with a `Cannot read properties of undefined`. The previous code was safe by
  accident —it asked `hasData(data)` first, and that one does accept `undefined`.

  The suite found it, not a reading: six session tests that have nothing to do
  with the Dashboard fell over at once, because a component that throws takes down
  the tree holding it.
  */
  const values = (data?.datasets?.[0]?.data ?? []) as number[]
  const total = values.reduce((a, n) => a + Number(n || 0), 0)
  const entries = (data?.labels ?? []).map((l, i) => ({
    label: String(l),
    datum: percentage(Number(values[i] ?? 0), total),
  }))

  return (
    <Panel title={title} className={styles.panel}>
      <Body>
        {hasData(data) ? (
          /* Ring on the left, legend on the right — the drawing's shape. */
          <div className={styles.split}>
            <Chart
              type="doughnut"
              data={data}
              height={128}
              aria={title}
              separateLegend
              hidden={hidden}
            />
            <Legend entries={entries} hidden={hidden} onToggle={toggle} />
          </div>
        ) : (
          <Placeholder failure={failure} empty="No data for this period." />
        )}
      </Body>
    </Panel>
  )
}

function Top({
  title,
  rows,
  isClient = false,
  onMore,
  failure,
  beforeMore,
}: {
  title: string
  rows: TopEntry[]
  /** A client also shows the domain it resolved and whether it was rate limited. */
  isClient?: boolean
  onMore: () => void
  /** When the request failed: the gap is not drawn the way an empty one is. */
  failure: boolean
  /** The panel's own action, to the left of "More". Only the blocked-domains one
   *  uses it, with the blocking menu upstream puts there. */
  beforeMore?: ReactNode
}) {
  return (
    <Panel
      title={title}
      className={styles.panel}
      actions={
        <div className={styles.accionesPanel}>
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
        {rows.length === 0 && <Placeholder failure={failure} empty="No data for this period." />}
        {rows.slice(0, 5).map((f, i) => (
          <div
            className={`${styles.toprow}${f.rateLimited ? ` ${styles.limited}` : ''}`}
            key={`${f.name}|${i}`}
          >
            <span className={styles.n}>
              {f.name}
              {f.rateLimited ? ' (rate limited)' : ''}
              {isClient && (
                <span className={styles.topDomain}>
                  {f.domain === '' || f.domain == null ? '.' : f.domain}
                </span>
              )}
            </span>
            <span className={styles.c}>{num2(f.hits)}</span>
          </div>
        ))}
      </Body>
    </Panel>
  )
}

/*
The legend, in HTML and not inside the canvas — and the same one for all four
charts.

Chart.js drew it inside the `<canvas>`, and that costs two things you only see by
measuring: **no tool can read it** —neither the screen contract nor a screen
reader— and the figure that makes it useful does not fit in it: the count on the
line chart, the percentage on the doughnuts.

What does NOT change is the interaction: **clicking an entry hides it**, which is
what the stock `onClick` did and what the contract protects. Here it is a
`<button>` with `aria-pressed`, so it is also reachable by keyboard and announced
— inside the canvas it was neither.
*/
function Legend({
  entries,
  hidden,
  onToggle,
}: {
  entries: { label: string; datum: string }[]
  hidden: ReadonlySet<string>
  onToggle: (label: string) => void
}) {
  return (
    <div className={styles.legend}>
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
            {e.label} <b>{e.datum}</b>
          </button>
        )
      })}
    </div>
  )
}

/*
The line chart: one entry per SERIES, and its figure is the count for the period.
*/
function Line({ data }: { data: ChartData }) {
  const { hidden, toggle } = useHidden(data)
  const entries = data.datasets.map((d) => ({
    label: String(d.label ?? ''),
    datum: num2((d.data ?? []).reduce((a, n) => a + Number(n || 0), 0)),
  }))
  return (
    <>
      <Legend entries={entries} hidden={hidden} onToggle={toggle} />
      <Chart type="line" data={data} aria="Queries over time" separateLegend hidden={hidden} />
    </>
  )
}

/*
A region's gap: empty or failure, and **never the same drawing**.

It is the phase 1 rule that matters most on this screen: *dashed = empty, solid =
error, and they are never swapped*. Here it is not decoration — a failure drawn as
"no queries for this period" tells whoever administers a DNS that their server is
receiving no traffic, which is the most expensive lie in the console and the
easiest to believe, because it looks exactly like a normal answer.

The failure sentence is ONE and the same in all three regions on purpose: the
detail —what failed and when the last good data was— travels in the notice at the
top, which appears once. Repeating it per panel would say the same thing three
times and compete with it.
*/
function Placeholder({ failure, empty }: { failure: boolean; empty: string }) {
  if (failure) return <Failure>Could not load this data.</Failure>
  return <Empty compact>{empty}</Empty>
}

/*
Which legend entries are switched off, and **they reset when new data arrives**.

The second half is not a convenience: without it, changing period or node rebuilds
the chart and the series come back on, but the button would stay at
`aria-pressed="false"` — the control saying one thing and the thing controlled
saying another. It would also change today's behaviour: Chart.js's stock legend
loses its state on every rebuild, so keeping it would be inventing a memory the
console does not have.

It resets on the identity of `data`, which is what changes with every response.
*/
function useHidden(data: ChartData | undefined) {
  const [hidden, setOcultas] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => setOcultas(new Set()), [data])
  const toggle = (label: string) =>
    setOcultas((prev) => {
      const next = new Set(prev)
      if (!next.delete(label)) next.add(label)
      return next
    })
  return { hidden, toggle }
}

/*
One card. It is pulled out into its own component because it is now drawn from two
places —the two totals and the nine— and keeping it duplicated is how one of the
two copies ends up without the `—` or without the percentage.

`hero` is size only: `Total Queries` is the figure that gets read first.

The gap where the percentage goes is a HARD space and not an ordinary one: without
it the row loses its height and the cards with no percentage sit lower than the
other nine.
*/
function Card({
  m,
  s,
  total,
  hero = false,
}: {
  m: { k: keyof Stats; label: string; pct?: boolean }
  s?: Stats
  total: number
  hero?: boolean
}) {
  return (
    <div
      className={`${styles.tile}${hero ? ` ${styles.hero}` : ''}`}
      style={{ ['--tc' as string]: `var(${tokenForLabel(m.label, 0)})` }}
    >
      {/* With no data it is NOT a zero: it is a dash, and dimmed. A zero is a
          true figure, and here it would be a lie. */}
      <div className={`${styles.v}${s ? '' : ` ${styles.noData}`}`}>{s ? num2(s[m.k]) : '—'}</div>
      <div className={styles.p}>{m.pct && s ? percentage(s[m.k], total) : ' '}</div>
      <div className={styles.k}>{m.label}</div>
    </div>
  )
}

export function Dashboard({
  token,
  nodes = [],
  clusterInitialised = false,
}: {
  token: string | null
  nodes?: ClusterNode[]
  clusterInitialised?: boolean
}) {
  /*
  Which node this screen is reading. Upstream offers the aggregate here and
  remembers the choice per screen (`cluster.js`, key `dashboardClusterNode`).

  Corrected on 2026-09-03: this comment used to say "the other eight selectors do
  neither", and that is false. **`Settings` does both as well**, with its own key
  `settingsClusterNode` — its own file says so: "one of only TWO screens that
  offer the aggregate and remember the choice". There are two, not one, and that
  is exactly why the selector cannot be made global: each has its own memory. See
  spec F10.
  */
  const [node, setNode] = useState<string>(
    () => localStorage.getItem('dashboardClusterNode') || AGGREGATE,
  )
  useEffect(() => {
    localStorage.setItem('dashboardClusterNode', node)
  }, [node])

  const [range, setRange] = useState<Range>('LastHour')
  const [data, setDatos] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  /*
  That the request FAILED, which is not the same as there being no data.

  Without that distinction a failure was drawn like a quiet server: eleven cards
  at zero and the panels saying "no queries for this period", which is exactly
  what a DNS that has received nothing shows. `Dashboard.tsx` already denounced it
  in a comment —"the screen was answering falsely about the one thing people come
  here to look at"— and fixed it for the cards only, which now show `—`. The
  panels went on lying.
  */
  const [failure, setFailure] = useState(false)
  /** What is missing from the custom range, if anything is. One at a time. */
  const [missingRange, setMissingRange] = useState<string | null>(null)
  const [top, setTop] = useState<TopKind | null>(null)
  const [notice, setNotice] = useState<{ type: AlertType; title: string; text: string } | null>(null)
  /*
  The custom range. `start`/`end` are what is typed into the two fields;
  `requested` is the last thing "Show" was pressed with, which is what triggers the
  query. They are kept apart because typing a date must not reload the Dashboard:
  upstream does not either, it waits for the button (`main.js:646`).
  */
  const [start, setInicio] = useState('')
  const [end, setFin] = useState('')
  const [requested, setRequested] = useState<{ start: string; end: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    // With "Custom" chosen and no dates yet there is nothing to ask for.
    if (range === 'Custom' && requested == null) {
      setLoading(false)
      return
    }
    setLoading(true)
    void (async () => {
      const r = await getDashboardStats(token, range, requested ?? undefined, node)
      if (cancelled) return
      setLoading(false)
      if (r.kind === 'ok') {
        setDatos(r.data)
        setFailure(false)
        return
      }
      /*
      A failure is NOT drawn as a quiet server. Without this, the eleven tiles
      came out at zero and the panels said "No queries for this period.", which is
      exactly what a DNS that has received nothing shows: the screen was answering
      falsely about the one thing people come here to look at.
      */
      setDatos(null)
      setFailure(true)
      setNotice(noticeFromFailure(r))
    })()
    return () => {
      cancelled = true
    }
  }, [token, range, requested, node])

  /*
  The range message goes NEXT TO ITS FIELD, not to the notice at the top.

  Phase 1 decided it —"the validation error goes next to its field, and never in
  two places at once"— and until now it came out in the `Notifier`, half a screen
  away from the field that caused it.

  What does NOT change is how many or when: `whatIsMissing` returns **one**, the
  start one first and only then the end one, and **it appears on pressing `Show`**.
  A form that opens already in red blames the user for not having done something
  they have not yet had the chance to do.
  */
  function showRange() {
    const missing = whatIsMissing(start, end)
    setMissingRange(missing)
    if (missing != null) return
    setRequested(rangeInstants(start, end))
  }

  const s = data?.stats
  const total = s?.totalQueries ?? 0

  return (
    <>
      <SectionHeader title="Dashboard" />

      {/*
      The period bar goes UNDER the title and to the left, which is where the
      accepted drawing puts it. It was built into the header's `actions`, which
      pushes it to the right-hand end of the title row: that reads as "an action on
      this screen" —like `Add Zone` or `Flush Cache`— and it is not one. It
      reframes every figure below, the same reason the node selector went up to the
      chrome slot.
      */}
      <div className={styles.periodBar}>
        <Segmented
          label="Period"
          options={RANGES.map((r) => ({ id: r, label: RANGE_LABEL[r] }))}
          active={range}
          onChoose={(r) => {
            setRange(r)
            if (r !== 'Custom') setRequested(null)
          }}
        />
      </div>

      {range === 'Custom' && (
        <div className={styles.ownRange}>
          <label>
            Start
            <input
              type="date"
              value={start}
              aria-invalid={missingRange === MSG_INICIO || undefined}
              onChange={(e) => setInicio(e.target.value)}
            />
            {missingRange === MSG_INICIO && <span className={styles.badRange}>{missingRange}</span>}
          </label>
          <label>
            End
            <input
              type="date"
              value={end}
              aria-invalid={missingRange === MSG_FIN || undefined}
              onChange={(e) => setFin(e.target.value)}
            />
            {missingRange === MSG_FIN && <span className={styles.badRange}>{missingRange}</span>}
          </label>
          <Button size="sm" variant="primary" onClick={showRange}>
            Show
          </Button>
        </div>
      )}

      {/*
      The node selector goes up into the chrome slot, and **stays this screen's**:
      its state, its options and its memory (`dashboardClusterNode`) remain here.
      The chrome only provides the place.

      It goes up because it does not filter a region: **it reframes every figure
      below**, so reading them without first seeing which node they belong to is
      reading them wrong. Next to the period selector it looked like one more
      filter.

      It draws nothing when there is no cluster —`ClusterNodeSelect` returns `null`
      without `clusterInitialized`— so on a single-server install the slot stays
      empty and takes up nothing.
      */}
      <EnElCromo>
        <ClusterNodeSelect
          nodes={nodes}
          initialised={clusterInitialised}
          aggregate
          value={node}
          onChange={setNode}
        />
      </EnElCromo>

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {/*
      `data-testid="metrics"` wraps all eleven and not each group: it is the hook
      `dev/screen-contract.mjs` counts them with, and eleven cards split across two
      boxes are still eleven cards.
      */}
      <div className={styles.tiles} data-testid="metrics">
        <div className={styles.tot}>
          {TOTALS.map((m) => (
            <Card key={m.k} m={m} s={s} total={total} hero={m.label === 'Total Queries'} />
          ))}
        </div>
        <div className={styles.nine}>
          {FAMILIES.flat().map((m) => (
            <Card key={m.k} m={m} s={s} total={total} />
          ))}
        </div>
      </div>

      {/*
      The lower half, as the accepted drawing has it: `Queries` with `Server`
      beside it, then the three doughnuts in a row, then the three top-N lists in
      another.

      It was built as a 310 px right rail holding `Server`, the three doughnuts
      and `Top Clients` stacked, with only two panels on the left. Nothing recorded
      the change and the contract does not fix the layout, so it was not a decision
      — it was a drift. What it cost is visible at 1440: the doughnuts had 310 px
      to live in, so they came out as a huge centred ring with the legend
      underneath, `Server` lost its third column, `Top Clients` left the group it
      belongs to, and half the canvas below was empty.
      */}
      <div className={styles.grid}>
        <Panel title="Queries" className={styles.panel}>
          <Body>
            {loading && <Loading compact />}
            {!loading && data && hasData(data.mainChartData) && (
              <Line data={data.mainChartData} />
            )}
            {!loading && (!data || !hasData(data.mainChartData)) && (
              <Placeholder failure={failure} empty="No queries for this period." />
            )}
          </Body>
        </Panel>

        <Panel title="Server" className={styles.panel}>
          <Body>
            <div className={styles.counters} data-testid="counters">
              {COUNTERS.map((c) => (
                <div className={styles.cnt} key={c.k}>
                  <div className={styles.v}>{s ? num2(s[c.k]) : '—'}</div>
                  <div className={styles.k}>{c.label}</div>
                </div>
              ))}
            </div>
          </Body>
        </Panel>
      </div>

      {data && (
        <div className={styles.trio}>
          <Split title="Query Response Types" data={data.queryResponseChartData} failure={failure} />
          <Split title="Query Types" data={data.queryTypeChartData} failure={failure} />
          <Split title="Protocol Types" data={data.protocolTypeChartData} failure={failure} />
        </div>
      )}

      <div className={styles.trio}>
        <Top
          title="Top Domains"
          rows={data?.topDomains ?? []}
          onMore={() => setTop('TopDomains')}
          failure={failure}
        />
        <Top
          title="Top Blocked Domains"
          rows={data?.topBlockedDomains ?? []}
          onMore={() => setTop('TopBlockedDomains')}
          failure={failure}
          beforeMore={<BlockingMenu token={token} onNotice={setNotice} />}
        />
        <Top
          title="Top Clients"
          rows={data?.topClients ?? []}
          isClient
          onMore={() => setTop('TopClients')}
          failure={failure}
        />
      </div>

      <TopStats type={top} range={range} token={token} onClose={() => setTop(null)} />
    </>
  )
}
