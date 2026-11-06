import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as dashboard from '../../api/dashboard'
import * as apps from '../../api/apps'
import * as logs from '../../api/logs'
import * as dhcp from '../../api/dhcp'
import * as settings from '../../api/settings'
import type { QueryLogEntry } from '../../api/logs'
import { HandoffContext, type Handoff } from '../../app/handoff'
import { SAMPLE } from '../blocking/blocked-sample'
import { Clients } from './Clients'
import { DETAIL_SAMPLE, LIMIT } from './clients-model'

/* The canvas is Chart.js's: drawn as its name, which is what the reader gets. */
vi.mock('../dashboard/Chart', () => ({
  Chart: ({ aria }: { aria: string }) => <div role="img" aria-label={aria} />,
}))

beforeEach(() => window.history.replaceState(null, '', '/clients/'))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const STATS = {
  totalQueries: 1000, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
  totalAuthoritative: 0, totalRecursive: 0, totalCached: 0, totalBlocked: 10, totalDropped: 0,
  totalClients: 3, zones: 0, cachedEntries: 0, allowedZones: 0, blockedZones: 0, allowListZones: 0, blockListZones: 0,
}
const MAIN = { labels: ['a'], datasets: [{ label: 'Total', data: [1] }] }
function statsOk(stats = STATS) {
  return {
    kind: 'ok' as const,
    data: {
      stats, mainChartData: MAIN, queryResponseChartData: MAIN, queryTypeChartData: MAIN,
      protocolTypeChartData: MAIN, topClients: [], topDomains: [], topBlockedDomains: [],
    },
  }
}
const TOP = [
  { name: '10.0.0.1', hits: 600, domain: 'phone.home.arpa' },
  { name: '10.0.0.2', hits: 395, domain: '' },
  { name: '10.0.0.10', hits: 5, domain: 'tv.home.arpa' },
]

let row = 0
function entry(
  clientIpAddress: string,
  responseType = 'Recursive',
  qname = 'example.com',
  extra: Partial<QueryLogEntry> = {},
): QueryLogEntry {
  row++
  return {
    rowNumber: row, timestamp: '2026-11-06T10:00:00Z', clientIpAddress, protocol: 'Udp', responseType,
    rcode: 'NoError', qname, qtype: 'A', qclass: 'IN', answer: null, ...extra,
  }
}
/* 10.0.0.2: ten queries in the sample, three blocked: High block rate. 10.0.0.1: ten, one. */
const SAMPLE_ENTRIES = [
  ...Array.from({ length: 3 }, () => entry('10.0.0.2', 'Blocked')),
  ...Array.from({ length: 7 }, () => entry('10.0.0.2')),
  entry('10.0.0.1', 'Blocked'),
  ...Array.from({ length: 9 }, () => entry('10.0.0.1')),
]
const CLIENT_ENTRIES = [
  entry('10.0.0.1', 'Blocked', 'ads.example', { rcode: 'NxDomain', timestamp: '2026-11-06T10:00:02Z' }),
  entry('10.0.0.1', 'Recursive', 'example.com', { responseRtt: 40, timestamp: '2026-11-06T10:00:01Z' }),
  entry('10.0.0.1', 'Cached', 'example.com', { timestamp: '2026-11-06T10:00:00Z' }),
  entry('10.0.0.1', 'Recursive', 'example.org', { responseRtt: 10, protocol: 'Tcp', timestamp: '2026-11-06T09:59:59Z' }),
]

const LOG_APP = {
  name: 'Query Logs (Sqlite)',
  dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }],
}

const LEASE = {
  scope: 'Home', type: 'Reserved', hardwareAddress: 'AA-BB-CC-DD-EE-FF', clientIdentifier: '1-aabbccddeeff',
  address: '10.0.0.1', hostName: 'pixel', leaseObtained: '', leaseExpires: '',
}

function serve({ withApp = true, sample = SAMPLE_ENTRIES, top = TOP, stats = STATS, leases = [LEASE] } = {}) {
  const get = vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue(statsOk(stats))
  const tops = vi.spyOn(dashboard, 'readTop').mockResolvedValue({ kind: 'ok', data: top })
  const list = vi.spyOn(apps, 'listApps').mockResolvedValue(
    { kind: 'ok', data: { response: { apps: withApp ? [LOG_APP] : [] } } } as never,
  )
  const newest = vi.spyOn(logs, 'newestQueries').mockImplementation(async (_t, _a, o) => ({
    kind: 'ok',
    data: o.clientIpAddress ? CLIENT_ENTRIES.filter((e) => e.clientIpAddress === o.clientIpAddress) : sample,
  }))
  const lease = vi.spyOn(dhcp, 'listLeases').mockResolvedValue({ kind: 'ok', data: leases })
  const read = vi.spyOn(settings, 'readSettings').mockResolvedValue(
    { kind: 'ok', data: { blockingBypassList: [], qpmLimitBypassList: [] } } as never,
  )
  return { get, tops, list, newest, lease, read }
}

/** Narrow (`--bp-wide` and under): the list and the card take turns. */
function narrowScreen() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(max-width: 1180px)',
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function nav(): Handoff {
  return { queryDnsServer: vi.fn(), showQueryLogs: vi.fn() }
}

function draw(props: Partial<Parameters<typeof Clients>[0]> = {}, handoff: Handoff | null = null) {
  const ui = <Clients token="T" permissions={undefined} {...props} />
  return render(handoff != null ? <HandoffContext.Provider value={handoff}>{ui}</HandoffContext.Provider> : ui)
}

/** The list's names, in order, once the sample has landed. */
async function listed(withSample = true) {
  const list = await screen.findByRole('list', { name: 'Clients' })
  if (withSample) await screen.findAllByText(/% blocked$/)
  return within(list).getAllByRole('button').map((b) => b.querySelector('span:nth-child(2) > span')?.textContent)
}

const params = () => new URLSearchParams(window.location.search)

describe('Clients', () => {
  it('asks for the period stats, the Top Clients of More, the newest queries of the log and the leases', async () => {
    const { get, tops, newest, lease } = serve()
    draw()
    await listed()
    expect(get).toHaveBeenCalledWith('T', 'LastHour', undefined, 'cluster')
    expect(tops).toHaveBeenCalledWith('T', 'LastHour', 'TopClients', LIMIT, 'cluster')
    /* Without a cluster the log and the leases are this server's. */
    expect(newest).toHaveBeenCalledWith('T', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, {
      node: '', limit: SAMPLE, clientIpAddress: '',
    })
    expect(lease).toHaveBeenCalledWith('T', '')
  })

  it('the strip and the share bar: the busiest clients with what they cover, a click opens one', async () => {
    serve()
    draw()
    expect(await screen.findByText('600 queries, 60.00% of total')).toBeInTheDocument()
    expect(await screen.findByText('3 blocked in the last 20 queries')).toBeInTheDocument()
    expect(screen.getByText('1,000 queries. The 3 busiest clients are shown, covering 100% of the traffic.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '10.0.0.2: 395 queries (39.50%)' }))
    expect(params().get('client')).toBe('10.0.0.2')
    expect(screen.getByRole('button', { name: '10.0.0.2: 395 queries (39.50%)' })).toHaveAttribute('aria-current', 'true')
  })

  it('a line: the name and address, its queries, its blocked share and the tags the sample proves', async () => {
    serve()
    draw()
    expect(await listed()).toEqual(['phone.home.arpa', '10.0.0.2', 'tv.home.arpa'])
    const line = (name: string) => within(screen.getByRole('list', { name: 'Clients' })).getByRole('button', { name: new RegExp(name) })
    expect(line('phone.home.arpa')).toHaveTextContent('10.0.0.1')
    expect(line('phone.home.arpa')).toHaveTextContent('600')
    expect(line('phone.home.arpa')).toHaveTextContent('10% blocked')
    expect(within(line('phone.home.arpa')).queryByText('High block rate')).not.toBeInTheDocument()
    expect(within(line('^10.0.0.2')).getByText('High block rate')).toBeInTheDocument()
    expect(line('^10.0.0.2')).toHaveTextContent('30% blocked')
    /* Not in the sample: no share at all, not zero. */
    expect(line('tv.home.arpa')).not.toHaveTextContent('blocked')
  })

  it('filters with their counts, the order and the search live in the address bar, written by replacing the entry', async () => {
    serve()
    draw()
    await listed()
    const before = window.history.length
    expect(screen.getByRole('button', { name: 'High block rate 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quiet 1' }))
    expect(params().get('filter')).toBe('quiet')
    expect(await listed(false)).toEqual(['tv.home.arpa'])
    await userEvent.click(screen.getByRole('button', { name: 'All 3' }))
    expect(params().get('filter')).toBeNull()
    await userEvent.click(screen.getByLabelText('Sort by'))
    await userEvent.click(screen.getByRole('option', { name: 'Most blocked' }))
    expect(params().get('sort')).toBe('blocked')
    expect(await listed()).toEqual(['10.0.0.2', 'phone.home.arpa', 'tv.home.arpa'])
    await userEvent.type(screen.getByLabelText('Search'), 'home')
    expect(params().get('q')).toBe('home')
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(window.history.length).toBe(before)
  })

  it('arrives on the view the bar names, and drops it when the page goes', async () => {
    window.history.replaceState(null, '', '/clients/?q=tv&sort=name&filter=quiet&x=1')
    serve()
    const { unmount } = draw()
    expect(await listed(false)).toEqual(['tv.home.arpa'])
    expect(screen.getByLabelText('Search')).toHaveValue('tv')
    unmount()
    expect(window.location.search).toBe('?x=1')
  })

  it('wide, the first client is open with nothing in the bar, and a line opens another', async () => {
    const { newest } = serve()
    draw()
    await listed()
    expect(await screen.findByRole('heading', { level: 2, name: 'phone.home.arpa' })).toBeInTheDocument()
    expect(params().get('client')).toBeNull()
    expect(newest).toHaveBeenCalledWith('T', expect.anything(), { node: '', limit: DETAIL_SAMPLE, clientIpAddress: '10.0.0.1' })
    await userEvent.click(within(screen.getByRole('list', { name: 'Clients' })).getByRole('button', { name: /^10.0.0.2/ }))
    expect(params().get('client')).toBe('10.0.0.2')
    expect(await screen.findByRole('heading', { level: 2, name: '10.0.0.2' })).toBeInTheDocument()
  })

  it('the card: its lease, its figures from its own sample with the median and the cache rate, and its jumps', async () => {
    serve()
    const handoff = nav()
    draw({}, handoff)
    const card = await screen.findByRole('region', { name: 'phone.home.arpa' })
    expect(await within(card).findByText('In the latest 4 queries')).toBeInTheDocument()
    /* The lease that hands out its address. */
    expect(within(card).getByText('AA-BB-CC-DD-EE-FF')).toBeInTheDocument()
    expect(within(card).getByText('pixel')).toBeInTheDocument()
    expect(within(card).getByText('Home')).toBeInTheDocument()
    const figure = (title: string) => within(card).getByText(title, { selector: 'h2' }).closest('section')!
    expect(figure('Queries')).toHaveTextContent('4')
    expect(figure('Blocked')).toHaveTextContent('25.00%')
    expect(figure('Cache hit rate')).toHaveTextContent('25.00%')
    /* The two timed answers, 10 and 40 ms: the median of two is their mean. */
    expect(figure('Median response time')).toHaveTextContent('25.0 ms')
    expect(figure('Median response time')).toHaveTextContent('of 2 timed')
    expect(within(card).getByRole('heading', { name: 'The latest 4 queries over time' })).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'example.com: 2' })).toBeInTheDocument()
    expect(within(card).getAllByRole('img', { name: 'ads.example: 1' })).toHaveLength(2)
    /* Latest Queries: newest first, the time in ms or the placeholder. */
    const table = within(card).getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('ads.example')
    expect(within(rows[0]).getByText('Blocked')).toBeInTheDocument()
    expect(rows[0]).toHaveTextContent('—')
    expect(rows[1]).toHaveTextContent('40.00 ms')
    await userEvent.click(within(card).getByRole('button', { name: 'Show Query Logs' }))
    expect(handoff.showQueryLogs).toHaveBeenCalledWith(null, '10.0.0.1', 'cluster')
    await userEvent.click(within(card).getByRole('button', { name: 'Actions for example.com' }))
    expect(screen.getByRole('menuitem', { name: 'Block Domain' })).toBeInTheDocument()
  })

  it('no timed answer, no median cell; no lease and no DHCP permission, no lease facts and no read', async () => {
    const { lease } = serve()
    vi.spyOn(logs, 'newestQueries').mockImplementation(async (_t, _a, o) => ({
      kind: 'ok', data: o.clientIpAddress ? [entry(o.clientIpAddress, 'Cached')] : SAMPLE_ENTRIES,
    }))
    draw({ permissions: { DhcpServer: { canView: false, canModify: false, canDelete: false } } })
    const card = await screen.findByRole('region', { name: 'phone.home.arpa' })
    expect(await within(card).findByText('In the latest query')).toBeInTheDocument()
    expect(within(card).queryByText('Median response time')).not.toBeInTheDocument()
    expect(within(card).queryByText('MAC')).not.toBeInTheDocument()
    expect(lease).not.toHaveBeenCalled()
  })

  it('the card carries its Actions: the lists read where they live, the lease read again after a conversion', async () => {
    const { read, lease } = serve()
    vi.spyOn(dhcp, 'convertToDynamicLease').mockResolvedValue({ kind: 'ok', data: {} })
    draw({ clusterInitialised: true, nodes: [{ name: 'dns1', type: 'Primary' }] as never })
    const card = await screen.findByRole('region', { name: 'phone.home.arpa' })
    /* The two lists are cluster-wide: read on the cluster, as Blocking › Lists. */
    expect(read).toHaveBeenCalledWith('T', 'cluster')
    const actions = within(card).getByRole('region', { name: 'Actions' })
    expect(await within(actions).findByRole('button', { name: 'Bypass Blocking' })).toBeEnabled()
    /* The page's lease is a reserved one: the inverse is offered. */
    await userEvent.click(within(actions).getByRole('button', { name: 'Convert To Dynamic Lease' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Convert' }))
    expect(await screen.findByText('The reserved lease was converted to dynamic lease successfully.')).toBeInTheDocument()
    expect(lease).toHaveBeenCalledTimes(2)
  })

  it('narrow, the list takes the width, a client is a page of its own with Clients to come back', async () => {
    narrowScreen()
    serve()
    draw()
    await listed()
    expect(screen.queryByRole('region', { name: 'phone.home.arpa' })).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('list', { name: 'Clients' })).getByRole('button', { name: /^10.0.0.2/ }))
    expect(params().get('client')).toBe('10.0.0.2')
    expect(screen.getByRole('heading', { level: 1, name: '10.0.0.2' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Clients' })).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'Clients' }))
    expect(params().get('client')).toBeNull()
    expect(await screen.findByRole('list', { name: 'Clients' })).toBeInTheDocument()
  })

  it('a link naming a client the period does not list drops it', async () => {
    window.history.replaceState(null, '', '/clients/?client=10.9.9.9')
    serve()
    draw()
    await listed()
    await waitFor(() => expect(params().get('client')).toBeNull())
  })

  it('without a query logs app it says so once, the period still draws, and High block rate is not offered', async () => {
    const { newest } = serve({ withApp: false })
    draw()
    expect(await screen.findByText(/Please install the 'Query Logs \(Sqlite\)' DNS App/)).toBeInTheDocument()
    expect(await listed(false)).toEqual(['phone.home.arpa', '10.0.0.2', 'tv.home.arpa'])
    expect(screen.queryByRole('button', { name: /^High block rate/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Most Blocked')).not.toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'phone.home.arpa' })
    expect(within(card).getByText('No query logging app')).toBeInTheDocument()
    expect(newest).not.toHaveBeenCalled()
  })

  it('without Logs: View the log cells and the card keep their place, locked, and nothing reads the log', async () => {
    const { list, newest } = serve()
    draw({ permissions: { Logs: { canView: false, canModify: false, canDelete: false } } })
    await listed(false)
    expect(screen.getByText('Most Blocked')).toBeInTheDocument()
    expect(screen.getAllByText('Requires Logs: View')).toHaveLength(3)
    expect(list).not.toHaveBeenCalled()
    expect(newest).not.toHaveBeenCalled()
  })

  it('an empty period says so, in the list and in the strip', async () => {
    serve({ top: [], sample: [], stats: { ...STATS, totalQueries: 0, totalClients: 0 } })
    draw()
    expect(await screen.findByText('No clients for this period.')).toBeInTheDocument()
    expect(screen.getByText('No queries for this period.')).toBeInTheDocument()
    expect(screen.queryByText('Queries by client')).not.toBeInTheDocument()
  })

  it('a failed read says so with the server message, not that there are no clients', async () => {
    vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'Boom' })
    vi.spyOn(dashboard, 'readTop').mockResolvedValue({ kind: 'ok', data: [] })
    vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { response: { apps: [] } } } as never)
    vi.spyOn(dhcp, 'listLeases').mockResolvedValue({ kind: 'ok', data: [] })
    vi.spyOn(settings, 'readSettings').mockReturnValue(new Promise(() => {}))
    draw()
    expect(await screen.findByText('Boom')).toBeInTheDocument()
    expect(screen.getAllByText('Could not load this data.').length).toBeGreaterThan(0)
    expect(screen.queryByText('No clients for this period.')).not.toBeInTheDocument()
  })

  it('while it loads the list says so', () => {
    vi.spyOn(dashboard, 'getDashboardStats').mockReturnValue(new Promise(() => {}))
    vi.spyOn(dashboard, 'readTop').mockReturnValue(new Promise(() => {}))
    vi.spyOn(apps, 'listApps').mockReturnValue(new Promise(() => {}))
    vi.spyOn(dhcp, 'listLeases').mockReturnValue(new Promise(() => {}))
    vi.spyOn(settings, 'readSettings').mockReturnValue(new Promise(() => {}))
    draw()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('a new period is asked for at once', async () => {
    const { tops } = serve()
    draw()
    await listed()
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    expect(tops).toHaveBeenCalledWith('T', 'LastDay', 'TopClients', LIMIT, 'cluster')
  })
})
