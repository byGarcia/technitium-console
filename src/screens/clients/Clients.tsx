import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  getDashboardStats, readTop, RANGES, RANGE_LABEL,
  type DashboardStats, type Range, type TopEntry,
} from '../../api/dashboard'
import { InChrome } from '../../app/ChromeSlot'
import { useHandoff } from '../../app/handoff'
import { ClusterNodeSelect, AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { SectionHeader } from '../../ui/SectionHeader'
import { Segmented } from '../../ui/Segmented'
import { Body } from '../../ui/Panel'
import { Card, StackBar, statStyles } from '../../ui/StatCard'
import { DataTable, DataFoot, End, Grow } from '../../ui/DataTable'
import { RowAction, Table, Th, type Keys } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Pagination } from '../../ui/Pagination'
import { Field, Input } from '../../ui/Field'
import { Icon } from '../../ui/Icon'
import { RouteLink } from '../../ui/RouteLink'
import { useCountUp } from '../../ui/useCountUp'
import { Failure, Loading } from '../../ui/Empty'
import { Notifier } from '../../ui/Notifier'
import { pageWindow } from '../../lib/pagination'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import { useDomainAction } from '../../lib/allow-block'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { StaleData } from '../StaleData'
import { num2, percentage } from '../dashboard/metrics'
import { matchesTop } from '../dashboard/TopStats'
import { TopRowMenu } from '../dashboard/TopRowMenu'
import { LAST_HOUR_REFRESH_MS } from '../dashboard/useLive'
import { SAMPLE } from '../blocking/blocked-sample'
import { useLoggingApp, type LoggingApp } from '../blocking/logging-app'
import { LockedBody } from '../blocking/Locked'
import { missing, requiresText, type Permissions } from '../blocking/permissions'
import { pageOf } from '../blocking/rules-model'
import {
  LIMIT, PER_PAGE, clientRows, nextSort, readSort, sortClients, summarise, writeSort,
  type ClientRow, type ClientSort,
} from './clients-model'
import { useQuerySample, type QuerySample } from './query-sample'
import { ClientDetail } from './ClientDetail'
import styles from './Clients.module.css'

/*
CLIENTS (CONVENTIONS.md, deviation 25, Adrián's decision of 2026-11-06). OURS as a
page: upstream has no such screen. It is Blocking › Overview's Blocked by client card
grown into a page, and it is built from the pieces that card and the Dashboard
already use: the same calls, the same query logs app, the same blocked classes,
the same row menus. It asks the server nothing upstream's console does not already
ask:

  · `dashboard/stats/get` (the Dashboard's call) for the count of clients and the
    period's total of queries, which the shares are of;
  · `dashboard/stats/getTop` with `statsType=TopClients` and `limit=1000`, what
    upstream's "More" behind Top Clients sends (main.js:2939, index.html:336), for
    the table, one line per client;
  · `apps/list` and `logs/query` (Query Logs' calls) for the log sample: the newest
    1,000 queries of every type (`SAMPLE`, the Blocked by client card's size), and
    for an open row the newest 500 of that client (`ClientDetail.tsx`).

The period is the Dashboard's five fixed ones, not Custom, with its node memory
(`dashboardClusterNode`), as Blocking › Overview. Last Hour reads again a minute
after each answer, never with a hidden tab: the clients do not move with the live
counters (deviation 5), so nothing here moves between those reloads.

What comes from the log is a sample, not the period, and every figure drawn from it
says so (`In the last N queries`). Logs belong to ONE node: with the cluster
aggregate the sample is the connected node's and says `on <node>`.

The view is in the address bar (`lib/url-state.ts`, written by replacing the entry,
dropped when the page goes): the search (`?q=`), the order (`?sort=`, a column's
name, `-` before it for descending, `clients-model.ts`), the page (`?page=`, left
out on 1) and the open client (`?client=`).

Its words, all OURS save upstream's `Clients`, `Last Hour` and the other periods,
`Show Query Logs`, `Top Domains`, `Top Blocked Domains`, `Query Types`, `Query
Response Types`, `(rate limited)`, the Apps sentence (Recently Blocked's, from
logs.js:391) and the `Requires X: Y` of the padlock: the subtitle
(`CLIENTS_SUBTITLE`), `Period`, `Most Active`, `Most Blocked`, `Blocked Share`,
`N queries, X% of total`, `N blocked in the last N queries`, `In the last N queries`
(and `In the last query`), `on <node>`, `The N most active are listed`, `No queries
for this period.` (the Dashboard's), `No blocked queries.` (Recently Blocked's),
`No query logging app` (Recently Blocked's), `Could not load this data.` (the
Overview's), the table's `Search`, its placeholder `Client or domain` (Top Stats'),
`Client`, `Name`, `Share`, `Queries`, `Blocked`, `Details`, `Actions for <client>`,
`Blocked: in the last N queries`, `N clients` and `, K shown`, `No clients for this
period.`, `No queries.` (an empty sample), `No Data` (upstream's, Top Stats' empty
search), and those of `ClientDetail.tsx`.
*/

/** What the page is for, under its title. OURS (CONVENTIONS.md, deviation 25). */
export const CLIENTS_SUBTITLE = 'Who asks this server, how much, and how much of it is blocked.'

type Period = Exclude<Range, 'Custom'>
const PERIODS = RANGES.filter((r): r is Period => r !== 'Custom')

const Q = 'q'
const SORT = 'sort'
const PAGE = 'page'
const CLIENT = 'client'
export const CLIENT_PARAMS = [Q, SORT, PAGE, CLIENT]

/* The columns that sort, each read as the cell shows it. */
const KEYS: Keys<ClientRow> = {
  client: (r) => r.ip,
  name: (r) => r.name,
  queries: (r) => r.hits,
  blocked: (r) => r.blocked,
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
  const [sort, setSort] = useState<ClientSort | null>(() => readSort(readParam(SORT), KEYS))
  const [page, setPage] = useState(() => Math.max(1, Number(readParam(PAGE)) || 1))
  const [open, setOpen] = useState<string | null>(() => readParam(CLIENT))

  useEffect(() => {
    localStorage.setItem('dashboardClusterNode', node)
  }, [node])

  useEffect(() => {
    writeParams({
      [Q]: query.trim() === '' ? null : query,
      [SORT]: writeSort(sort),
      [PAGE]: page > 1 ? String(page) : null,
      [CLIENT]: open,
    })
  }, [query, sort, page, open])
  useEffect(() => () => dropParams(CLIENT_PARAMS), [])

  const app = useLoggingApp(token, logsNeed == null)
  const aggregate = clusterInitialised && node === AGGREGATE
  /* Logs are one node's: with the aggregate, the connected one. */
  const logNode = aggregate ? '' : node

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

  const sample = useQuerySample({ token, app, node: logNode, limit: SAMPLE, refreshOn: stats, enabled: logsNeed == null })
  const entries = sample.kind === 'ok' ? sample.entries : null
  const rows = useMemo(() => clientRows(top ?? [], entries), [top, entries])
  const summary = useMemo(() => (entries != null ? summarise(entries, top ?? []) : null), [entries, top])

  const shown = useMemo(
    () => rows.filter((r) => matchesTop({ name: r.ip, hits: r.hits, domain: r.name ?? '' }, query)),
    [rows, query],
  )
  const sorted = useMemo(() => sortClients(shown, sort, KEYS), [shown, sort])
  const current = pageOf(sorted, page, PER_PAGE)

  /*
  A link that names a client lands on it: once, when the first rows arrive, the
  table turns to that client's page. A client the period does not list is dropped
  from the bar, since no row can open it.
  */
  const placed = useRef(false)
  useEffect(() => {
    if (placed.current || top == null) return
    placed.current = true
    if (open == null) return
    const at = sorted.findIndex((r) => r.ip === open)
    if (at < 0) setOpen(null)
    else setPage(Math.floor(at / PER_PAGE) + 1)
  }, [top, sorted, open])

  const where = aggregate && serverDomain != null ? ` on ${serverDomain}` : ''
  const basis = summary == null || summary.total === 0
    ? null
    : summary.total === 1 ? `In the last query${where}` : `In the last ${summary.total.toLocaleString()} queries${where}`
  const withBlocked = logsNeed == null && app.kind !== 'none'
  const loading = top == null && !failure

  return (
    <>
      <InChrome>
        <ClusterNodeSelect nodes={nodes} initialised={clusterInitialised} aggregate value={node} onChange={setNode} />
      </InChrome>

      <SectionHeader
        title="Clients"
        subtitle={CLIENTS_SUBTITLE}
        actions={
          <Segmented
            label="Period"
            live="LastHour"
            compact
            options={PERIODS.map((r) => ({ id: r, label: RANGE_LABEL[r] }))}
            active={range}
            onChoose={setRange}
          />
        }
      />
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={styles.stack}>
        {stale && <StaleData since={lastGood} onRetry={() => void load()} />}

        {statsNeed != null ? (
          <div className={styles.lockedPage}>
            <LockedBody need={statsNeed} />
          </div>
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
            <ClientTable
              rows={current.rows}
              all={rows.length}
              shown={sorted.length}
              total={stats?.stats.totalQueries ?? 0}
              page={current.page}
              totalPages={current.totalPages}
              onPage={setPage}
              query={query}
              onQuery={(q) => {
                setQuery(q)
                setPage(1)
              }}
              sort={sort}
              onSort={(field) => setSort(nextSort(field, sorted, KEYS))}
              open={open}
              onOpen={(ip) => setOpen((o) => (o === ip ? null : ip))}
              loading={loading}
              failure={failure}
              withBlocked={withBlocked}
              basis={withBlocked && basis != null ? `Blocked: ${basis.charAt(0).toLowerCase()}${basis.slice(1)}` : null}
              detail={(ip) => (
                <ClientDetail
                  ip={ip}
                  token={token}
                  app={app}
                  node={node}
                  logNode={logNode}
                  where={where}
                  logsNeed={logsNeed}
                  refreshOn={stats}
                  onNotice={setNotice}
                />
              )}
              token={token}
              node={node}
              onNotice={setNotice}
            />
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

/*
THE TABLE: one card (`ui/DataTable`), the search in its toolbar and what the
Blocked column is based on at its end, one line per client (its address, its name,
its share of the period's queries as a bar and a percentage, its queries, and its
blocked queries in the sample), the count and the pages in the foot. A row's menu
is Top Clients' (`TopRowMenu`, `Show Query Logs`), and `Details` opens the client
under its row (`ClientDetail.tsx`).
*/
function ClientTable({
  rows,
  all,
  shown,
  total,
  page,
  totalPages,
  onPage,
  query,
  onQuery,
  sort,
  onSort,
  open,
  onOpen,
  loading,
  failure,
  withBlocked,
  basis,
  detail,
  token,
  node,
  onNotice,
}: {
  rows: ClientRow[]
  all: number
  shown: number
  total: number
  page: number
  totalPages: number
  onPage: (p: number) => void
  query: string
  onQuery: (q: string) => void
  sort: ClientSort | null
  onSort: (field: string) => void
  open: string | null
  onOpen: (ip: string) => void
  loading: boolean
  failure: boolean
  withBlocked: boolean
  basis: string | null
  detail: (ip: string) => ReactNode
  token: string | null
  node: string
  onNotice: (n: Notice) => void
}) {
  const action = useDomainAction(token, onNotice)
  const columns = withBlocked ? 6 : 5
  const largest = rows.reduce((m, r) => Math.max(m, r.hits), 0)
  const count = all === 1 ? '1 client' : `${all.toLocaleString()} clients`

  return (
    <DataTable
      toolbar={
        <>
          <Grow>
            <Field inline label="Search">
              {(id) => (
                <Input id={id} search placeholder="Client or domain" value={query} onChange={(e) => onQuery(e.target.value)} />
              )}
            </Field>
          </Grow>
          {basis != null && (
            <End>
              <span className={styles.basis}>{basis}</span>
            </End>
          )}
        </>
      }
      foot={
        loading || failure ? undefined : (
          <DataFoot count={shown === all ? count : `${count}, ${shown.toLocaleString()} shown`}>
            {totalPages > 1 && (
              <Pagination window={pageWindow(page, totalPages)} current={page} last={totalPages} onGoTo={onPage} />
            )}
          </DataFoot>
        )
      }
    >
      {failure ? (
        <Body>
          <Failure>Could not load this data.</Failure>
        </Body>
      ) : loading ? (
        <Body>
          <Loading />
        </Body>
      ) : (
        <Table
          stack
          tableClass={styles.table}
          header={
            <>
              <Th field="client" sort={sort} onSort={onSort}>Client</Th>
              <Th field="name" sort={sort} onSort={onSort}>Name</Th>
              <th className={styles.shareHead}>Share</th>
              <Th field="queries" sort={sort} onSort={onSort} className={styles.numHead}>Queries</Th>
              {withBlocked && <Th field="blocked" sort={sort} onSort={onSort} className={styles.numHead}>Blocked</Th>}
              <th className={tbl.actionsCell} aria-label="Actions" />
            </>
          }
          isEmpty={rows.length === 0}
          emptyText={all === 0 ? 'No clients for this period.' : 'No Data'}
          columns={columns}
        >
          {rows.map((r) => (
            <Row
              key={r.ip}
              row={r}
              total={total}
              largest={largest}
              columns={columns}
              withBlocked={withBlocked}
              open={open === r.ip}
              onOpen={() => onOpen(r.ip)}
              node={node}
              action={action}
              detail={open === r.ip ? detail(r.ip) : null}
            />
          ))}
        </Table>
      )}
    </DataTable>
  )
}

function Row({
  row,
  total,
  largest,
  columns,
  withBlocked,
  open,
  onOpen,
  node,
  action,
  detail,
}: {
  row: ClientRow
  total: number
  largest: number
  columns: number
  withBlocked: boolean
  open: boolean
  onOpen: () => void
  node: string
  action: ReturnType<typeof useDomainAction>
  detail: ReactNode
}) {
  const id = useId()
  const handoff = useHandoff()
  return (
    <>
      <tr className={[open ? tbl.openRow : '', row.rateLimited ? styles.limited : ''].filter(Boolean).join(' ') || undefined}>
        <td className={`${styles.ip} ${tbl.lead}`}>
          {row.ip}
          {row.rateLimited ? ' (rate limited)' : ''}
        </td>
        <td className={styles.name}>{row.name ?? ''}</td>
        <td className={styles.shareCell}>
          <span className={styles.shareLine}>
            <span className={styles.share} aria-hidden="true">
              <i style={{ width: `${largest > 0 ? (row.hits * 100) / largest : 0}%` }} />
            </span>
            <span className={styles.pct}>{percentage(row.hits, total)}</span>
          </span>
        </td>
        <td className={styles.num}>{num2(row.hits)}</td>
        {withBlocked && (
          <td className={`${styles.num} ${row.blocked != null && row.blocked > 0 ? styles.blockedNum : ''}`}>
            {row.blocked == null ? '—' : num2(row.blocked)}
          </td>
        )}
        <td className={tbl.actionsCell}>
          <div className={tbl.actions}>
            {handoff != null && <TopRowMenu kind="TopClients" name={row.ip} node={node} action={action} />}
            <RowAction
              icon={open ? 'chevronDown' : 'chevronRight'}
              name="Details"
              aria-expanded={open}
              aria-controls={open ? id : undefined}
              onClick={onOpen}
            />
          </div>
        </td>
      </tr>
      {open && (
        <tr id={id} className={tbl.detailRow}>
          <td colSpan={columns}>{detail}</td>
        </tr>
      )}
    </>
  )
}

