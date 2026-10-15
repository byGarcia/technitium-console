import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  RANGE_LABEL, RANGES, getDashboardStats,
  type DashboardStats, type Range, type Stats, type TopKind, type TopEntry,
} from '../../api/dashboard'
import { useHandoff, type QueryLogsFilters } from '../../app/handoff'
import { changes, previousLabel, previousQuery, windowOf, type PreviousQuery } from './compare'
import { Figure, StatCard } from './Figures'
import { FAMILIES, KEYS, num2, percentage } from './metrics'
import { TypeBars } from './TypeBars'
import {
  bucketWindow, periodFilters, protocolFilter, queryTypeFilter, responseTypeFilter,
} from './jump'
import { Chart } from './Chart'
import { tokenForLabel } from './palette'
import { ClusterNodeSelect, AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { InChrome } from '../../app/ChromeSlot'
import { TopStats } from './TopStats'
import { TopRowMenu } from './TopRowMenu'
import { useDomainAction } from '../../lib/allow-block'
import type { ChartData } from '../../api/dashboard'
import { SectionHeader } from '../../ui/SectionHeader'
import { Empty, Failure, Loading } from '../../ui/Empty'
import styles from './Dashboard.module.css'
import { Body, Panel } from '../../ui/Panel'
import { Button } from '../../ui/Button'
import { type AlertType } from '../../ui/Alert'
import { BlockingMenu } from './BlockingMenu'
import { LAST_HOUR_REFRESH_MS, useLiveView } from './useLive'
import { rangeInstants, whatIsMissing, MSG_START, MSG_END } from './custom-range'
import { Segmented } from '../../ui/Segmented'
import { noticeFromFailure } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

const COUNTERS: { k: keyof Stats; label: string }[] = [
  { k: 'zones', label: 'Zones' },
  { k: 'cachedEntries', label: 'Cache' },
  { k: 'allowedZones', label: 'Allowed' },
  { k: 'blockedZones', label: 'Blocked' },
  { k: 'allowListZones', label: 'Allow List' },
  { k: 'blockListZones', label: 'Block List' },
]

/* Blocking › Overview reads these two from here. */
export { percentage }

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

/*
A doughnut chart, with its legend outside the canvas.

Its entry is a LABEL and not a series (a doughnut has one dataset and as many
slices as `labels`), and its figure is the **percentage** of that chart's own
total. It is what the design draws and what the in-canvas legend could not say:
there, only the name fitted.

The percentage is worked out here and does not come from the server. It is
written with the same `percentage()` as the cards **on purpose**: two shapes of
the same number on one screen is worse than either of them.
*/
function Split({
  title,
  data,
  failure,
  resetOn = data,
  onPick,
  pickable,
}: {
  title: string
  data?: ChartData
  failure: boolean
  /** What switches every slice back on: the server's response (see `useHidden`). */
  resetOn?: unknown
  /** A slice's jump to Query Logs, by its label (deviation 6). */
  onPick?: (label: string) => void
  pickable?: (label: string) => boolean
}) {
  const { hidden, toggle } = useHidden(resetOn)
  /*
  `data` may NOT arrive, and the first version of this did not allow for it: it
  worked out the percentages before the `hasData` below and took the whole screen
  down with a `Cannot read properties of undefined`. The previous code was safe by
  accident: it asked `hasData(data)` first, and that one does accept `undefined`.

  The suite found it, not a reading: six session tests that have nothing to do
  with the Dashboard fell over at once, because a component that throws takes down
  the tree holding it.
  */
  const values = (data?.datasets?.[0]?.data ?? []) as number[]
  const total = values.reduce((a, n) => a + Number(n || 0), 0)
  const labels = (data?.labels ?? []).map(String)
  const entries = labels.map((l, i) => ({
    label: l,
    count: num2(Number(values[i] ?? 0)),
    datum: percentage(Number(values[i] ?? 0), total),
  }))

  return (
    <Panel title={title} className={styles.panel}>
      <Body>
        {hasData(data) ? (
          /* Ring on the left, legend on the right: the drawing's shape. */
          <div className={styles.split}>
            <Chart
              type="doughnut"
              data={data}
              height={128}
              aria={title}
              separateLegend
              hidden={hidden}
              onPick={onPick != null ? (i) => onPick(labels[i]) : undefined}
              pickable={pickable != null ? (i) => pickable(labels[i]) : undefined}
            />
            <Legend entries={entries} hidden={hidden} onToggle={toggle} table />
          </div>
        ) : (
          <Placeholder failure={failure} empty="No data for this period." />
        )}
      </Body>
    </Panel>
  )
}

/*
Query Types and Protocol Types: the same panel and the same gaps as `Split`, with
the list of bars in place of the doughnut (`TypeBars.tsx` says why).
*/
function Bars({
  title,
  data,
  failure,
  colour,
  jump,
}: {
  title: string
  data?: ChartData
  failure: boolean
  colour: string
  jump?: (label: string) => (() => void) | undefined
}) {
  return (
    <Panel title={title} className={styles.panel}>
      <Body>
        {hasData(data) ? (
          <TypeBars data={data} aria={title} colour={colour} jump={jump} />
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
      className={styles.panel}
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
        {visibleRows.map((f, i) => (
          <div
            className={`${styles.toprow}${f.rateLimited ? ` ${styles.limited}` : ''}`}
            key={`${f.name}|${i}`}
          >
            <span className={styles.topRank}>{i + 1}</span>
            <span className={styles.n}>
              <span className={styles.topLabel}>
                {f.name}
                {f.rateLimited ? ' (rate limited)' : ''}
              </span>
              {isClient && (
                <span className={styles.topDomain}>
                  {f.domain === '' || f.domain == null ? '.' : f.domain}
                </span>
              )}
              <span className={styles.topBar} aria-hidden="true">
                <i style={{ width: `${largest > 0 && Number.isFinite(f.hits) ? Math.max(0, f.hits) / largest * 100 : 0}%` }} />
              </span>
            </span>
            <span className={styles.c}>{num2(f.hits)}</span>
            {menu(f)}
          </div>
        ))}
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
function Legend({
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
function Line({
  data,
  resetOn = data,
  onPick,
}: {
  data: ChartData
  resetOn?: unknown
  /** A point's jump to Query Logs, by its index (deviation 6). */
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
      <Chart type="line" data={data} aria="Queries over time" separateLegend hidden={hidden} onPick={onPick} />
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
function Placeholder({ failure, empty }: { failure: boolean; empty: string }) {
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
function useHidden(resetOn: unknown) {
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
  `settingsClusterNode`; its own file says so: "one of only TWO screens that
  offer the aggregate and remember the choice". There are two, not one, and that
  is exactly why the selector cannot be made global: each has its own memory.
  */
  const [node, setNode] = useState<string>(
    () => localStorage.getItem('dashboardClusterNode') || AGGREGATE,
  )
  useEffect(() => {
    localStorage.setItem('dashboardClusterNode', node)
  }, [node])

  const [range, setRange] = useState<Range>('LastHour')
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  /*
  That the request FAILED, which is not the same as there being no data.

  Without that distinction a failure was drawn like a quiet server: eleven cards
  at zero and the panels saying "no queries for this period", which is exactly
  what a DNS that has received nothing shows. `Dashboard.tsx` already denounced it
  in a comment ("the screen was answering falsely about the one thing people come
  here to look at") and fixed it for the cards only, which now show the empty-value dash. The
  panels went on lying.
  */
  const [failure, setFailure] = useState(false)
  /** What is missing from the custom range, if anything is. One at a time. */
  const [missingRange, setMissingRange] = useState<string | null>(null)
  const [top, setTop] = useState<TopKind | null>(null)
  const [notice, setNotice] = useState<{ type: AlertType; title: string; text: string } | null>(null)
  /* Allowing or blocking from a top list reports on the page (main.js:2825 and
     2853 pass no alert placeholder). */
  const action = useDomainAction(token, setNotice)
  /*
  The custom range. `start`/`end` are what is typed into the two fields;
  `requested` is the last thing "Show" was pressed with, which is what triggers the
  query. They are kept apart because typing a date must not reload the Dashboard:
  upstream does not either, it waits for the button (`main.js:646`).
  */
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [requested, setRequested] = useState<{ start: string; end: string } | null>(null)
  /*
  The previous period, for each figure's change (deviation 6, `compare.ts`). It
  belongs to ONE response: `for` is the response it was asked for, with its period
  and node, and the changes are drawn only while that response is the one on screen
  and nothing is loading. A new period or node still on its way, a failed read, a
  previous period that failed or that cannot be asked the same way: no change at all.
  */
  const [prev, setPrev] = useState<{
    for: DashboardStats
    range: Range
    node: string
    query: PreviousQuery
    data: DashboardStats
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    let refreshTimer: number | undefined
    // With "Custom" chosen and no dates yet there is nothing to ask for.
    if (range === 'Custom' && requested == null) {
      setLoading(false)
      return
    }

    /*
    Upstream refreshes the Dashboard every 60 seconds, but only for Last Hour
    (`main.js:258-262`). Its `hideLoader=true` keeps the current figures visible
    while that request is in flight. A chained timeout gives the same visible
    behaviour without allowing a slow request to overlap the next one. Unlike
    upstream, it pauses while the tab is hidden (`onVisibility` below).
    */
    async function load(showLoader: boolean) {
      if (showLoader) setLoading(true)
      const r = await getDashboardStats(token, range, requested ?? undefined, node)
      if (cancelled) return
      if (r.kind === 'ok') {
        /*
        The previous period is a second read of the same endpoint, with
        `type=Custom` and the instants `previousQuery` works out from this answer's
        own labels, so it follows the server's clock and not the browser's.
        A first answer is drawn at once and its changes follow; a minute reload
        waits for both, so the changes never blink out and back every minute.
        */
        const query = previousQuery(windowOf(r.data.mainChartData))
        const ask = async () => {
          if (query == null) return null
          const p = await getDashboardStats(token, 'Custom', { start: query.start, end: query.end }, node)
          return p.kind === 'ok' ? { for: r.data, range, node, query, data: p.data } : null
        }
        if (showLoader) {
          setLoading(false)
          setData(r.data)
          setFailure(false)
          setPrev(null)
          const p = await ask()
          if (cancelled) return
          setPrev(p)
        } else {
          const p = await ask()
          if (cancelled) return
          setLoading(false)
          setData(r.data)
          setFailure(false)
          setPrev(p)
        }
      } else {
        setLoading(false)
        setPrev(null)
        /*
        A failure is NOT drawn as a quiet server. Without this, the eleven tiles
        came out at zero and the panels said "No queries for this period.", which is
        exactly what a DNS that has received nothing shows: the screen was answering
        falsely about the one thing people come here to look at.
        */
        setData(null)
        setFailure(true)
        setNotice(noticeFromFailure(r))
      }

      if (range === 'LastHour' && !document.hidden) {
        refreshTimer = window.setTimeout(() => void load(false), LAST_HOUR_REFRESH_MS)
      }
    }

    /*
    A tab out of sight does not refresh (this console's, with the live Last
    Hour, deviation 5): the timer stops when it hides, and coming back reloads at
    once, which also gives the live figures a fresh baseline.
    */
    function onVisibility() {
      if (range !== 'LastHour') return
      if (document.hidden) {
        if (refreshTimer != null) window.clearTimeout(refreshTimer)
        refreshTimer = undefined
      } else {
        void load(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    void load(true)
    return () => {
      cancelled = true
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [token, range, requested, node])

  /*
  Last Hour in real time (`live.ts`, `useLive.ts`): between reloads the ten
  count tiles, the Queries chart and the Query Response Types doughnut move with
  the server's lifetime counters. Every result of `stats/get` is a new baseline.
  The aggregate is read node by node; a single server or a chosen node, alone.
  */
  const view = useLiveView({
    token,
    lastHour: range === 'LastHour',
    node,
    nodes,
    clusterInitialised,
    data,
    active: !failure,
  })

  /*
  The range message goes NEXT TO ITS FIELD, not to the notice at the top.

  It is a design rule (the validation error goes next to its field, and never in
  two places at once), and until now it came out in the `Notifier`, half a screen
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

  const s = view?.stats
  const total = s?.totalQueries ?? 0

  /* Each figure's change, only for the response on screen (see `prev`). */
  const settled = !loading && data != null && view != null && prev != null &&
    prev.for === data && prev.range === range && prev.node === node
  const shift = useMemo(
    () => (settled && data != null && view != null && prev != null ? changes(data, view, prev.data, prev.query) : null),
    [settled, data, view, prev],
  )
  const against = settled && prev != null ? previousLabel(prev.query.window, prev.range) : ''

  /*
  The charts' jumps to Query Logs (deviation 6, `jump.ts`): through the Shell, as
  the row menus' "Show Query Logs", with the node this screen reads. A chart only
  takes the click when Query Logs is there to land on.
  */
  const handoff = useHandoff()
  const canJump = handoff != null && handoff.canShowQueryLogs !== false
  const shown = useMemo(() => windowOf(view?.mainChartData), [view])
  const jump = (filters: QueryLogsFilters) => handoff?.showQueryLogs(null, null, node, filters)
  const pickPoint = canJump && shown != null
    ? (i: number) => {
        const span = bucketWindow(view?.mainChartData, i)
        if (span != null) jump(span)
      }
    : undefined
  const byValue = (field: 'responseType' | 'protocol' | 'qtype', value: (label: string) => string | null) =>
    canJump && shown != null
      ? (label: string) => {
          const v = value(label)
          return v != null ? () => jump({ ...periodFilters(shown), [field]: v }) : undefined
        }
      : undefined
  const responseJump = byValue('responseType', responseTypeFilter)
  const typeJump = byValue('qtype', queryTypeFilter)
  const protocolJump = byValue('protocol', protocolFilter)

  return (
    <>
      <SectionHeader title="Dashboard" />

      {/*
      The period bar goes UNDER the title and to the left, which is where the
      accepted drawing puts it. It was built into the header's `actions`, which
      pushes it to the right-hand end of the title row: that reads as "an action on
      this screen" (like `Add Zone` or `Flush Cache`) and it is not one. It
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
        {/* What every arrow on the cards is measured against (deviation 6). Our
            words, and only while there are changes to read. */}
        {shift != null && Object.keys(shift).length > 0 && (
          <span className={styles.against}>Change vs {against}</span>
        )}
      </div>

      {range === 'Custom' && (
        <div className={styles.ownRange}>
          <label>
            Start
            <input
              type="date"
              value={start}
              aria-invalid={missingRange === MSG_START || undefined}
              onChange={(e) => setStart(e.target.value)}
            />
            {missingRange === MSG_START && <span className={styles.badRange}>{missingRange}</span>}
          </label>
          <label>
            End
            <input
              type="date"
              value={end}
              aria-invalid={missingRange === MSG_END || undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
            {missingRange === MSG_END && <span className={styles.badRange}>{missingRange}</span>}
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

      It draws nothing when there is no cluster (`ClusterNodeSelect` returns `null`
      without `clusterInitialized`), so on a single-server install the slot stays
      empty and takes up nothing.
      */}
      <InChrome>
        <ClusterNodeSelect
          nodes={nodes}
          initialised={clusterInitialised}
          aggregate
          value={node}
          onChange={setNode}
        />
      </InChrome>

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {/*
      `data-testid="metrics"` wraps all eleven and not each group: it is the hook
      the tests count them with (`Dashboard.test.tsx`), and eleven cards split
      across two bands are still eleven cards. Why four are larger and how the
      seven are grouped is in `Figures.tsx`.
      */}
      <div className={styles.tiles} data-testid="metrics">
        <div className={styles.keys}>
          {KEYS.map((m) => (
            <StatCard
              key={m.k}
              m={m}
              s={s}
              total={total}
              changes={shift}
              against={against}
              chart={view?.mainChartData}
              isKey
            />
          ))}
        </div>
        <div className={styles.details}>
          {FAMILIES.map((family, i) => (
            <div className={styles.family} key={i} style={{ ['--n' as string]: String(family.length) }}>
              {family.map((m) => (
                <StatCard key={m.k} m={m} s={s} total={total} changes={shift} against={against} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/*
      The lower half, as the accepted drawing has it: `Queries` with `Server`
      beside it, then the three doughnuts in a row, then the three top-N lists in
      another.

      It was built as a 310 px right rail holding `Server`, the three doughnuts
      and `Top Clients` stacked, with only two panels on the left. Nothing recorded
      the change and nothing fixed the layout, so it was not a decision;
      it was a drift. What it cost is visible at 1440: the doughnuts had 310 px
      to live in, so they came out as a huge centred ring with the legend
      underneath, `Server` lost its third column, `Top Clients` left the group it
      belongs to, and half the canvas below was empty.

      `Server` is back to two columns in the rail since issue #2, for the width of
      its figures and not for the doughnuts: see `.counters`.
      */}
      <div className={styles.grid}>
        <Panel title="Queries" className={styles.panel}>
          <Body>
            {loading && <Loading compact />}
            {!loading && view && hasData(view.mainChartData) && (
              <Line data={view.mainChartData} resetOn={data?.mainChartData} onPick={pickPoint} />
            )}
            {!loading && (!view || !hasData(view.mainChartData)) && (
              <Placeholder failure={failure} empty="No queries for this period." />
            )}
          </Body>
        </Panel>

        <Panel title="Server" className={styles.panel}>
          <Body>
            <div className={styles.counters} data-testid="counters">
              {COUNTERS.map((c) => (
                <div className={styles.cnt} key={c.k}>
                  <Figure className={styles.v} text={s ? num2(s[c.k]) : '—'} />
                  <div className={styles.k}>{c.label}</div>
                </div>
              ))}
            </div>
          </Body>
        </Panel>
      </div>

      {view && (
        <div className={styles.trio}>
          <Split
            title="Query Response Types"
            data={view.queryResponseChartData}
            resetOn={data?.queryResponseChartData}
            failure={failure}
            onPick={responseJump != null ? (label) => responseJump(label)?.() : undefined}
            pickable={responseJump != null ? (label) => responseJump(label) != null : undefined}
          />
          <Bars title="Query Types" data={view.queryTypeChartData} failure={failure} colour="--ch-1" jump={typeJump} />
          <Bars title="Protocol Types" data={view.protocolTypeChartData} failure={failure} colour="--ch-1" jump={protocolJump} />
        </div>
      )}

      <div className={styles.trio}>
        <Top
          title="Top Domains"
          tone="--ch-total"
          rows={view?.topDomains ?? []}
          onMore={() => setTop('TopDomains')}
          failure={failure}
          menu={(f) => <TopRowMenu kind="TopDomains" name={f.name} node={node} action={action} />}
        />
        <Top
          title="Top Blocked Domains"
          tone="--ch-block"
          rows={view?.topBlockedDomains ?? []}
          onMore={() => setTop('TopBlockedDomains')}
          failure={failure}
          beforeMore={<BlockingMenu token={token} onNotice={setNotice} />}
          menu={(f) => <TopRowMenu kind="TopBlockedDomains" name={f.name} node={node} action={action} />}
        />
        <Top
          title="Top Clients"
          tone="--ch-clients"
          rows={view?.topClients ?? []}
          isClient
          onMore={() => setTop('TopClients')}
          failure={failure}
          menu={(f) => <TopRowMenu kind="TopClients" name={f.name} node={node} action={action} />}
        />
      </div>

      <TopStats type={top} range={range} token={token} node={node} onClose={() => setTop(null)} />
    </>
  )
}
