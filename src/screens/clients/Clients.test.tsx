import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as dashboard from '../../api/dashboard'
import * as apps from '../../api/apps'
import * as logs from '../../api/logs'
import type { QueryLogEntry } from '../../api/logs'
import { HandoffContext, type Handoff } from '../../app/handoff'
import { SAMPLE } from '../blocking/blocked-sample'
import { Clients } from './Clients'
import { DETAIL_SAMPLE, LIMIT } from './clients-model'

beforeEach(() => window.history.replaceState(null, '', '/clients/'))
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

const STATS = {
  totalQueries: 100, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
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
  { name: '10.0.0.1', hits: 60, domain: 'phone.home.arpa' },
  { name: '10.0.0.2', hits: 30, domain: '' },
  { name: '10.0.0.10', hits: 10, domain: 'tv.home.arpa' },
]

let row = 0
function entry(clientIpAddress: string, responseType = 'Recursive', qname = 'example.com', qtype = 'A'): QueryLogEntry {
  row++
  return {
    rowNumber: row, timestamp: '2026-11-06T10:00:00Z', clientIpAddress, protocol: 'Udp', responseType,
    rcode: 'NoError', qname, qtype, qclass: 'IN', answer: null,
  }
}
const SAMPLE_ENTRIES = [
  entry('10.0.0.2', 'Blocked'), entry('10.0.0.2', 'UpstreamBlocked'), entry('10.0.0.1', 'Blocked'),
  entry('10.0.0.1'), entry('10.0.0.1'),
]
const CLIENT_ENTRIES = [
  entry('10.0.0.1', 'Blocked', 'ads.example'), entry('10.0.0.1', 'Recursive', 'example.com', 'AAAA'),
  entry('10.0.0.1', 'Cached', 'example.com'),
]

const LOG_APP = {
  name: 'Query Logs (Sqlite)',
  dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }],
}

function serve({ withApp = true, sample = SAMPLE_ENTRIES, top = TOP, stats = STATS } = {}) {
  const get = vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue(statsOk(stats))
  const tops = vi.spyOn(dashboard, 'readTop').mockResolvedValue({ kind: 'ok', data: top })
  const list = vi.spyOn(apps, 'listApps').mockResolvedValue(
    { kind: 'ok', data: { response: { apps: withApp ? [LOG_APP] : [] } } } as never,
  )
  const newest = vi.spyOn(logs, 'newestQueries').mockImplementation(async (_t, _a, o) => ({
    kind: 'ok',
    data: o.clientIpAddress ? CLIENT_ENTRIES.filter((e) => e.clientIpAddress === o.clientIpAddress) : sample,
  }))
  return { get, tops, list, newest }
}

function nav(): Handoff {
  return { queryDnsServer: vi.fn(), showQueryLogs: vi.fn() }
}

function draw(props: Partial<Parameters<typeof Clients>[0]> = {}, handoff: Handoff | null = null) {
  const ui = <Clients token="T" permissions={undefined} {...props} />
  return render(handoff != null ? <HandoffContext.Provider value={handoff}>{ui}</HandoffContext.Provider> : ui)
}

/** The table's data rows, by their client cell. */
async function clientsInTable(withSample = true) {
  await screen.findByText('3 clients')
  if (withSample) await screen.findByText('Blocked: in the last 5 queries')
  const table = screen.getByRole('table')
  return within(table).getAllByRole('row').slice(1).map((r) => r.querySelector('td')?.textContent)
}

describe('Clients', () => {
  it('asks for the period stats and the Top Clients of More, then the newest queries of the log', async () => {
    const { get, tops, newest } = serve()
    draw()
    await screen.findByText('3 clients')
    expect(get).toHaveBeenCalledWith('T', 'LastHour', undefined, 'cluster')
    expect(tops).toHaveBeenCalledWith('T', 'LastHour', 'TopClients', LIMIT, 'cluster')
    expect(LIMIT).toBe(1000)
    expect(newest).toHaveBeenCalledWith('T', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, {
      node: 'cluster', limit: SAMPLE, clientIpAddress: '',
    })
  })

  it('the strip: clients, the most active with its share, the most blocked and the blocked share of the sample', async () => {
    serve()
    draw()
    expect(await screen.findByText('60 queries, 60.00% of total')).toBeInTheDocument()
    expect(await screen.findByText('2 blocked in the last 5 queries')).toBeInTheDocument()
    expect(within(screen.getByText('Blocked Share').closest('section')!).getByText('60.00%')).toBeInTheDocument()
    expect(screen.getAllByText('In the last 5 queries').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: 'Blocked 3, Allowed 2' })).toBeInTheDocument()
    expect(screen.getByText('Blocked: in the last 5 queries')).toBeInTheDocument()
  })

  it('one line per client with its share, its queries and its blocked count in the sample', async () => {
    serve()
    draw()
    expect(await clientsInTable()).toEqual(['10.0.0.1', '10.0.0.2', '10.0.0.10'])
    const cells = (ip: string) =>
      [...screen.getByText(ip, { selector: 'td' }).closest('tr')!.querySelectorAll('td')].map((c) => c.textContent)
    expect(cells('10.0.0.1').slice(0, 5)).toEqual(['10.0.0.1', 'phone.home.arpa', '60.00%', '60', '1'])
    expect(cells('10.0.0.2').slice(0, 5)).toEqual(['10.0.0.2', '', '30.00%', '30', '2'])
    /* Not in the sample: the placeholder, not a zero. */
    expect(cells('10.0.0.10')[4]).toBe('—')
  })

  it('search, order and page live in the address bar, written by replacing the entry', async () => {
    serve()
    draw()
    await clientsInTable()
    const before = window.history.length
    await userEvent.type(screen.getByLabelText('Search'), 'home')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('home')
    expect(await screen.findByText('3 clients, 2 shown')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Search'))
    /* Drawn most first, so the first click on Queries sorts ascending. */
    await userEvent.click(screen.getByRole('button', { name: /Queries/ }))
    expect(new URLSearchParams(window.location.search).get('sort')).toBe('queries')
    expect(await clientsInTable()).toEqual(['10.0.0.10', '10.0.0.2', '10.0.0.1'])
    /* Already ascending as drawn (addresses in natural order): descending. */
    await userEvent.click(screen.getByRole('button', { name: /^Client/ }))
    expect(new URLSearchParams(window.location.search).get('sort')).toBe('client')
    await userEvent.click(screen.getByRole('button', { name: /^Client/ }))
    expect(new URLSearchParams(window.location.search).get('sort')).toBe('-client')
    expect(await clientsInTable()).toEqual(['10.0.0.10', '10.0.0.2', '10.0.0.1'])
    expect(window.history.length).toBe(before)
  })

  it('arrives on the view the bar names, and drops it when the page goes', async () => {
    window.history.replaceState(null, '', '/clients/?q=tv&sort=-queries&x=1')
    serve()
    const { unmount } = draw()
    expect(await screen.findByText('3 clients, 1 shown')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toHaveValue('tv')
    unmount()
    expect(window.location.search).toBe('?x=1')
  })

  it('a row opens its client from the log, with what it is based on, and the open client is in the bar', async () => {
    const { newest } = serve()
    const handoff = nav()
    draw({}, handoff)
    await clientsInTable()
    const first = screen.getByText('10.0.0.1', { selector: 'td' }).closest('tr')!
    await userEvent.click(within(first).getByRole('button', { name: 'Details' }))
    expect(new URLSearchParams(window.location.search).get('client')).toBe('10.0.0.1')
    expect(await screen.findByText('In the last 3 queries')).toBeInTheDocument()
    expect(newest).toHaveBeenCalledWith('T', expect.anything(), {
      node: 'cluster', limit: DETAIL_SAMPLE, clientIpAddress: '10.0.0.1',
    })
    const detail = screen.getByRole('group', { name: '10.0.0.1' })
    expect(within(detail).getByRole('heading', { name: 'Top Domains' })).toBeInTheDocument()
    expect(within(detail).getByRole('img', { name: 'example.com: 2' })).toBeInTheDocument()
    /* In both lists: asked for once, and blocked. */
    expect(within(detail).getAllByRole('img', { name: 'ads.example: 1' })).toHaveLength(2)
    expect(within(detail).getByText('Last query')).toBeInTheDocument()
    await userEvent.click(within(detail).getByRole('button', { name: 'Show Query Logs' }))
    expect(handoff.showQueryLogs).toHaveBeenCalledWith(null, '10.0.0.1', 'cluster')
    /* A domain carries Top Domains' menu. */
    await userEvent.click(within(detail).getByRole('button', { name: 'Actions for example.com' }))
    expect(screen.getByRole('menuitem', { name: 'Query DNS Server' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Block Domain' })).toBeInTheDocument()
  })

  it('a link naming a client opens it on arrival', async () => {
    window.history.replaceState(null, '', '/clients/?client=10.0.0.1')
    serve()
    draw()
    expect(await screen.findByRole('group', { name: '10.0.0.1' })).toBeInTheDocument()
  })

  it('a link naming a client the period does not list drops it', async () => {
    window.history.replaceState(null, '', '/clients/?client=10.9.9.9')
    serve()
    draw()
    await clientsInTable()
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('client')).toBeNull())
  })

  it('without a query logs app it says so once, and the period still draws', async () => {
    const { newest } = serve({ withApp: false })
    draw()
    expect(await screen.findByText('No query logging app')).toBeInTheDocument()
    expect(screen.getByText(/Please install the 'Query Logs \(Sqlite\)' DNS App/)).toBeInTheDocument()
    expect(await clientsInTable(false)).toEqual(['10.0.0.1', '10.0.0.2', '10.0.0.10'])
    expect(screen.queryByRole('button', { name: /Blocked/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Most Blocked')).not.toBeInTheDocument()
    expect(newest).not.toHaveBeenCalled()
  })

  it('without Logs: View the log cells keep their place, locked, and nothing reads the log', async () => {
    const { list, newest } = serve()
    draw({ permissions: { Logs: { canView: false, canModify: false, canDelete: false } } })
    await clientsInTable(false)
    expect(screen.getByText('Most Blocked')).toBeInTheDocument()
    expect(screen.getAllByText('Requires Logs: View')).toHaveLength(2)
    expect(list).not.toHaveBeenCalled()
    expect(newest).not.toHaveBeenCalled()
  })

  it('an empty period says so, in the table and in the strip', async () => {
    serve({ top: [], sample: [], stats: { ...STATS, totalQueries: 0, totalClients: 0 } })
    draw()
    expect(await screen.findByText('No clients for this period.')).toBeInTheDocument()
    expect(screen.getByText('No queries for this period.')).toBeInTheDocument()
  })

  it('a failed read says so with the server message, not that there are no clients', async () => {
    vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'Boom' })
    vi.spyOn(dashboard, 'readTop').mockResolvedValue({ kind: 'ok', data: [] })
    vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { response: { apps: [] } } } as never)
    draw()
    expect(await screen.findByText('Boom')).toBeInTheDocument()
    expect(screen.getAllByText('Could not load this data.').length).toBeGreaterThan(0)
    expect(screen.queryByText('No clients for this period.')).not.toBeInTheDocument()
  })

  it('while it loads the table says so', async () => {
    vi.spyOn(dashboard, 'getDashboardStats').mockReturnValue(new Promise(() => {}))
    vi.spyOn(dashboard, 'readTop').mockReturnValue(new Promise(() => {}))
    vi.spyOn(apps, 'listApps').mockReturnValue(new Promise(() => {}))
    draw()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('a new period is asked for at once', async () => {
    const { tops } = serve()
    draw()
    await clientsInTable()
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    expect(tops).toHaveBeenCalledWith('T', 'LastDay', 'TopClients', LIMIT, 'cluster')
  })
})
