import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  getDashboardStats, RANGES, RANGE_LABEL,
  type ChartData, type DashboardStats, type Range,
} from '../../api/dashboard'
import { percentage, hasData } from '../dashboard/Dashboard'
import { Chart } from '../dashboard/Chart'
import { InChrome } from '../../app/ChromeSlot'
import { ClusterNodeSelect, AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { SectionHeader } from '../../ui/SectionHeader'
import { Segmented } from '../../ui/Segmented'
import { Panel, Body } from '../../ui/Panel'
import { Empty, Loading, Failure } from '../../ui/Empty'
import { Notifier } from '../../ui/Notifier'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { StaleData } from '../StaleData'
import { AddDomainBar } from './AddDomainBar'
import { StatusPanel } from './StatusPanel'
import { TopTable } from './TopTable'
import { RecentBlocked } from './RecentBlocked'
import { Locked } from './Locked'
import { missing, type Permissions } from './permissions'
import shared from './Blocking.module.css'
import styles from './Overview.module.css'

/*
The Overview tab: what blocking is doing at a glance, built from what Technitium
already sends. The figures, the bars and the ring come from `dashboard/stats/get`, the
Dashboard's own call, and they share its node memory (`dashboardClusterNode`): same
data, so choosing a node here and seeing another there would be a contradiction.

The five fixed periods and not Custom: a range of your own is the Dashboard's job.

The words are OURS except `Total Queries` and `Blocked`, upstream's Dashboard tiles:
the title `Overview`, `Period`, `Block List Domains`, `Your Rules` and its `blocked ·
allowed`, the `of total` after Blocked's share, the panel titles (`Statistics`, `Queries over time`, `Blocked share`), the
`Allowed` series, the ring's `Share` and `Blocked share: N%`, and the chart's label.
The two gap sentences are the ones this console's Dashboard already uses.
*/

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

/* A figure's trend, beside it: decorative, so hidden from assistive technology (the
   figure says the number). */
function Spark({ data, tone }: { data: number[]; tone: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const step = 100 / (data.length - 1)
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(30 - (v / max) * 28).toFixed(2)}`).join(' ')
  return (
    <svg className={`${styles.spark} ${tone}`} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,32 ${points} 100,32`} fill="currentColor" fillOpacity="0.18" stroke="none" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Kpi({ value, sub, label, children }: { value: string; sub?: string; label: string; children?: ReactNode }) {
  return (
    <Panel className={shared.centred}>
      <Body>
        <div className={`${shared.kpi}${children != null ? ` ${styles.trended}` : ''}`}>
          <div className={shared.kpiText}>
            <span className={shared.kpiValue}>{value}</span>
            {/* A figure without a sub-line keeps an empty one, a full line high, so the four
                labels sit on one line as the drawing has them. */}
            <span className={shared.kpiSub}>{sub ?? '\u00a0'}</span>
            <span className={shared.kpiLabel}>{label}</span>
          </div>
          {children}
        </div>
      </Body>
    </Panel>
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
      setData(r.data)
      setFailure(false)
      setStale(false)
      setLastGood(new Date().toISOString())
      hadData.current = true
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
    setFailure(false)
    setStale(false)
    void load()
  }, [load])

  const s = data?.stats
  /*
  Memoised on the response: Chart.tsx destroys and rebuilds its canvas on every new
  `data` reference, so a notice or any other render would otherwise redraw and
  re-animate both charts with the same numbers.
  */
  const chart = useMemo(() => (data != null ? blockingChart(data.mainChartData) : null), [data])
  const share = useMemo<ChartData | null>(
    () =>
      data != null
        ? {
            /* Blocked first: the ring starts at the top with it, as drawn and as the
               bars stack it on the baseline. */
            labels: ['Blocked', 'Allowed'],
            datasets: [{ label: 'Share', data: [data.stats.totalBlocked, data.stats.totalQueries - data.stats.totalBlocked] }],
          }
        : null,
    [data],
  )
  const loading = data == null && !failure

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
        tabs={tabs}
        actions={
          <Segmented
            label="Period"
            options={PERIODS.map((r) => ({ id: r, label: RANGE_LABEL[r] }))}
            active={range}
            onChoose={setRange}
          />
        }
      />
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={shared.stack}>
        {stale && <StaleData since={lastGood} onRetry={() => void load()} />}

        {statsNeed != null ? (
          <Locked title="Statistics" need={statsNeed} />
        ) : (
          <div className={shared.kpis}>
            <Kpi value={s ? s.totalQueries.toLocaleString() : '—'} label="Total Queries">
              {data && <Spark data={series(data.mainChartData, 'Total')} tone={styles.sparkTotal} />}
            </Kpi>
            <Kpi
              value={s ? s.totalBlocked.toLocaleString() : '—'}
              sub={s ? `${percentage(s.totalBlocked, s.totalQueries)} of total` : undefined}
              label="Blocked"
            >
              {data && <Spark data={series(data.mainChartData, 'Blocked')} tone={styles.sparkBlocked} />}
            </Kpi>
            <Kpi value={s ? s.blockListZones.toLocaleString() : '—'} label="Block List Domains" />
            <Kpi
              value={s ? `${s.blockedZones.toLocaleString()} · ${s.allowedZones.toLocaleString()}` : '—'}
              sub="blocked · allowed"
              label="Your Rules"
            />
          </div>
        )}

        <div className={shared.row2}>
          <StatusPanel token={token} permissions={permissions} onNotice={setNotice} />
          <AddDomainBar
            token={token}
            permissions={permissions}
            onNotice={setNotice}
            onChanged={() => void load()}
          />
        </div>

        {/* Without Dashboard.View every panel fed by the stats keeps its place and its
            title, locked: the screen
            does not change shape with who looks. */}
        {statsNeed != null ? (
          <div className={shared.row21}>
            <Locked title="Queries over time" need={statsNeed} />
            <Locked title="Blocked share" need={statsNeed} />
          </div>
        ) : (
          <div className={shared.row21}>
            <Panel title="Queries over time">
              <Body>
                {chart && hasData(chart) ? (
                  <Chart type="bar" data={chart} legendOrder={BAR_LEGEND} aria="Allowed and blocked queries over time" />
                ) : (
                  <Gap failure={failure} loading={loading} />
                )}
              </Body>
            </Panel>
            <Panel title="Blocked share">
              <Body>
                {s && share && s.totalQueries > 0 ? (
                  /* No legend: the hole says which share it is, and Chart.js's own
                     would be a second one inside the canvas. The figure is laid over
                     the canvas box, whose centre is the ring's. */
                  <div className={styles.ring}>
                    <Chart
                      type="doughnut"
                      height={180}
                      separateLegend
                      data={share}
                      aria={`Blocked share: ${percentage(s.totalBlocked, s.totalQueries)}`}
                    />
                    <span className={styles.ringValue} aria-hidden="true">
                      {percentage(s.totalBlocked, s.totalQueries)}
                      <span className={styles.ringLabel}>Blocked</span>
                    </span>
                  </div>
                ) : (
                  <Gap failure={failure} loading={loading} announce={false} />
                )}
              </Body>
            </Panel>
          </div>
        )}

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
          aggregate={clusterInitialised && node === AGGREGATE}
          serverDomain={serverDomain}
        />
      </div>
    </>
  )
}
