import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getDashboardStats, readTop, RANGES, RANGE_LABEL,
  type DashboardStats, type Range, type TopEntry,
} from '../../api/dashboard'
import { listLeases, type DhcpLease } from '../../api/dhcp'
import { readSettings, type DnsSettings } from '../../api/settings'
import { InChrome } from '../../app/ChromeSlot'
import { ClusterNodeSelect, AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { SectionHeader } from '../../ui/SectionHeader'
import { Segmented } from '../../ui/Segmented'
import { Card, StackBar, statStyles } from '../../ui/StatCard'
import { Icon } from '../../ui/Icon'
import { RouteLink } from '../../ui/RouteLink'
import { useCountUp } from '../../ui/useCountUp'
import { Notifier } from '../../ui/Notifier'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import { useMedia } from '../../lib/use-media'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { StaleData } from '../StaleData'
import { num2, percentage } from '../dashboard/metrics'
import { LAST_HOUR_REFRESH_MS } from '../dashboard/useLive'
import { SAMPLE } from '../blocking/blocked-sample'
import { useLoggingApp, type LoggingApp } from '../blocking/logging-app'
import { LockedBody } from '../blocking/Locked'
import { missing, requiresText, type Need, type Permissions } from '../blocking/permissions'
import { pageOf } from '../blocking/rules-model'
import {
  FILTERS, LIMIT, PER_PAGE, busiest, clientRows, filterCounts, label, leaseFor, matchesFilter,
  matchesSearch, readFilter, readSortBy, sortRows, summarise, type Filter, type SortBy,
} from './clients-model'
import { useQuerySample, type QuerySample } from './query-sample'
import { ClientCard } from './ClientCard'
import { ClientActions, type SettingsRead } from './ClientActions'
import { settingsNode } from './client-actions'
import { ClientList } from './ClientList'
import { WhoUses } from './WhoUses'
import styles from './Clients.module.css'

/*
CLIENTS (CONVENTIONS.md, deviation 25, Adrián's decisions of 2026-11-06). OURS as a
page: upstream has no such screen. It is Blocking › Overview's Blocked by client card
grown into a page, and it is built from the pieces that card and the Dashboard
already use: the same calls, the same query logs app, the same blocked classes, the
same row menus. It asks the server nothing upstream's console does not already ask:

  · `dashboard/stats/get` (the Dashboard's call) for the count of clients and the
    period's total of queries, which the shares are of;
  · `dashboard/stats/getTop` with `statsType=TopClients` and `limit=1000`, what
    upstream's "More" behind Top Clients sends (main.js:2939, index.html:336), for
    the list, one line per client, and the "Who uses your DNS" bar;
  · `apps/list` and `logs/query` (Query Logs' calls) for the log sample: the newest
    1,000 queries of every type (`SAMPLE`, the Blocked by client card's size), and
    for the open client the newest 500 of its own (`ClientCard.tsx`);
  · `dhcp/leases/list` (DHCP's call), only with `DhcpServer: View`, for the open
    client's lease, matched by address;
  · `settings/get` (Settings' call), only with `Settings: View`, for the two bypass
    lists the card's Actions show and change (`ClientActions.tsx`, which sends
    `settings/set` and DHCP's two conversions).

LAID OUT as master and detail. On a wide screen (above `--bp-wide`, 1180 px): the
header, the strip, the "Who uses your DNS" bar, then the list as a column at the
left and the open client's card at the right, the first client of the list open
when the bar names none. At 1180 and under: the list takes the width, and opening a
client shows its card instead, with `Clients ›` above its name to come back, as a
zone's page does.

The period is the Dashboard's five fixed ones, not Custom, with its node memory
(`dashboardClusterNode`), as Blocking › Overview. Last Hour reads again a minute
after each answer, never with a hidden tab: the clients do not move with the live
counters (deviation 5), so nothing here moves between those reloads.

What comes from the log is a sample, not the period, and every figure drawn from it
says so (`In the last N queries`). Logs belong to ONE node: with the cluster
aggregate the sample is the connected node's and says `on <node>`.

The view is in the address bar (`lib/url-state.ts`, written by replacing the entry,
dropped when the page goes): the search (`?q=`), the filter (`?filter=heavy|quiet`),
the order (`?sort=blocked|name`), the page (`?page=`, left out on 1) and the open
client (`?client=`); each default is left out.

Its words, all OURS save upstream's `Clients`, `Last Hour` and the other periods,
the Apps sentence (Recently Blocked's, from logs.js:391) and the `Requires X: Y` of
the padlock: the subtitle (`CLIENTS_SUBTITLE`), `Period`, `Most Active`, `Most
Blocked`, `Blocked Share`, `N queries, X% of total`, `N blocked in the last N
queries`, `In the last N queries` (and `In the last query`), `on <node>`, `The N
most active are listed`, `No queries for this period.` (the Dashboard's), `No
blocked queries.` (Recently Blocked's), `No query logging app` (Recently Blocked's),
`No queries.` (an empty sample), `Could not load this data.` (the Overview's), and
those of `ClientList.tsx`, `ClientCard.tsx` and `WhoUses.tsx`.
*/

/** What the page is for, under its title. OURS (CONVENTIONS.md, deviation 25). */
export const CLIENTS_SUBTITLE = 'Who asks this server, how much, and how much of it is blocked.'

/** `--bp-wide`: at this width and under, the list and the card take turns. */
const NARROW = '(max-width: 1180px)'

type Period = Exclude<Range, 'Custom'>
const PERIODS = RANGES.filter((r): r is Period => r !== 'Custom')

const Q = 'q'
const FILTER = 'filter'
const SORT = 'sort'
const PAGE = 'page'
const CLIENT = 'client'
export const CLIENT_PARAMS = [Q, FILTER, SORT, PAGE, CLIENT]

/*
The DHCP leases, for the open client's MAC address, host name, scope and lease
action: DHCP's own call, once per token and node and again after a conversion, never
without `DhcpServer: View`. A failure leaves the card without a lease, as a client no
lease hands an address to.
*/
function useLeases(token: string | null, node: string, enabled: boolean): [DhcpLease[] | null, () => void] {
  const [leases, setLeases] = useState<DhcpLease[] | null>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let live = true
    void listLeases(token, node).then((r) => {
      if (live) setLeases(r.kind === 'ok' ? r.data : null)
    })
    return () => {
      live = false
    }
  }, [token, node, enabled, round])
  return [enabled ? leases : null, () => setRound((n) => n + 1)]
}

/*
Settings' two bypass lists, for the card's Actions (`ClientActions.tsx`): `settings/get`
on the node where they live (`settingsNode`), once per token and node, never without
`Settings: View`. A save hands back the settings as the server keeps them, and they
replace these.
*/
function useBypassSettings(token: string | null, node: string, need: Need | undefined): [SettingsRead, (s: DnsSettings) => void] {
  const [read, setRead] = useState<SettingsRead>({ kind: 'loading' })
  useEffect(() => {
    if (need != null) return
    let live = true
    setRead({ kind: 'loading' })
    void readSettings(token, node).then((r) => {
      if (live) setRead(r.kind === 'ok' ? { kind: 'ok', data: r.data } : { kind: 'failed' })
    })
    return () => {
      live = false
    }
  }, [token, node, need])
  return [need != null ? { kind: 'locked', need } : read, (data) => setRead({ kind: 'ok', data })]
}

export function Clients({
  token,
  permissions,
  nodes = [],
  clusterInitialised = false,
  serverDomain,
}: {
  token: string | null
  permissions: Permissions
  nodes?: ClusterNode[]
  clusterInitialised?: boolean
  serverDomain?: string
}) {
  const statsNeed = missing(permissions, 'Dashboard.canView')
  const logsNeed = missing(permissions, 'Logs.canView')
  const dhcpNeed = missing(permissions, 'DhcpServer.canView')
  const narrow = useMedia(NARROW)
  const [range, setRange] = useState<Period>('LastHour')
  const [node, setNode] = useState<string>(() => localStorage.getItem('dashboardClusterNode') || AGGREGATE)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [top, setTop] = useState<TopEntry[] | null>(null)
  /** The first read of this period and node failed: there is nothing to show. */
  const [failure, setFailure] = useState(false)
  /** A later read failed: what is on screen is the last good data, and says so. */
  const [stale, setStale] = useState(false)
  const [lastGood, setLastGood] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [query, setQuery] = useState(() => readParam(Q) ?? '')
  const [filter, setFilter] = useState<Filter>(() => readFilter(readParam(FILTER)))
  const [sort, setSort] = useState<SortBy>(() => readSortBy(readParam(SORT)))
  const [page, setPage] = useState(() => Math.max(1, Number(readParam(PAGE)) || 1))
  const [open, setOpen] = useState<string | null>(() => readParam(CLIENT))

  useEffect(() => {
    localStorage.setItem('dashboardClusterNode', node)
  }, [node])

  useEffect(() => {
    writeParams({
      [Q]: query.trim() === '' ? null : query,
      [FILTER]: filter === 'all' ? null : filter,
      [SORT]: sort === 'queries' ? null : sort,
      [PAGE]: page > 1 ? String(page) : null,
      [CLIENT]: open,
    })
  }, [query, filter, sort, page, open])
  useEffect(() => () => dropParams(CLIENT_PARAMS), [])

  const app = useLoggingApp(token, logsNeed == null)
  const aggregate = clusterInitialised && node === AGGREGATE
  /* Logs and leases are one node's: with the aggregate, or without a cluster, the
     connected one. */
  const logNode = !clusterInitialised || node === AGGREGATE ? '' : node
  const [leases, reloadLeases] = useLeases(token, logNode, dhcpNeed == null && statsNeed == null)
  const listsNode = settingsNode(clusterInitialised)
  const [bypass, setBypass] = useBypassSettings(token, listsNode, missing(permissions, 'Settings.canView'))

  const hadData = useRef(false)
  const asked = useRef(0)

  const load = useCallback(async () => {
    if (statsNeed != null) return
    const mine = ++asked.current
    const [s, t] = await Promise.all([
      getDashboardStats(token, range, undefined, node),
      readTop(token, range, 'TopClients', LIMIT, node),
    ])
    if (mine !== asked.current) return
    if (s.kind === 'ok' && t.kind === 'ok') {
      setStats(s.data)
      setTop(t.data)
      setFailure(false)
      setStale(false)
      setLastGood(new Date().toISOString())
      hadData.current = true
      return
    }
    /* As the Overview: with earlier data the stale strip says it, with none the
       notice carries the server's message. */
    if (hadData.current) setStale(true)
    else {
      setFailure(true)
      setNotice(noticeFromFailure(s.kind !== 'ok' ? s : t))
    }
  }, [token, range, node, statsNeed])

  /* A new period or node is a new question: what is on screen answers the old one. */
  useEffect(() => {
    hadData.current = false
    setStats(null)
    setTop(null)
    setFailure(false)
    setStale(false)
    void load()
  }, [load])

  /* Last Hour: again a minute after each answer, never two at once, nothing while
     the tab is hidden, at once when it comes back (the Overview's rule). */
  useEffect(() => {
    if (range !== 'LastHour' || statsNeed != null) return
    let cancelled = false
    let timer: number | undefined
    const arm = () => {
      if (!cancelled && !document.hidden) timer = window.setTimeout(() => void again(), LAST_HOUR_REFRESH_MS)
    }
    /* One chain only: a tab shown again while a read is still out waits for it,
       which then arms the next turn itself. */
    let running = false
    async function again() {
      if (running) return
      running = true
      try {
        await load()
      } finally {
        running = false
      }
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

  const sample = useQuerySample({ token, app, node: logNode, limit: SAMPLE, refreshOn: stats, enabled: logsNeed == null })
  const entries = sample.kind === 'ok' ? sample.entries : null
  const rows = useMemo(() => clientRows(top ?? [], entries), [top, entries])
  const summary = useMemo(() => (entries != null ? summarise(entries, top ?? []) : null), [entries, top])
  const total = stats?.stats.totalQueries ?? 0
  const busiestRows = useMemo(() => busiest(rows, total), [rows, total])

  /* Heavy blocking is counted from the log sample: without one it is not offered. */
  const filters: readonly Filter[] = entries != null ? FILTERS : FILTERS.filter((f) => f !== 'heavy')
  const shownFilter: Filter = filters.includes(filter) ? filter : 'all'
  const counts = useMemo(() => filterCounts(rows, total), [rows, total])
  const shown = useMemo(
    () => rows.filter((r) => matchesSearch(r, query) && matchesFilter(r, shownFilter, total)),
    [rows, query, shownFilter, total],
  )
  const sorted = useMemo(() => sortRows(shown, sort), [shown, sort])
  const current = pageOf(sorted, page, PER_PAGE)

  /*
  A link that names a client lands on it: once, when the first rows arrive, the list
  turns to that client's page. A client the period does not list is dropped from
  the bar, since nothing can open it.
  */
  const placed = useRef(false)
  useEffect(() => {
    if (placed.current || top == null) return
    placed.current = true
    if (open == null) return
    const at = sorted.findIndex((r) => r.ip === open)
    if (at >= 0) setPage(Math.floor(at / PER_PAGE) + 1)
    else if (!rows.some((r) => r.ip === open)) setOpen(null)
  }, [top, sorted, rows, open])

  /* Wide, the card always shows someone: the bar's client, or the list's first. */
  const selected = open ?? (narrow ? null : (current.rows[0]?.ip ?? null))
  const selectedRow = selected != null ? (rows.find((r) => r.ip === selected) ?? null) : null

  const where = aggregate && serverDomain != null ? ` on ${serverDomain}` : ''
  const basis = summary == null || summary.total === 0
    ? null
    : summary.total === 1 ? `In the last query${where}` : `In the last ${summary.total.toLocaleString()} queries${where}`
  const loading = top == null && !failure
  const choose = (ip: string) => setOpen(ip)

  const period = (
    <Segmented
      label="Period"
      live="LastHour"
      compact
      options={PERIODS.map((r) => ({ id: r, label: RANGE_LABEL[r] }))}
      active={range}
      onChoose={setRange}
    />
  )

  const selectedLease = selectedRow != null ? leaseFor(leases, selectedRow.ip) : null
  const card = selectedRow != null && (
    <ClientCard
      key={selectedRow.ip}
      row={selectedRow}
      token={token}
      app={app}
      node={node}
      logNode={logNode}
      where={where}
      logsNeed={logsNeed}
      lease={selectedLease}
      refreshOn={stats}
      onNotice={setNotice}
      heading={!narrow}
      actions={
        <ClientActions
          ip={selectedRow.ip}
          token={token}
          settings={bypass}
          onSettings={setBypass}
          settingsNode={listsNode}
          settingsNeed={missing(permissions, 'Settings.canModify')}
          lease={selectedLease}
          dhcpNode={logNode}
          dhcpNeed={missing(permissions, 'DhcpServer.canModify')}
          onLeaseChanged={reloadLeases}
          onNotice={setNotice}
        />
      }
    />
  )

  const list = (
    <ClientList
      rows={current.rows}
      all={rows.length}
      shown={sorted.length}
      counts={counts}
      filters={filters}
      filter={shownFilter}
      onFilter={(f) => {
        setFilter(f)
        setPage(1)
      }}
      sort={sort}
      onSort={(s) => {
        setSort(s)
        setPage(1)
      }}
      query={query}
      onQuery={(q) => {
        setQuery(q)
        setPage(1)
      }}
      page={current.page}
      totalPages={current.totalPages}
      onPage={setPage}
      selected={selected}
      onSelect={choose}
      loading={loading}
      failure={failure}
    />
  )

  /* Narrow, an open client is a page of its own, as a zone is. */
  const onCard = narrow && selectedRow != null

  return (
    <>
      <InChrome>
        <ClusterNodeSelect nodes={nodes} initialised={clusterInitialised} aggregate value={node} onChange={setNode} />
      </InChrome>

      {onCard ? (
        <SectionHeader section="Clients" onBack={() => setOpen(null)} title={label(selectedRow)} actions={period} />
      ) : (
        <SectionHeader title="Clients" subtitle={CLIENTS_SUBTITLE} actions={period} />
      )}
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={styles.stack}>
        {stale && <StaleData since={lastGood} onRetry={() => void load()} />}

        {statsNeed != null ? (
          <div className={styles.lockedPage}>
            <LockedBody need={statsNeed} />
          </div>
        ) : onCard ? (
          card
        ) : (
          <>
            <Strip
              stats={stats}
              top={top}
              failure={failure}
              sample={sample}
              summary={summary}
              basis={basis}
              logsNeed={logsNeed != null ? requiresText(logsNeed) : null}
              app={app}
            />
            <WhoUses busiest={busiestRows} totalQueries={total} selected={selected} onSelect={choose} />
            {narrow ? (
              list
            ) : (
              <div className={styles.master}>
                <div className={styles.masterList}>{list}</div>
                <div className={styles.masterCard}>{card}</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

/* A figure of the strip, counting up once as its cell comes in. */
function Figure({ value }: { value: number | null | undefined }) {
  return <div className={statStyles.figure}>{value == null ? '—' : <Grouped value={value} />}</div>
}

function Grouped({ value }: { value: number }) {
  return <>{useCountUp(value).toLocaleString()}</>
}

/* A client in a cell: its address, and the name the server gave it under. */
function Who({ ip, name }: { ip: string; name: string | null }) {
  return (
    <>
      <div className={`${statStyles.lastName} ${styles.who}`} title={ip}>{ip}</div>
      {name != null && <div className={styles.whoName} title={name}>{name}</div>}
    </>
  )
}

/*
THE STRIP (`ui/StatCard`), four cells: two read from the period, two from the log
sample. Clients is the period's count (`totalClients`, upstream's Clients tile);
Most Active the first of the period's Top Clients with its queries and its share of
the period's total; Most Blocked the client with the most blocked queries in the
sample; Blocked Share how much of the sample was blocked, with the bar of Blocked
against what got through. Without a query logs app the two sample cells are one,
which says why, once; without `Logs.canView` each keeps its place, locked.
*/
function Strip({
  stats,
  top,
  failure,
  sample,
  summary,
  basis,
  logsNeed,
  app,
}: {
  stats: DashboardStats | null
  top: TopEntry[] | null
  failure: boolean
  sample: QuerySample
  summary: ReturnType<typeof summarise> | null
  basis: string | null
  logsNeed: string | null
  app: LoggingApp
}) {
  const s = stats?.stats
  const first = top?.[0]
  const firstName = first?.domain != null && first.domain !== '' ? first.domain : null
  const listed = top != null && s != null && top.length >= LIMIT && s.totalClients > top.length
  const allowed = summary == null ? 0 : summary.total - summary.blocked
  const empty = s != null && s.totalQueries === 0

  const sampleGap = (
    <div className={statStyles.caption}>
      {sample.kind === 'failed' ? 'Could not load this data.' : ''}
    </div>
  )

  return (
    <div className={`${statStyles.grid} ${styles.strip}`}>
      <Card title="Clients" colour="var(--ch-clients)">
        <div className={statStyles.body}>
          <Figure value={s?.totalClients} />
          {failure && <div className={statStyles.caption}>Could not load this data.</div>}
          {listed && <div className={statStyles.caption}>{`The ${LIMIT.toLocaleString()} most active are listed`}</div>}
        </div>
      </Card>
      <Card title="Most Active" colour="var(--ch-total)">
        <div className={statStyles.body}>
          {first == null ? (
            <>
              <div className={statStyles.figure}>—</div>
              {failure && <div className={statStyles.caption}>Could not load this data.</div>}
              {empty && <div className={statStyles.caption}>No queries for this period.</div>}
            </>
          ) : (
            <>
              <Who ip={first.name} name={firstName} />
              <div className={statStyles.caption}>
                {`${num2(first.hits)} ${first.hits === 1 ? 'query' : 'queries'}, ${percentage(first.hits, s?.totalQueries ?? 0)} of total`}
              </div>
            </>
          )}
        </div>
      </Card>
      {logsNeed != null ? (
        <>
          <Card title="Most Blocked" colour="var(--ch-block)">
            <div className={`${statStyles.body} ${styles.locked}`}><Icon name="lock" size={14} /> {logsNeed}</div>
          </Card>
          <Card title="Blocked Share" colour="var(--ch-block)">
            <div className={`${statStyles.body} ${styles.locked}`}><Icon name="lock" size={14} /> {logsNeed}</div>
          </Card>
        </>
      ) : app.kind === 'none' ? (
        <Card title="No query logging app" colour="var(--ch-block)" className={styles.wide}>
          <p className={styles.noApp}>
            Please install the &apos;Query Logs (Sqlite)&apos; DNS App or any other DNS app that supports
            query logging feature from the <RouteLink to={{ section: 'apps', sub: null }}>Apps</RouteLink> section.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Most Blocked" colour="var(--ch-block)">
            <div className={statStyles.body}>
              {summary == null ? (
                <>
                  <div className={statStyles.figure}>—</div>
                  {sampleGap}
                </>
              ) : summary.mostBlocked == null ? (
                <>
                  <div className={statStyles.figure}>—</div>
                  <div className={statStyles.caption}>No blocked queries.</div>
                </>
              ) : (
                <>
                  <Who ip={summary.mostBlocked.ip} name={summary.mostBlocked.name} />
                  <div className={statStyles.caption}>
                    {`${num2(summary.mostBlocked.count)} blocked in the last ${summary.total === 1 ? 'query' : `${num2(summary.total)} queries`}`}
                  </div>
                </>
              )}
            </div>
          </Card>
          <Card title="Blocked Share" colour="var(--ch-block)">
            <div className={statStyles.body}>
              {summary == null || summary.total === 0 ? (
                <>
                  <div className={statStyles.figure}>—</div>
                  {summary != null ? <div className={statStyles.caption}>No queries.</div> : sampleGap}
                </>
              ) : (
                <>
                  <div className={statStyles.figure}>{percentage(summary.blocked, summary.total)}</div>
                  <div className={statStyles.caption}>{basis}</div>
                  <StackBar
                    label={`Blocked ${summary.blocked.toLocaleString()}, Allowed ${allowed.toLocaleString()}`}
                    parts={[
                      { key: 'Blocked', name: 'Blocked', value: summary.blocked, colour: 'var(--ch-block)' },
                      { key: 'Allowed', name: 'Allowed', value: allowed, colour: 'var(--ch-ok)' },
                    ]}
                  />
                </>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
