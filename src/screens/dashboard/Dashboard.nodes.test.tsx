/*
Deviation 36 on the screen: the Queries card compared by node. What it asks (the
period's `dashboard/stats/get` once per node, with that node), what it draws (one
line per node, the aggregate's hidden), a node that fails, where the switch is
kept, when it is offered, and that the lines move with the minute reload only.

`./Chart` is doubled, as in `Dashboard.compare.test.tsx`, so the series handed to
the canvas can be read: jsdom has no canvas.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'
import type { ChartData } from '../../api/dashboard'

const charts = new Map<string, { data: ChartData; series?: (label: string, i: number) => string }>()
vi.mock('./Chart', () => ({
  Chart: (props: { aria: string; data: ChartData; series?: (label: string, i: number) => string }) => {
    charts.set(props.aria, props)
    return <div data-testid={`chart-${props.aria}`} />
  },
}))

const NODES = [
  { name: 'ns1.test', type: 'Primary' },
  { name: 'ns2.test', type: 'Secondary' },
  { name: 'ns3.test', type: 'Secondary' },
]

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  charts.clear()
  localStorage.removeItem('dashboardClusterNode')
  localStorage.removeItem('dashboardCompareNodes')
})
beforeEach(() => {
  vi.spyOn(api, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not stubbed' })
})

const MIN = 60_000
const LAST = Date.UTC(2026, 10, 6, 10, 0)
const SERIES = ['Total', 'No Error', 'Server Failure', 'NX Domain', 'Refused', 'Authoritative',
  'Recursive', 'Cached', 'Blocked', 'Dropped', 'Clients']

/* A Last Hour answer, `per` queries a minute, ending at `last`. */
function hour(per: number, last = LAST) {
  const instants = Array.from({ length: 60 }, (_, i) => new Date(last - (59 - i) * MIN).toISOString())
  return {
    stats: {
      totalQueries: 60 * per, totalNoError: 60 * per, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
      totalAuthoritative: 0, totalRecursive: 0, totalCached: 0, totalBlocked: 0, totalDropped: 0,
      totalClients: 1, zones: 1, cachedEntries: 1, allowedZones: 0, blockedZones: 0,
      allowListZones: 0, blockListZones: 0,
    },
    mainChartData: {
      labelFormat: 'HH:mm',
      labels: instants,
      instants,
      datasets: SERIES.map((label) => ({ label, data: instants.map(() => (label === 'Total' || label === 'No Error' ? per : 0)) })),
    },
    queryResponseChartData: { labels: ['Authoritative'], datasets: [{ label: '', data: [1] }] },
    queryTypeChartData: { labels: ['A'], datasets: [{ label: '', data: [1] }] },
    protocolTypeChartData: { labels: ['Udp'], datasets: [{ label: '', data: [1] }] },
    topClients: [], topDomains: [], topBlockedDomains: [],
  }
}

const PER: Record<string, number> = { cluster: 9, 'ns1.test': 5, 'ns2.test': 4 }

/* Each node its own answer, ns3 failing; the aggregate the sum. */
function serve({ failing = ['ns3.test'] }: { failing?: string[] } = {}) {
  return vi.spyOn(api, 'getDashboardStats').mockImplementation(async (_t, _type, _range, node) => {
    if (node != null && failing.includes(node)) return { kind: 'error', message: `${node} did not answer.` }
    return { kind: 'ok', data: hour(PER[node ?? 'cluster'] ?? 9) } as never
  })
}

const perNode = (spy: ReturnType<typeof serve>, node: string) =>
  spy.mock.calls.filter((c) => c[3] === node && c[1] !== 'Custom')
const queries = () => charts.get('Queries over time')!

describe('Dashboard: the Queries compared by node', () => {
  it('offers the switch on a cluster with the aggregate chosen, off by default', async () => {
    serve()
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    const button = await screen.findByRole('button', { name: 'Compare nodes' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(queries().data.datasets.map((d) => d.label)).toContain('Total')
  })

  it('asks the period once per node, with each node, and draws one line per node', async () => {
    const spy = serve()
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Compare nodes' }))
    await screen.findByText(/Left out/)
    for (const n of NODES) {
      const calls = perNode(spy, n.name)
      expect(calls).toHaveLength(1)
      expect(calls[0][1]).toBe('LastHour')
    }
    const data = queries().data
    /* The aggregate's line is hidden: only the nodes that answered. */
    expect(data.datasets.map((d) => d.label)).toEqual(['ns1.test', 'ns2.test'])
    expect(data.datasets[0].data.every((v) => v === 5)).toBe(true)
    expect(data.datasets[1].data.every((v) => v === 4)).toBe(true)
    expect(screen.getByRole('button', { name: 'Compare nodes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('names the node that failed and leaves it out', async () => {
    serve()
    localStorage.setItem('dashboardCompareNodes', 'true')
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    expect(await screen.findByText('Left out: could not read ns3.test.')).toBeInTheDocument()
    expect(queries().data.datasets.map((d) => d.label)).not.toContain('ns3.test')
  })

  it('each node keeps its own colour whatever else failed', async () => {
    serve({ failing: ['ns1.test'] })
    localStorage.setItem('dashboardCompareNodes', 'true')
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    await screen.findByText('Left out: could not read ns1.test.')
    const { data, series } = queries()
    expect(data.datasets.map((d) => d.label)).toEqual(['ns2.test', 'ns3.test'])
    /* ns2 is second in the session's list: the second series colour, not the first. */
    expect(series!('ns2.test', 0)).toBe('--ch-2')
    expect(series!('ns3.test', 1)).toBe('--ch-3')
    expect(screen.getByRole('button', { name: /^ns2\.test/ }).querySelector('i')).toHaveStyle({ background: 'var(--ch-2)' })
  })

  it('says it could not load when no node answered', async () => {
    serve({ failing: NODES.map((n) => n.name) })
    localStorage.setItem('dashboardCompareNodes', 'true')
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    expect(await screen.findByText('Left out: could not read ns1.test, ns2.test, ns3.test.')).toBeInTheDocument()
    const card = screen.getByRole('heading', { name: 'Queries' }).parentElement!.parentElement!
    expect(card).toHaveTextContent('Could not load this data.')
    expect(screen.queryByTestId('chart-Queries over time')).not.toBeInTheDocument()
  })

  it('is kept in localStorage, and turning it off brings the aggregate back', async () => {
    serve()
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Compare nodes' }))
    expect(localStorage.getItem('dashboardCompareNodes')).toBe('true')
    await screen.findByText(/Left out/)
    await userEvent.click(screen.getByRole('button', { name: 'Compare nodes' }))
    expect(localStorage.getItem('dashboardCompareNodes')).toBeNull()
    expect(queries().data.datasets.map((d) => d.label)).toContain('Total')
    expect(screen.queryByText(/Left out/)).not.toBeInTheDocument()
  })

  it('is not offered on one node, and a choice left on does not ask the nodes', async () => {
    localStorage.setItem('dashboardCompareNodes', 'true')
    localStorage.setItem('dashboardClusterNode', 'ns2.test')
    const spy = serve()
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    await screen.findByTestId('chart-Queries over time')
    expect(screen.queryByRole('button', { name: 'Compare nodes' })).not.toBeInTheDocument()
    expect(perNode(spy, 'ns1.test')).toHaveLength(0)
    expect(queries().data.datasets.map((d) => d.label)).toContain('Total')
  })

  it('without a cluster nothing changes', async () => {
    localStorage.setItem('dashboardCompareNodes', 'true')
    const spy = serve()
    render(<Dashboard token="t" />)
    await screen.findByTestId('chart-Queries over time')
    expect(screen.queryByRole('button', { name: 'Compare nodes' })).not.toBeInTheDocument()
    expect(spy.mock.calls.filter((c) => c[1] !== 'Custom').every((c) => c[3] === 'cluster' || c[3] == null)).toBe(true)
    expect(queries().data.datasets.map((d) => d.label)).toContain('Total')
  })

  it('a new period asks every node for that period', async () => {
    const spy = serve()
    localStorage.setItem('dashboardCompareNodes', 'true')
    render(<Dashboard token="t" clusterInitialised nodes={NODES} />)
    await screen.findByText(/Left out/)
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    await vi.waitFor(() => expect(perNode(spy, 'ns2.test').map((c) => c[1])).toEqual(['LastHour', 'LastDay']))
  })
})

describe('Dashboard: the compared lines and Last Hour', () => {
  const counters = (q: number) => ({
    kind: 'ok' as const,
    data: {
      uptimestamp: 'u1',
      lifetimeCounters: {
        totalQueries: q, totalNoError: q, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
        totalAuthoritative: 0, totalRecursive: 0, totalCached: 0, totalBlocked: 0, totalDropped: 0,
        totalClients: 1,
      },
    },
  })

  it('reload with the minute, not with the live 2 s, while the tiles stay live', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(LAST + 20_000)
    const spy = serve({ failing: [] })
    let q = 100
    vi.spyOn(api, 'getMetrics').mockImplementation(async () => counters((q += 7)))
    localStorage.setItem('dashboardCompareNodes', 'true')
    render(<Dashboard token="t" clusterInitialised nodes={NODES.slice(0, 2)} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    const first = queries().data
    expect(first.datasets.map((d) => d.label)).toEqual(['ns1.test', 'ns2.test'])
    expect(perNode(spy, 'ns1.test')).toHaveLength(1)
    const tiles = screen.getByTestId('metrics')
    const total = () => within(tiles).getByText('Total Queries').parentElement!.textContent
    expect(total()).toContain((540).toLocaleString())

    /* Live readings for the aggregate arrive; the compared lines do not move. */
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000) })
    expect(api.getMetrics).toHaveBeenCalled()
    expect(perNode(spy, 'ns1.test')).toHaveLength(1)
    expect(queries().data.datasets[0].data).toEqual(first.datasets[0].data)
    /* The tiles do: Total Queries is past the aggregate's 540. */
    expect(total()).not.toContain((540).toLocaleString())

    /* The minute reload asks every node again. */
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(perNode(spy, 'ns1.test')).toHaveLength(2)
    expect(perNode(spy, 'ns2.test')).toHaveLength(2)
  })
})
