import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard, percentage } from './Dashboard'
import * as api from '../../api/dashboard'
import { formatLabel } from '../../api/chart-labels'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  /* The live Last Hour reads `dashboard/metrics/json`; by default it finds
     nothing and the Dashboard behaves as before. */
  vi.spyOn(api, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not stubbed' })
})

const chart = { labels: ['a', 'b'], datasets: [{ label: 'Total', data: [1, 2] }] }
const isEmpty = { labels: ['a'], datasets: [{ label: 'Total', data: [0] }] }
const data = {
  stats: {
    totalQueries: 48312, totalNoError: 41008, totalServerFailure: 36, totalNxDomain: 1204,
    totalRefused: 12, totalAuthoritative: 9517, totalRecursive: 7883, totalCached: 24860,
    totalBlocked: 6052, totalDropped: 0, totalClients: 27,
    zones: 14, cachedEntries: 8204, allowedZones: 3, blockedZones: 21,
    allowListZones: 0, blockListZones: 184302,
  },
  mainChartData: chart, queryResponseChartData: chart,
  queryTypeChartData: chart, protocolTypeChartData: chart,
  topClients: [{ name: '10.0.1.42', hits: 12408 }],
  topDomains: [{ name: 'github.com', hits: 3204 }],
  topBlockedDomains: [],
}

describe('percentage', () => {
  // `toFixed(2)`, with a dot, no locale and two decimals (main.js:2652-2676).
  it('two decimals and a dot, like upstream', () => {
    expect(percentage(41008, 48312)).toBe('84.88%')
    expect(percentage(36, 48312)).toBe('0.07%')
  })
  it('with no queries it is a literal \"0%\", not \"0.00%\"', () => {
    expect(percentage(0, 0)).toBe('0%')
  })
})

describe('Dashboard', () => {
  it('it draws the eleven metrics with their literal labels', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: data } as never)
    render(<Dashboard token="t" />)
    // "Blocked" and "Cache" also come out as server counters, so the search is
    // done inside the metric cards, not across the whole screen.
    const tiles = within(await screen.findByTestId('metrics'))
    for (const l of ['Total Queries','No Error','Server Failure','NX Domain','Refused','Authoritative','Recursive','Cached','Blocked','Dropped','Clients']) {
      expect(tiles.getByText(l)).toBeInTheDocument()
    }
    // The numbers go with the browser's locale because upstream does not pin one
    // either (main.js:2632). It is asserted this way so as not to nail the test to one.
    expect(tiles.getByText((48312).toLocaleString())).toBeInTheDocument()
    expect(tiles.getByText('84.88%')).toBeInTheDocument()
  })

  /*
  Upstream writes a fixed "100%" under "Total Queries" that its JavaScript never
  updates. Really calculated it gave "0%" with the server freshly started, which
  confuses more than it informs: the percentage is the share of the total, and the
  total has no share of itself.
  */
  it('the total tile carries no percentage, like the clients one', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: data } as never)
    render(<Dashboard token="t" />)
    const tiles = within(await screen.findByTestId('metrics'))
    expect(tiles.queryByText('100.00%')).not.toBeInTheDocument()
    expect(tiles.queryByText('100%')).not.toBeInTheDocument()
    // and the ones that do carry it still carry it
    expect(tiles.getByText('84.88%')).toBeInTheDocument()
  })

  it('it draws the six server counters', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: data } as never)
    render(<Dashboard token="t" />)
    const c = within(await screen.findByTestId('counters'))
    for (const l of ['Zones','Cache','Allowed','Blocked','Allow List','Block List']) {
      expect(c.getByText(l)).toBeInTheDocument()
    }
    expect(c.getByText((184302).toLocaleString())).toBeInTheDocument()
  })

  // Issue #2: the stylesheet shrinks a figure that would not fit its card, and
  // it needs the figure's length in characters to do so.
  it('every figure carries its length, so a long one can shrink to fit', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({
      kind: 'ok', data: { ...data, stats: { ...data.stats, blockListZones: 2551031 } },
    } as never)
    render(<Dashboard token="t" />)
    const c = within(await screen.findByTestId('counters'))
    const big = (2551031).toLocaleString()
    expect(c.getByText(big).style.getPropertyValue('--len')).toBe(String(big.length))
    const tiles = within(screen.getByTestId('metrics'))
    const total = (48312).toLocaleString()
    expect(tiles.getByText(total).style.getPropertyValue('--len')).toBe(String(total.length))
  })

  it('it offers the six ranges with their labels and starts on Last Hour', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: data } as never)
    render(<Dashboard token="t" />)
    const b = await screen.findByRole('button', { name: 'Last Hour' })
    expect(b).toHaveAttribute('aria-pressed', 'true')
    for (const l of ['Last Day','Last Week','Last Month','Last Year','Custom']) {
      expect(screen.getByRole('button', { name: l })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('changing range asks for the data again with that type', async () => {
    const spy = vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: data } as never)
    render(<Dashboard token="t" />)
    await screen.findByText('Total Queries')
    spy.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Last Week' }))
    expect(spy.mock.calls[0][1]).toBe('LastWeek')
  })

  it('refreshes Last Hour after each completed minute without overlapping requests', async () => {
    vi.useFakeTimers()
    let finishFirst!: (result: Awaited<ReturnType<typeof api.getDashboardStats>>) => void
    const first = new Promise<Awaited<ReturnType<typeof api.getDashboardStats>>>((resolve) => {
      finishFirst = resolve
    })
    const spy = vi.spyOn(api, 'getDashboardStats')
      .mockReturnValueOnce(first)
      .mockResolvedValue({ kind: 'ok', data } as never)

    render(<Dashboard token="t" />)
    expect(spy).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(spy).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishFirst({ kind: 'ok', data } as never)
      await first
    })
    expect(screen.getByLabelText('Queries over time')).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(59_999) })
    expect(spy).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('it draws all FOUR charts, not two', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: data } as never)
    render(<Dashboard token="t" />)
    expect(await screen.findByLabelText('Queries over time')).toBeInTheDocument()
    expect(screen.getByLabelText('Query Response Types')).toBeInTheDocument()
    expect(screen.getByLabelText('Query Types')).toBeInTheDocument()
    expect(screen.getByLabelText('Protocol Types')).toBeInTheDocument()
  })

  it('a chart with no data says there is none instead of leaving an empty canvas', async () => {
    /*
 The `{ kind, data }` wrapper was missing, and the test passed BY ACCIDENT: with no
 `kind: 'ok'` the component took the FAILURE branch, which until now drew the same
 text as the empty one. That is, the test was called "a chart with data" and was
 measuring the failure.

 It came out when the two states were separated, which is exactly what this test
 believed it was
    looking at.
    */
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({
      kind: 'ok',
      data: {
        ...data, mainChartData: isEmpty, queryResponseChartData: isEmpty,
        queryTypeChartData: isEmpty, protocolTypeChartData: isEmpty,
      },
    } as never)
    render(<Dashboard token="t" />)
    expect(await screen.findByText('No queries for this period.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Query Types')).not.toBeInTheDocument()
  })

  it('an empty Top list says so instead of staying blank', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: data } as never)
    render(<Dashboard token="t" />)
    expect(await screen.findByText('No data for this period.')).toBeInTheDocument()
  })

  /*
  This test settled for "it does not blow up", and not blowing up was exactly the
  problem: with the call fallen over the screen showed eleven zeros and "No
  queries for this period.", which is the same thing a DNS that has received
  nothing shows. Whoever administers a server and reads that concludes no traffic
  is reaching them.
  */
  it('if the call fails, it SAYS so, and does not pass itself off as a quiet server', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'boom' })
    render(<Dashboard token="t" />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
    // and the values come out as a dash, which is the honest thing: they are unknown
    expect(within(screen.getByTestId('metrics')).getAllByText('—').length).toBe(11)
  })

  it('an expired session is stated with its own text', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'invalid-token' })
    render(<Dashboard token="t" />)
    expect(await screen.findByText('Invalid token or session expired.')).toBeInTheDocument()
  })
})

describe('Dashboard: Last Hour in real time', () => {
  const live = (q: number, blocked = 0) => ({
    kind: 'ok' as const,
    data: {
      uptimestamp: 'u1',
      lifetimeCounters: {
        totalQueries: q, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
        totalAuthoritative: 0, totalRecursive: 0, totalCached: 0, totalBlocked: blocked, totalDropped: 0,
        totalClients: 1,
      },
    },
  })

  it('the Total Queries tile moves between reloads', async () => {
    vi.useFakeTimers()
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data } as never)
    vi.spyOn(api, 'getMetrics').mockResolvedValueOnce(live(1000)).mockResolvedValue(live(1005, 2))
    render(<Dashboard token="t" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText((48312).toLocaleString())).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(screen.getByText((48317).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText((6054).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText((27).toLocaleString())).toBeInTheDocument()
  })

  it('other periods do not read the counters', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data } as never)
    const spy = vi.spyOn(api, 'getMetrics').mockResolvedValue(live(1))
    render(<Dashboard token="t" />)
    await screen.findByText('Total Queries')
    await userEvent.click(screen.getByRole('button', { name: 'Last Week' }))
    spy.mockClear()
    await new Promise((r) => setTimeout(r, 2_100))
    expect(spy).not.toHaveBeenCalled()
  })

  it('with the cluster aggregate it reads every node by name', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data } as never)
    const spy = vi.spyOn(api, 'getMetrics').mockResolvedValue(live(1))
    localStorage.setItem('dashboardClusterNode', 'cluster')
    render(
      <Dashboard
        token="t"
        clusterInitialised
        nodes={[{ name: 'ns1.test' }, { name: 'ns2.test' }] as never}
      />,
    )
    await screen.findByText('Total Queries')
    await vi.waitFor(() => expect(spy.mock.calls.map((c) => c[1]).sort()).toEqual(['ns1.test', 'ns2.test']))
    localStorage.removeItem('dashboardClusterNode')
  })

  it('with the tab hidden the minute refresh waits, and coming back reloads at once', async () => {
    vi.useFakeTimers()
    let hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    const spy = vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data } as never)
    render(<Dashboard token="t" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(spy).toHaveBeenCalledTimes(1)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000) })
    expect(spy).toHaveBeenCalledTimes(1)
    hidden = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('Dashboard: the minute reload keeps what the server has not counted yet', () => {
  it('the tile does not fall back when the reload arrives before the server consolidates the minute', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 9, 3, 19, 42, 10))
    /* As the server answers: minutes labelled by their end, the last one closed at
       19:42; the queries after it are not counted, in this response or the next. */
    const timed = {
      ...data,
      stats: {
        ...data.stats,
        totalQueries: 7, totalNoError: 7, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
        totalAuthoritative: 0, totalRecursive: 7, totalCached: 0, totalBlocked: 0, totalDropped: 0,
      },
      mainChartData: {
        labelFormat: 'HH:mm',
        labels: Array.from({ length: 60 }, (_, i) => formatLabel(new Date(Date.UTC(2026, 9, 3, 18, 43 + i)).toISOString(), 'HH:mm')),
        instants: Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 9, 3, 18, 43 + i)).toISOString()),
        datasets: ['Total', 'No Error', 'Recursive'].map((label) => ({ label, data: [...Array<number>(58).fill(0), 5, 2] })),
      },
      queryResponseChartData: {
        labels: ['Authoritative', 'Recursive', 'Cached', 'Blocked', 'Dropped'],
        datasets: [{ label: '', data: [0, 7, 0, 0, 0] }],
      },
    }
    /* A new object each time, as every real response is: the reload must be a reload. */
    const stats = vi.spyOn(api, 'getDashboardStats').mockImplementation(async () => ({ kind: 'ok', data: { ...timed } }) as never)
    const counters = (q: number) => ({
      kind: 'ok' as const,
      data: {
        uptimestamp: 'u1',
        lifetimeCounters: {
          totalQueries: q, totalNoError: q, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
          totalAuthoritative: 0, totalRecursive: q, totalCached: 0, totalBlocked: 0, totalDropped: 0,
          totalClients: 1,
        },
      },
    })
    vi.spyOn(api, 'getMetrics').mockResolvedValueOnce(counters(1000)).mockResolvedValue(counters(1003))
    render(<Dashboard token="t" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(within(screen.getByText('Total Queries').parentElement!).getByText('10')).toBeInTheDocument()
    /* The reload brings the same consolidated figures: those 3 queries are not in them yet. */
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(stats).toHaveBeenCalledTimes(2)
    expect(within(screen.getByText('Total Queries').parentElement!).getByText('10')).toBeInTheDocument()
  })
})
