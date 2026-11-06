import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  getDashboardStats, RANGES, RANGE_LABEL,
  type ChartData, type DashboardStats, type Range,
} from '../../api/dashboard'
import { percentage, hasData, Legend, useHidden } from '../dashboard/Dashboard'
import { Chart } from '../dashboard/Chart'
import { Change } from '../dashboard/Figures'
import { changes, previousLabel, previousQuery, windowOf, type Changes, type PreviousQuery } from '../dashboard/compare'
import { InChrome } from '../../app/ChromeSlot'
import { ClusterNodeSelect, AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { SectionHeader } from '../../ui/SectionHeader'
import { Segmented } from '../../ui/Segmented'
import { Panel, Body } from '../../ui/Panel'
import { Card, StackBar, statStyles } from '../../ui/StatCard'
import { useCountUp } from '../../ui/useCountUp'
import { Empty, Loading, Failure } from '../../ui/Empty'
import { Notifier } from '../../ui/Notifier'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { StaleData } from '../StaleData'
import { AddDomainBar } from './AddDomainBar'
import { BlockingStatus } from './BlockingStatus'
import { BlockedBy } from './BlockedBy'
import { useLoggingApp } from './logging-app'
import { TopTable } from './TopTable'
import { RecentBlocked } from './RecentBlocked'
import { LAST_HOUR_REFRESH_MS, useLiveView } from '../dashboard/useLive'
import { Locked } from './Locked'
import { missing, type Permissions } from './permissions'
import shared from './Blocking.module.css'
import styles from './Overview.module.css'

/*
The Overview tab: what blocking is doing at a glance, built from what Technitium
already sends. The figures, the changes and the bars come from `dashboard/stats/get`,
the Dashboard's own call, and they share its node memory (`dashboardClusterNode`):
same data, so choosing a node here and seeing another there would be a contradiction.

The five fixed periods and not Custom: a range of your own is the Dashboard's job.

LAID OUT ON 2026-11-06, top to bottom: the header with the blocking status and its
menu beside the period (`BlockingStatus.tsx`); the check, block or allow command bar
(`AddDomainBar.tsx`); the strip of four figures; Queries over time with Blocked by
client beside it (`BlockedBy.tsx`, read from `logs/query`); the two top tables; and
Recently Blocked. The "Blocked share" ring that sat beside the chart said the strip's
percentage a second time and is gone.

The words are OURS except `Total Queries` and `Blocked`, upstream's Dashboard tiles:
the title `Overview` and its subtitle (`OVERVIEW_SUBTITLE`), `Period`, `Block List Domains`, `Your Rules` and its `Blocked` and
`Allowed`, the `of total` after Blocked's share, the strip's two bars' `Blocked N, Allowed M`, the panel titles (`Statistics`, `Queries over time`), the
`Allowed` series and the chart's label. The changes against the previous period
(`▲ N%`, `vs previous hour` and the rest) are the Dashboard's (deviation 7,
`dashboard/Figures.tsx`), here on Total Queries and Blocked only.
The two gap sentences are the ones this console's Dashboard already uses.
*/

/** The previous period, asked for one answer of the period on screen. */
interface Previous {
  for: DashboardStats
  query: PreviousQuery
  data: DashboardStats
}

/** What the tab is for, under its title. OURS (CONVENTIONS.md, deviation 2). */
export const OVERVIEW_SUBTITLE = 'How much is blocked and which domains, over the period you pick, and whether blocking is on.'

type Period = Exclude<Range, 'Custom'>

const PERIODS = RANGES.filter((r): r is Period => r !== 'Custom')

function series(main: ChartData, label: string): number[] {
  return main.datasets.find((d) => d.label === label)?.data.map(Number) ?? []
}

/**
 * The stacked bars: what got through (Total − Blocked) and what was blocked. Blocked
 * goes FIRST because Chart.js stacks in dataset order from the axis up: on the
 * baseline, as drawn, its own series reads off a common zero. The legend still reads
 * "Allowed, Blocked" (`BAR_LEGEND`).
 */
export function blockingChart(main: ChartData): ChartData {
  const total = series(main, 'Total')
  const blocked = series(main, 'Blocked')
  return {
    labels: main.labels,
    datasets: [
      { label: 'Blocked', data: blocked },
      { label: 'Allowed', data: total.map((t, i) => t - (blocked[i] ?? 0)) },
    ],
  }
}

const BAR_LEGEND = ['Allowed', 'Blocked'] as const

/*
The bars with the Dashboard's own legend (`Legend`, `useHidden`): in HTML above the
canvas, each series with its total for the period, a click switching it off and a
switched-off one dimmed. Chart.js's stock legend, centred inside the canvas, said the
same two names without their figures, so the same kind of chart read two ways on two
screens. Design only: the series, their names and their order are the ones the
stock legend showed (`BAR_LEGEND`), and switching one off still hides it.

The switches reset with each answer of the server (`resetOn`), as the Dashboard's
do, and not with the live figures laid over it every 2 seconds.
*/
function Bars({ chart, resetOn }: { chart: ChartData; resetOn: unknown }) {
  const { hidden, toggle } = useHidden(resetOn)
  const entries = BAR_LEGEND.map((label) => ({
    label,
    datum: series(chart, label).reduce((a, n) => a + (Number.isFinite(n) ? n : 0), 0).toLocaleString(),
  }))
  return (
    <>
      <Legend entries={entries} hidden={hidden} onToggle={toggle} />
      <Chart
        type="bar"
        data={chart}
        legendOrder={BAR_LEGEND}
        separateLegend
        hidden={hidden}
        aria="Allowed and blocked queries over time"
      />
    </>
  )
}

/* A figure of the strip, counting up once as its card comes in (`ui/useCountUp`),
   in the reader's own digit grouping as the stock tiles write it. Before the first
   answer it is upstream's "no value". */
function Figure({ value }: { value: number | undefined }) {
  return <div className={statStyles.figure}>{value == null ? '—' : <Grouped value={value} />}</div>
}

function Grouped({ value }: { value: number }) {
  return <>{useCountUp(value).toLocaleString()}</>
}

/*
WHAT BLOCKING IS DOING, AT A GLANCE (2026-11-06): the four figures as one strip of
`ui/StatCard` cells, the strip every list screen opens with (Cache, Zones, Apps,
Administration), in the series colours the charts below use. Blocked carries its
share of the period and the bar of how the period split (Blocked against what got
through, the bars' own two series); Your Rules carries how many rules there are
(the server's two counts added), each count, and the same kind of bar. The trends that sat beside Total Queries and Blocked are gone: the
chart under the strip draws the same series over the same period, larger.

Total Queries and Blocked also carry their change against the previous period of the
same length, as the Dashboard's cards do (deviation 7): what it is measured against
said once, in Total Queries (`vs previous hour`), the arrow and the size alone in
Blocked. Nothing is drawn when the change is not exact and current (`changes`).
*/
function Strip({ s, shift, against }: { s: DashboardStats['stats'] | undefined; shift: Changes | null; against: string }) {
  const allowed = s == null ? 0 : s.totalQueries - s.totalBlocked
  return (
    <div className={`${statStyles.grid} ${shared.inStack} ${styles.strip}`}>
      <Card title="Total Queries" colour="var(--ch-total)">
        <div className={statStyles.body}>
          <Figure value={s?.totalQueries} />
          {s != null && shift?.totalQueries != null && (
            <div className={statStyles.caption}>
              <Change ratio={shift.totalQueries} against={against} long />
            </div>
          )}
        </div>
      </Card>
      <Card title="Blocked" colour="var(--ch-block)">
        <div className={statStyles.body}>
          <Figure value={s?.totalBlocked} />
          {s != null && (
            <div className={statStyles.caption}>
              <span>{`${percentage(s.totalBlocked, s.totalQueries)} of total`}</span>
              <Change ratio={shift?.totalBlocked} against={against} />
            </div>
          )}
          {s != null && (
            <StackBar
              label={`Blocked ${s.totalBlocked.toLocaleString()}, Allowed ${allowed.toLocaleString()}`}
              parts={[
                { key: 'Blocked', name: 'Blocked', value: s.totalBlocked, colour: 'var(--ch-block)' },
                { key: 'Allowed', name: 'Allowed', value: allowed, colour: 'var(--ch-ok)' },
              ]}
            />
          )}
        </div>
      </Card>
      <Card title="Block List Domains" colour="var(--ch-drop)">
        <div className={statStyles.body}>
          <Figure value={s?.blockListZones} />
        </div>
      </Card>
      <Card title="Your Rules" colour="var(--ch-ok)">
        <div className={statStyles.body}>
          <Figure value={s == null ? undefined : s.blockedZones + s.allowedZones} />
          <dl className={statStyles.facts} aria-label="Your Rules">
            <div>
              <dt>Blocked</dt>
              <dd>{s == null ? '—' : <Grouped value={s.blockedZones} />}</dd>
            </div>
            <div>
              <dt>Allowed</dt>
              <dd>{s == null ? '—' : <Grouped value={s.allowedZones} />}</dd>
            </div>
          </dl>
          {s != null && (
            <StackBar
              label={`Blocked ${s.blockedZones.toLocaleString()}, Allowed ${s.allowedZones.toLocaleString()}`}
              parts={[
                { key: 'Blocked', name: 'Blocked', value: s.blockedZones, colour: 'var(--ch-block)' },
                { key: 'Allowed', name: 'Allowed', value: s.allowedZones, colour: 'var(--ch-ok)' },
              ]}
            />
          )}
        </div>
      </Card>
    </div>
  )
}

/*
A chart's gap before or without data, as the Dashboard draws it (`Placeholder`): the
detail of a failure travels once, in the notice at the top, and each panel says the
same short sentence. A period with no queries is the dashed empty state, not an empty
canvas.
*/
function Gap({ failure, loading, announce = true }: { failure: boolean; loading: boolean; announce?: boolean }) {
  if (failure) return <Failure>Could not load this data.</Failure>
  if (loading) return <Loading compact announce={announce} />
  return <Empty compact>No queries for this period.</Empty>
}

export function Overview({
  tabs,
  token,
  permissions,
  nodes = [],
  clusterInitialised = false,
  serverDomain,
}: {
  tabs?: ReactNode
  token: string | null
  permissions: Permissions
  nodes?: ClusterNode[]
  clusterInitialised?: boolean
  serverDomain?: string
}) {
  const statsNeed = missing(permissions, 'Dashboard.canView')
  const [range, setRange] = useState<Period>('LastHour')
  const [node, setNode] = useState<string>(() => localStorage.getItem('dashboardClusterNode') || AGGREGATE)
  const [data, setData] = useState<DashboardStats | null>(null)
  /** The first read of this period and node failed: there is nothing to show. */
  const [failure, setFailure] = useState(false)
  /** A later read failed: what is on screen is the last good data, and says so. */
  const [stale, setStale] = useState(false)
  const [lastGood, setLastGood] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  /** The previous period of the answer on screen, for the strip's changes. */
  const [prev, setPrev] = useState<Previous | null>(null)
  const logsNeed = missing(permissions, 'Logs.canView')
  const app = useLoggingApp(token, logsNeed == null)

  /*
  Read through refs, not state, for the reason Lists.tsx gives: as a dependency of
  `load`, every good read would make a new `load` and the effect below would ask
  again. `asked` numbers the reads so a slow answer to an earlier period cannot land
  over a later one.
  */
  const hadData = useRef(false)
  const asked = useRef(0)

  useEffect(() => {
    localStorage.setItem('dashboardClusterNode', node)
  }, [node])

  const load = useCallback(async () => {
    if (statsNeed != null) return
    const mine = ++asked.current
    const r = await getDashboardStats(token, range, undefined, node)
    if (mine !== asked.current) return
    if (r.kind === 'ok') {
      /*
      The previous period, for the strip's two changes: the Dashboard's second read
      (deviation 7, `dashboard/compare.ts`), `type=Custom` with the instants worked
      out from this answer's own labels. A first answer is drawn at once and its
      changes follow; a reload waits for both, so the changes never blink.
      */
      const query = previousQuery(windowOf(r.data.mainChartData))
      const ask = async (): Promise<Previous | null> => {
        if (query == null) return null
        const p = await getDashboardStats(token, 'Custom', { start: query.start, end: query.end }, node)
        return p.kind === 'ok' ? { for: r.data, query, data: p.data } : null
      }
      const show = (p: Previous | null) => {
        setData(r.data)
        setPrev(p)
        setFailure(false)
        setStale(false)
        setLastGood(new Date().toISOString())
        hadData.current = true
      }
      if (!hadData.current) {
        show(null)
        const p = await ask()
        if (mine === asked.current) setPrev(p)
      } else {
        const p = await ask()
        if (mine === asked.current) show(p)
      }
      return
    }
    /*
    The split of Zones and Lists: with earlier data the stale strip reports the
    failure, saying since when and offering a retry, and the notice keeps quiet so
    the same failure is not said twice; with none, the notice carries the server's
    message.
    */
    if (hadData.current) setStale(true)
    else {
      setFailure(true)
      setNotice(noticeFromFailure(r))
    }
  }, [token, range, node, statsNeed])

  /*
  A new period or node is a new question. What is on screen answers the previous one,
  so it goes: kept, Last Hour's figures would sit under "Last Day" looking current.
  */
  useEffect(() => {
    hadData.current = false
    setData(null)
    setPrev(null)
    setFailure(false)
    setStale(false)
    void load()
  }, [load])

  /*
  Last Hour keeps itself current, as the Dashboard does: read again a minute after
  each answer, never two at once, nothing while the tab is hidden, and at once when
  it comes back. In between, the live figures below move the counts, the bars and
  the ring every 2 seconds (`dashboard/useLive.ts`).
  */
  useEffect(() => {
    if (range !== 'LastHour' || statsNeed != null) return
    let cancelled = false
    let timer: number | undefined
    const arm = () => {
      if (!cancelled && !document.hidden) timer = window.setTimeout(() => void again(), LAST_HOUR_REFRESH_MS)
    }
    async function again() {
      await load()
      arm()
    }
    function onVisibility() {
      if (timer != null) window.clearTimeout(timer)
      timer = undefined
      if (!document.hidden) void again()
    }
    arm()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [range, load, statsNeed])

  const view = useLiveView({
    token,
    lastHour: range === 'LastHour',
    node,
    nodes,
    clusterInitialised,
    data,
    active: !failure && statsNeed == null,
  })

  const s = view?.stats
  /*
  Memoised on the response: Chart.tsx destroys and rebuilds its canvas on every new
  `data` reference, so a notice or any other render would otherwise redraw and
  re-animate the chart with the same numbers.
  */
  const chart = useMemo(() => (view != null ? blockingChart(view.mainChartData) : null), [view])
  const loading = data == null && !failure

  /* Each change only for the answer on screen, as the Dashboard draws its own. */
  const settled = data != null && view != null && prev != null && prev.for === data
  const shift = useMemo(
    () => (settled && data != null && view != null && prev != null ? changes(data, view, prev.data, prev.query) : null),
    [settled, data, view, prev],
  )
  const against = settled && prev != null ? previousLabel(prev.query.window, range) : ''

  const aggregate = clusterInitialised && node === AGGREGATE
  /* Without a query logs app the card is not drawn: Recently Blocked says why, once. */
  const side = logsNeed != null
    ? <Locked title="Blocked by client" need={logsNeed} />
    : app.kind === 'none'
      ? null
      : (
          <BlockedBy
            token={token}
            app={app}
            node={node}
            aggregate={aggregate}
            serverDomain={serverDomain}
            names={data?.topClients ?? []}
            refreshOn={data}
          />
        )

  return (
    <>
      <InChrome>
        <ClusterNodeSelect
          nodes={nodes}
          initialised={clusterInitialised}
          aggregate
          value={node}
          onChange={setNode}
        />
      </InChrome>

      <SectionHeader
        section="Blocking"
        title="Overview"
        subtitle={OVERVIEW_SUBTITLE}
        tabs={tabs}
        actions={
          <div className={styles.headActions}>
            <BlockingStatus token={token} permissions={permissions} onNotice={setNotice} />
            <Segmented
              label="Period"
              live="LastHour"
              compact
              options={PERIODS.map((r) => ({ id: r, label: RANGE_LABEL[r] }))}
              active={range}
              onChoose={setRange}
            />
          </div>
        }
      />
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={shared.stack}>
        {stale && <StaleData since={lastGood} onRetry={() => void load()} />}

        <AddDomainBar
          token={token}
          permissions={permissions}
          onNotice={setNotice}
          onChanged={() => void load()}
        />

        {statsNeed != null ? (
          <Locked title="Statistics" need={statsNeed} />
        ) : (
          <Strip s={s} shift={shift} against={against} />
        )}

        {/* Without Dashboard.View every panel fed by the stats keeps its place and its
            title, locked: the screen does not change shape with who looks. */}
        <div className={side != null ? `${shared.row21} ${styles.chartRow}` : undefined}>
          {statsNeed != null ? (
            <Locked title="Queries over time" need={statsNeed} />
          ) : (
            <Panel title="Queries over time">
              <Body>
                {chart && hasData(chart) ? (
                  <Bars chart={chart} resetOn={data} />
                ) : (
                  <Gap failure={failure} loading={loading} />
                )}
              </Body>
            </Panel>
          )}
          {side}
        </div>

        {statsNeed != null ? (
          <div className={shared.row2}>
            <Locked title="Top Blocked Domains" need={statsNeed} />
            <Locked title="Top Domains" need={statsNeed} />
          </div>
        ) : (
          <div className={shared.row2}>
            <TopTable
              kind="TopBlockedDomains"
              rows={data?.topBlockedDomains ?? []}
              range={range}
              token={token}
              permissions={permissions}
              failure={data == null}
              onNotice={setNotice}
              onChanged={() => void load()}
            />
            <TopTable
              kind="TopDomains"
              rows={data?.topDomains ?? []}
              range={range}
              token={token}
              permissions={permissions}
              failure={data == null}
              onNotice={setNotice}
              onChanged={() => void load()}
            />
          </div>
        )}

        <RecentBlocked
          token={token}
          permissions={permissions}
          node={node}
          aggregate={aggregate}
          serverDomain={serverDomain}
          refreshOn={s?.totalBlocked}
        />
      </div>
    </>
  )
}
