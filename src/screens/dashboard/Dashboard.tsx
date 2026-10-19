import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RANGE_LABEL, RANGES, getDashboardStats,
  type DashboardStats, type Range, type Stats, type TopKind,
} from '../../api/dashboard'
import { useHandoff, type QueryLogsFilters } from '../../app/handoff'
import { bucketsOf, changes, previousLabel, previousQuery, windowOf, type PreviousQuery } from './compare'
import { Figure, StatCard } from './Figures'
import { FIGURES, TOTAL, num2, percentage, type Metric } from './metrics'
import { Line, Placeholder, Top, hasData } from './Panels'
import { Breakdown } from './Breakdown'
import { Heatmap } from './Heatmap'
import {
  bucketWindow, periodFilters, protocolFilter, queryTypeFilter, responseTypeFilter,
} from './jump'
import { ClusterNodeSelect, AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { InChrome } from '../../app/ChromeSlot'
import { TopStats } from './TopStats'
import { TopRowMenu } from './TopRowMenu'
import { useDomainAction } from '../../lib/allow-block'
import { SectionHeader } from '../../ui/SectionHeader'
import { Loading } from '../../ui/Empty'
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

const thisHour = () => Math.floor(Date.now() / 3_600_000) * 3_600_000

/* Blocking › Overview reads these from here: the figures' format, and the Queries legend its bars share. */
export { percentage }
export { hasData, Legend, useHidden } from './Panels'

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
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  /*
  The previous period, for each figure's change (deviation 7, `compare.ts`). It
  belongs to ONE response: `for` is the response it was asked for, with its period
  and node, and the changes are drawn only while that response is the one on screen
  and nothing is loading. A new period or node still on its way, a failed read, a
  previous period that failed or that cannot be asked the same way: no change at all.
  */
  /* The hour in progress, for the week by hour: it asks again when this turns,
     which is checked at each answer, so a minute reload in the same hour asks
     nothing more. */
  const [hour, setHour] = useState(() => thisHour())
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
        setHour(thisHour())
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
  The charts' jumps to Query Logs (deviation 7, `jump.ts`): through the Shell, as
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
  /* The count cards' jump is upstream's (v15.6.2, logs.js:21-24): no node and no
     period, only the card's response code or type, so Query Logs keeps the node it
     had and its own empty `From`/`To`. */
  const cardJump = (m: Metric) =>
    canJump && m.open != null ? () => handoff?.showQueryLogs(null, null, null, m.open) : undefined
  const typeJump = byValue('qtype', queryTypeFilter)
  const protocolJump = byValue('protocol', protocolFilter)

  /* What a point of `Queries` opens: its minute, hour, day or month. The hint that
     says so in its header is our words (deviation 7), drawn only when it can land. */
  const unit = bucketsOf(view?.mainChartData)?.unit

  return (
    <>
      {/*
      The cockpit (Adrián's choice of 2026-10-15): everything a question needs fits
      in the first 1440 x 980 screen. The title with the period beside it; the
      eleven figures in one block; `Queries` with the week by hour and `Server`
      beside it; and the three top lists with the three breakdowns in one row.

      The period picker sits on the title's line, small, and not in the header's
      `actions`, which would push it to the far right where it reads as "an action
      on this screen" (like `Add Zone`). It reframes every figure below.
      */}
      <div className={styles.head}>
        <SectionHeader title="Dashboard" />
        <div className={styles.period}>
          <Segmented
            label="Period"
            compact
            options={RANGES.map((r) => ({ id: r, label: RANGE_LABEL[r] }))}
            active={range}
            onChoose={(r) => {
              setRange(r)
              if (r !== 'Custom') {
                setRequested(null)
                return
              }
              /* main.js:631-646: Custom focuses the date that is missing, or
                 reloads at once when both are already there. No message yet:
                 that comes with Show, or with a refresh (below). */
              if (start === '') window.setTimeout(() => startRef.current?.focus(), 0)
              else if (end === '') window.setTimeout(() => endRef.current?.focus(), 0)
              else setRequested(rangeInstants(start, end))
            }}
          />
        </div>
      </div>

      {range === 'Custom' && (
        <div className={styles.ownRange}>
          <label>
            Start
            <input
              ref={startRef}
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
              ref={endRef}
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
          onChange={(n) => {
            setNode(n)
            /* A node change is a `refreshDashboard()` (main.js:2398-2414): on
               Custom with a date missing it says which one, as Show does. */
            if (range === 'Custom') setMissingRange(whatIsMissing(start, end))
          }}
        />
      </InChrome>

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {/*
      `data-testid="metrics"` wraps all eleven: it is the hook the tests count them
      with (`Dashboard.test.tsx`). Why Total Queries is larger and the order of the
      other ten is in `Figures.tsx`.
      */}
      <div className={styles.tiles} data-testid="metrics">
        <StatCard
          m={TOTAL}
          s={s}
          total={total}
          changes={shift}
          against={against}
          chart={view?.mainChartData}
          hero
          onOpen={cardJump(TOTAL)}
        />
        {FIGURES.map((m) => (
          <StatCard
            key={m.k}
            m={m}
            s={s}
            total={total}
            changes={shift}
            against={against}
            chart={view?.mainChartData}
            onOpen={cardJump(m)}
          />
        ))}
      </div>

      <div className={styles.middle}>
        <Panel
          title="Queries"
          className={styles.queries}
          actions={pickPoint != null && unit != null
            ? <span className={styles.hint}>Click a point to open Query Logs for that {unit}</span>
            : undefined}
        >
          <Body>
            {loading && <Loading compact />}
            {!loading && view && hasData(view.mainChartData) && (
              <Line data={view.mainChartData} resetOn={data?.mainChartData} onPick={pickPoint} height={300} />
            )}
            {!loading && (!view || !hasData(view.mainChartData)) && (
              <Placeholder failure={failure} empty="No queries for this period." />
            )}
          </Body>
        </Panel>

        <div className={styles.side}>
          <Heatmap token={token} node={node} hour={hour} jump={canJump ? jump : undefined} />

          <Panel title="Server">
            <Body>
              <div className={styles.counters} data-testid="counters">
                {COUNTERS.map((c) => (
                  <div className={styles.cnt} key={c.k}>
                    <Figure className={styles.v} text={s ? num2(s[c.k]) : '\u2014'} />
                    <div className={styles.k}>{c.label}</div>
                  </div>
                ))}
              </div>
            </Body>
          </Panel>
        </div>
      </div>

      <div className={styles.lists}>
        <Top
          title="Top Clients"
          tone="--ch-clients"
          rows={view?.topClients ?? []}
          isClient
          onMore={() => setTop('TopClients')}
          failure={failure}
          menu={(f) => <TopRowMenu kind="TopClients" name={f.name} node={node} action={action} />}
        />
        <Top
          title="Top Domains"
          tone="--ch-ok"
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
        <Breakdown
          responses={view?.queryResponseChartData}
          responsesResetOn={data?.queryResponseChartData}
          queryTypes={view?.queryTypeChartData}
          protocols={view?.protocolTypeChartData}
          failure={failure}
          responseJump={responseJump}
          typeJump={typeJump}
          protocolJump={protocolJump}
        />
      </div>

      <TopStats type={top} range={range} token={token} node={node} onClose={() => setTop(null)} />
    </>
  )
}
