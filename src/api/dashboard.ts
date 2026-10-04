import { apiRequest, type ApiOutcome } from './client'
import { localiseLabels } from './chart-labels'

/*
The three endpoints of the `dashboard` family.

The response of `stats/get` comes wrapped in `response` and brings FOUR chart
sets, not two: the main line one and three breakdowns (response type, query type
and protocol). Verified against v15.4.
*/

export const RANGES = ['LastHour', 'LastDay', 'LastWeek', 'LastMonth', 'LastYear', 'Custom'] as const
export type Range = (typeof RANGES)[number]

/** Upstream's literal labels for each range. */
export const RANGE_LABEL: Record<Range, string> = {
  LastHour: 'Last Hour',
  LastDay: 'Last Day',
  LastWeek: 'Last Week',
  LastMonth: 'Last Month',
  LastYear: 'Last Year',
  Custom: 'Custom',
}

export interface Stats {
  totalQueries: number
  totalNoError: number
  totalServerFailure: number
  totalNxDomain: number
  totalRefused: number
  totalAuthoritative: number
  totalRecursive: number
  totalCached: number
  totalBlocked: number
  totalDropped: number
  totalClients: number
  zones: number
  cachedEntries: number
  allowedZones: number
  blockedZones: number
  allowListZones: number
  blockListZones: number
}

/** Chart.js's format, which is the one the server emits. */
export interface ChartData {
  labelFormat?: string
  labels: string[]
  /** The labels as the server sent them, before `localiseLabels` wrote them for the
   *  eye: UTC instants, each the END of its minute (or hour, day...). The live Last
   *  Hour reads the last one to know how far the server has counted. */
  instants?: string[]
  datasets: { label: string; data: number[]; backgroundColor?: string | string[] }[]
}

/*
A top is NOT just a name and a hit count. A client also brings the domain it
resolved and whether the server was rate-limiting it, and upstream draws both:
the domain under the name, and the row in orange with "(rate limited)" after it.
The two fields only exist in `TopClients`. Checked against v15.4.
*/
export interface TopEntry {
  name: string
  hits: number
  /** Only on clients: the domain it resolved. Empty is drawn as ".". */
  domain?: string
  /** Only on clients. */
  rateLimited?: boolean
}

export interface DashboardStats {
  stats: Stats
  mainChartData: ChartData
  queryResponseChartData: ChartData
  queryTypeChartData: ChartData
  protocolTypeChartData: ChartData
  topClients: TopEntry[]
  topDomains: TopEntry[]
  topBlockedDomains: TopEntry[]
}

export async function getDashboardStats(
  token: string | null,
  type: Range = 'LastHour',
  range?: { start: string; end: string },
  /* Which cluster node answers. The server proxies centrally, so it is the same
     parameter on every call (`ui/ClusterNodeSelect`). */
  node?: string,
): Promise<ApiOutcome<DashboardStats>> {
  /* `utc=true` as main.js:2619 sends it: the main chart comes labelled with UTC
     instants, and `localiseLabels` writes them as main.js:2673-2686 does. */
  const body: Record<string, string> = { type, utc: 'true' }
  if (type === 'Custom' && range) {
    body.start = range.start
    body.end = range.end
  }
  const outcome = await apiRequest<{ response: DashboardStats }>('dashboard/stats/get', { token, body, node })
  /*
  Returns the whole outcome and not `DashboardStats | null`.

  With `null` the Dashboard could not tell "the server has served no queries"
  apart from "the call fell over", and both were drawn the same: eleven tiles at
  zero and "No queries for this period.". It is the console's worst lie (whoever
  administers a DNS and reads that concludes their server is receiving no
  traffic) and the easiest to believe, because it looks exactly like a normal
  response.
  */
  if (outcome.kind !== 'ok') return outcome
  const data = outcome.data.response
  return {
    kind: 'ok',
    data: data.mainChartData != null ? { ...data, mainChartData: localiseLabels(data.mainChartData) } : data,
  }
}

export type TopKind = 'TopClients' | 'TopDomains' | 'TopBlockedDomains'

export async function getTop(
  token: string | null,
  statsType: Range,
  type: TopKind,
  limit = 1000,
  node?: string,
): Promise<TopEntry[]> {
  const outcome = await apiRequest<{ response: Record<string, TopEntry[]> }>('dashboard/stats/getTop', {
    token,
    node,
    body: { type: statsType, statsType: type, limit: String(limit) },
  })
  if (outcome.kind !== 'ok') return []
  const r = outcome.data.response
  return r.topClients ?? r.topDomains ?? r.topBlockedDomains ?? []
}

export function deleteAllStats(token: string | null): Promise<ApiOutcome> {
  return apiRequest('dashboard/stats/deleteAll', { token })
}

/*
`dashboard/metrics/json`: the server's lifetime counters, current to the query
(a query shows on the very next read). Upstream documents it in APIDOCS.md
("Get Metrics (JSON)", marked experimental) but its console does not call it;
this console reads it to keep Last Hour moving between reloads (deviation 5 in
CONVENTIONS.md). `node=cluster` does NOT aggregate, it answers the local node, so
the aggregate is summed by the caller, node by node. Checked against v15.6.0.

`totalClients` counts distinct clients, so differences of it mean nothing: it is
not one of the live keys.
*/
export const LIVE_KEYS = [
  'totalQueries', 'totalNoError', 'totalServerFailure', 'totalNxDomain', 'totalRefused',
  'totalAuthoritative', 'totalRecursive', 'totalCached', 'totalBlocked', 'totalDropped',
] as const
export type LiveKey = (typeof LIVE_KEYS)[number]
export type LiveCounters = Record<LiveKey, number>

export interface Metrics {
  uptimestamp: string
  lifetimeCounters: LiveCounters & { totalClients: number }
}

export async function getMetrics(token: string | null, node?: string): Promise<ApiOutcome<Metrics>> {
  const outcome = await apiRequest<{ response: Metrics }>('dashboard/metrics/json', { token, node })
  if (outcome.kind !== 'ok') return outcome
  /* Experimental upstream: a response of another shape is a failure, not a crash. */
  const data = outcome.data?.response
  if (data == null || typeof data.uptimestamp !== 'string' ||
    typeof data.lifetimeCounters !== 'object' || data.lifetimeCounters == null ||
    LIVE_KEYS.some((key) => typeof data.lifetimeCounters[key] !== 'number' ||
      !Number.isFinite(data.lifetimeCounters[key]) || data.lifetimeCounters[key] < 0)) {
    return { kind: 'error', message: 'Unexpected metrics response.' }
  }
  return { kind: 'ok', data }
}
