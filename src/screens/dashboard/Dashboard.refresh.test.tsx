/*
Refresh beside the period (deviation 44): the screen's own reload, on demand. What it
asks (exactly what the automatic reload asks), that it changes nothing that is
selected, how it shares the one load in flight, and what it does to the minute reload
of Last Hour.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'
import * as apps from '../../api/apps'
import * as logs from '../../api/logs'
import type { InstalledApp } from '../../api/apps'
import { quietHours } from '../../test/quiet-hours'

type Outcome = Awaited<ReturnType<typeof api.getDashboardStats>>

const SERIES = ['Total', 'No Error', 'Server Failure', 'NX Domain', 'Refused', 'Authoritative',
  'Recursive', 'Cached', 'Blocked', 'Dropped', 'Clients']
const LAST = Date.UTC(2026, 10, 8, 10, 0)

/* A new object each time, as every real response is. Its instants give the previous
   period's read, the second call of each load. */
function answer(total: number): Outcome {
  const instants = Array.from({ length: 60 }, (_, i) => new Date(LAST - (59 - i) * 60_000).toISOString())
  return {
    kind: 'ok',
    data: {
      stats: {
        totalQueries: total, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
        totalAuthoritative: 0, totalRecursive: 0, totalCached: 0, totalBlocked: 0, totalDropped: 0,
        totalClients: 1, zones: 1, cachedEntries: 1, allowedZones: 0, blockedZones: 0,
        allowListZones: 0, blockListZones: 0,
      },
      mainChartData: {
        labelFormat: 'HH:mm',
        labels: instants,
        instants,
        datasets: SERIES.map((label) => ({ label, data: instants.map(() => (label === 'Total' ? 1 : 0)) })),
      },
      queryResponseChartData: { labels: ['Authoritative'], datasets: [{ label: '', data: [1] }] },
      queryTypeChartData: { labels: ['A'], datasets: [{ label: '', data: [1] }] },
      protocolTypeChartData: { labels: ['Udp'], datasets: [{ label: '', data: [1] }] },
      topClients: [], topDomains: [], topBlockedDomains: [],
    },
  } as Outcome
}

let total = 100
const serve = () => vi.spyOn(api, 'getDashboardStats').mockImplementation(async () => answer(total))
function held() {
  let resolve!: (v: Outcome) => void
  const promise = new Promise<Outcome>((r) => { resolve = r })
  return { promise, resolve }
}

const NODES = [{ name: 'ns1.test', type: 'Primary' }, { name: 'ns2.test', type: 'Secondary' }]
const refresh = () => screen.getByRole('button', { name: 'Refresh' })
const period = (name: string) => screen.getByRole('button', { name })
const figure = (n: number) => within(screen.getByTestId('metrics')).queryByText(n.toLocaleString())
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const click = async (el: HTMLElement) => {
  fireEvent.click(el)
  await settle()
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

let hidden = false
const setHidden = (value: boolean) => act(async () => {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(0)
})

beforeEach(() => {
  total = 100
  hidden = false
  localStorage.clear()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  vi.useFakeTimers()
  vi.setSystemTime(LAST + 30_000)
  vi.spyOn(api, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not stubbed' })
  vi.spyOn(api, 'getHours').mockImplementation(quietHours)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Dashboard: Refresh reads what is selected', () => {
  it('sends the calls the period sends on arrival, with the same period and node, and changes neither', async () => {
    const spy = serve()
    localStorage.setItem('dashboardClusterNode', 'ns2.test')
    render(<Dashboard token="t" clusterInitialised nodes={NODES as never} />)
    await settle()
    spy.mockClear()
    await click(period('Last Week'))
    const arrival = [...spy.mock.calls]
    expect(arrival[0]).toEqual(['t', 'LastWeek', undefined, 'ns2.test'])
    expect(arrival).toHaveLength(2)
    spy.mockClear()

    total = 200
    await click(refresh())

    expect(spy.mock.calls).toEqual(arrival)
    expect(figure(200)).toBeInTheDocument()
    expect(period('Last Week')).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('dashboardClusterNode')).toBe('ns2.test')
  })

  it('reads the query sample again, as any new answer does', async () => {
    serve()
    const app = { name: 'Query Logs (Sqlite)', dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }] } as unknown as InstalledApp
    vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: [app] } } } as never)
    const newest = vi.spyOn(logs, 'newestQueries').mockResolvedValue({ kind: 'ok', data: [] } as never)
    render(<Dashboard token="t" canViewLogs />)
    await settle()
    expect(newest).toHaveBeenCalledTimes(1)

    await click(refresh())

    expect(newest).toHaveBeenCalledTimes(2)
  })

  it('on Custom it reads the range on screen, not the dates typed since', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    await click(period('Custom'))
    type('Start', '2026-11-01')
    type('End', '2026-11-02')
    await click(screen.getByRole('button', { name: 'Show' }))
    const shown = spy.mock.calls.at(-2)!
    expect(shown[1]).toBe('Custom')
    spy.mockClear()

    type('End', '2026-11-05')
    await click(refresh())

    expect(spy.mock.calls[0]).toEqual(shown)
    expect(screen.getByLabelText('End')).toHaveValue('2026-11-05')
  })

  it('on Custom with no range asked for there is nothing to read: disabled, and nothing is sent', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    await click(period('Custom'))
    spy.mockClear()

    expect(refresh()).toBeDisabled()
    await click(refresh())

    expect(spy).not.toHaveBeenCalled()
  })

  it('on the aggregate it asks the aggregate, and the compared lines read every node again', async () => {
    const spy = serve()
    localStorage.setItem('dashboardCompareNodes', 'true')
    render(<Dashboard token="t" clusterInitialised nodes={NODES as never} />)
    await settle()
    spy.mockClear()

    await click(refresh())
    await settle()

    const nodes = spy.mock.calls.map((c) => c[3])
    expect(nodes.filter((n) => n === 'cluster')).toHaveLength(2)
    expect(nodes.filter((n) => n === 'ns1.test')).toHaveLength(1)
    expect(nodes.filter((n) => n === 'ns2.test')).toHaveLength(1)
    expect(localStorage.getItem('dashboardClusterNode')).toBe('cluster')
  })
})

describe('Dashboard: one load at a time', () => {
  it('a double press sends one load, which keeps the figures on screen, and then it can be pressed again', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    spy.mockClear()
    const reading = held()
    spy.mockReturnValueOnce(reading.promise)

    await click(refresh())
    await click(refresh())

    expect(spy).toHaveBeenCalledTimes(1)
    expect(refresh()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(figure(100)).toBeInTheDocument()

    await act(async () => {
      reading.resolve(answer(200))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(figure(200)).toBeInTheDocument()
    expect(refresh()).not.toHaveAttribute('aria-disabled')

    spy.mockClear()
    await click(refresh())
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('keeps the keyboard on the button while it reads', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    spy.mockReturnValueOnce(new Promise(() => {}))
    refresh().focus()

    await click(refresh())

    expect(refresh()).toHaveFocus()
    expect(refresh()).not.toBeDisabled()
  })

  it('a press during the automatic reload joins it and sends nothing more', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    spy.mockClear()
    const reading = held()
    spy.mockReturnValueOnce(reading.promise)
    await advance(60_000)
    expect(spy).toHaveBeenCalledTimes(1)

    await click(refresh())

    expect(spy).toHaveBeenCalledTimes(1)
    expect(refresh()).toHaveAttribute('aria-disabled', 'true')
    await act(async () => {
      reading.resolve(answer(200))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(figure(200)).toBeInTheDocument()
    expect(refresh()).not.toHaveAttribute('aria-disabled')
  })

  it('coming back to the tab during a press sends nothing more', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    spy.mockClear()
    spy.mockReturnValueOnce(new Promise(() => {}))

    await click(refresh())
    await setHidden(true)
    await setHidden(false)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('the answer to a press never replaces the answer to a newer choice', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    const reading = held()
    spy.mockReturnValueOnce(reading.promise)
    await click(refresh())

    total = 300
    await click(period('Last Day'))
    expect(figure(300)).toBeInTheDocument()

    await act(async () => {
      reading.resolve(answer(999))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(figure(999)).not.toBeInTheDocument()
    expect(figure(300)).toBeInTheDocument()
    expect(refresh()).not.toHaveAttribute('aria-disabled')
  })
})

describe('Dashboard: Refresh and the minute reload of Last Hour', () => {
  it('a press starts the minute over, so two loads never run back to back', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    await advance(40_000)
    await click(refresh())
    spy.mockClear()

    await advance(20_000)
    expect(spy).not.toHaveBeenCalled()
    await advance(39_999)
    expect(spy).not.toHaveBeenCalled()
    await advance(1)
    expect(spy).toHaveBeenCalledTimes(2)

    /* One chain of timers, not two. */
    spy.mockClear()
    await advance(60_000)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('with the tab hidden a press starts no timer, and coming back reloads at once', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    await setHidden(true)
    spy.mockClear()

    await click(refresh())
    expect(spy).toHaveBeenCalledTimes(2)
    await advance(180_000)
    expect(spy).toHaveBeenCalledTimes(2)

    spy.mockClear()
    await setHidden(false)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('on another period a press starts no timer', async () => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    await click(period('Last Week'))
    await click(refresh())
    spy.mockClear()

    await advance(180_000)

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('Dashboard: a failed reload', () => {
  it.each([
    ['a press', () => click(refresh())],
    ['the minute reload', () => advance(60_000)],
  ])('after %s it says so, draws dashes and keeps the minute going', async (_name, reload) => {
    const spy = serve()
    render(<Dashboard token="t" />)
    await settle()
    spy.mockClear()
    spy.mockResolvedValueOnce({ kind: 'error', message: 'boom' })

    await reload()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(within(screen.getByTestId('metrics')).getAllByText('—')).toHaveLength(11)
    expect(screen.getAllByText(/Could not load/).length).toBeGreaterThan(0)
    expect(refresh()).toBeEnabled()
    expect(refresh()).not.toHaveAttribute('aria-disabled')

    spy.mockClear()
    total = 400
    await advance(60_000)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(figure(400)).toBeInTheDocument()
  })

  it('a press after a failure reads again and draws the answer', async () => {
    const spy = serve()
    spy.mockResolvedValueOnce({ kind: 'error', message: 'boom' })
    render(<Dashboard token="t" />)
    await settle()
    expect(figure(100)).not.toBeInTheDocument()

    await click(refresh())

    expect(figure(100)).toBeInTheDocument()
  })
})
