/*
Deviation 6 on the screen: each figure's change against the previous period, and
the charts' jumps to Query Logs. The arithmetic itself is tested in
`compare.test.ts` and `jump.test.ts`; this file checks what the screen asks, when
it draws a change and when it must not, and what a click hands the Shell.

`./Chart` is doubled, in a file of its own as `Dashboard.legend.test.tsx` explains,
so a test can press a point or a slice: jsdom has no canvas to click.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'
import { HandoffContext, type Handoff } from '../../app/handoff'
import { toIso } from '../logs/dates'

const charts = new Map<string, { onPick?: (i: number) => void; pickable?: (i: number) => boolean }>()
vi.mock('./Chart', () => ({
  Chart: (props: { aria: string; onPick?: (i: number) => void; pickable?: (i: number) => boolean }) => {
    charts.set(props.aria, props)
    return <div data-testid={`chart-${props.aria}`} />
  },
}))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  charts.clear()
  localStorage.removeItem('dashboardClusterNode')
})
beforeEach(() => {
  vi.spyOn(api, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not stubbed' })
})

const MIN = 60_000
const LAST = Date.UTC(2026, 9, 15, 19, 36)
const SERIES = ['Total', 'No Error', 'Server Failure', 'NX Domain', 'Refused', 'Authoritative',
  'Recursive', 'Cached', 'Blocked', 'Dropped', 'Clients']

/* A Last Hour answer whose minutes end at `last`, `per` queries each, all Cached. */
function hour(last: number, per: number, clients: number) {
  const instants = Array.from({ length: 60 }, (_, i) => new Date(last - (59 - i) * MIN).toISOString())
  return {
    stats: {
      totalQueries: 60 * per, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
      totalAuthoritative: 0, totalRecursive: 0, totalCached: 60 * per, totalBlocked: 0, totalDropped: 0,
      totalClients: clients, zones: 1, cachedEntries: 1, allowedZones: 0, blockedZones: 0,
      allowListZones: 0, blockListZones: 0,
    },
    mainChartData: {
      labelFormat: 'HH:mm',
      labels: instants,
      instants,
      datasets: SERIES.map((label) => ({
        label,
        data: instants.map(() => (label === 'Total' || label === 'Cached' ? per : label === 'Clients' ? 1 : 0)),
      })),
    },
    queryResponseChartData: {
      labels: ['Authoritative', 'Recursive', 'Cached', 'Blocked', 'Dropped'],
      datasets: [{ label: '', data: [0, 0, 60 * per, 0, 1] }],
    },
    queryTypeChartData: { labels: ['A', 'AAAA', 'Others'], datasets: [{ label: '', data: [5, 3, 1] }] },
    protocolTypeChartData: { labels: ['Udp', 'Tcp'], datasets: [{ label: '', data: [7, 2] }] },
    topClients: [], topDomains: [], topBlockedDomains: [],
  }
}

const CURRENT = hour(LAST, 2, 4)
const PREVIOUS = hour(LAST - 60 * MIN, 1, 2)

/* The current hour for the period, the previous one for `Custom`. */
function serve(previous: unknown = { kind: 'ok', data: PREVIOUS }) {
  return vi.spyOn(api, 'getDashboardStats').mockImplementation(async (_t, type) =>
    (type === 'Custom' ? previous : { kind: 'ok', data: CURRENT }) as never)
}

function nav(canShowQueryLogs = true): Handoff {
  return { queryDnsServer: vi.fn(), showQueryLogs: vi.fn(), canShowQueryLogs }
}
const inShell = (ui: ReactNode, handoff: Handoff = nav()) =>
  render(<HandoffContext.Provider value={handoff}>{ui}</HandoffContext.Provider>)

const card = (label: string) => screen.getAllByText(label).find((el) => el.closest('[data-testid="metrics"]'))!.parentElement!

describe('Dashboard: the change against the previous period', () => {
  it('asks the previous hour of the same node with type=Custom, from the labels of the answer itself', async () => {
    localStorage.setItem('dashboardClusterNode', 'ns2.test')
    const spy = serve()
    inShell(<Dashboard token="t" clusterInitialised nodes={[{ name: 'ns2.test' }] as never} />)
    await screen.findByText('Change vs previous hour')
    const custom = spy.mock.calls.find((c) => c[1] === 'Custom')!
    expect(custom[2]).toEqual({
      start: new Date(LAST - 119 * MIN).toISOString(),
      end: new Date(LAST - 60 * MIN).toISOString(),
    })
    expect(custom[3]).toBe('ns2.test')
  })

  it('draws each change with an arrow, and says in full what it is against', async () => {
    serve()
    inShell(<Dashboard token="t" />)
    await screen.findByText('Change vs previous hour')
    expect(within(card('Total Queries')).getByText('+100.0% vs previous hour')).toBeInTheDocument()
    expect(within(card('Total Queries')).getByText('▲ 100.0%')).toBeInTheDocument()
    expect(within(card('Clients')).getByText('+100.0% vs previous hour')).toBeInTheDocument()
  })

  it('a figure that was zero before has no change', async () => {
    serve()
    inShell(<Dashboard token="t" />)
    await screen.findByText('Change vs previous hour')
    expect(within(card('Blocked')).queryByText(/vs previous hour/)).not.toBeInTheDocument()
  })

  it('a previous read that fails draws no change at all, and says nothing', async () => {
    const spy = serve({ kind: 'error', message: 'boom' })
    inShell(<Dashboard token="t" />)
    await vi.waitFor(() => expect(spy.mock.calls.some((c) => c[1] === 'Custom')).toBe(true))
    await screen.findAllByText((60 * 2).toLocaleString())
    expect(screen.queryByText(/vs previous/)).not.toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })

  it('while another period loads, the changes of the one on screen are not drawn', async () => {
    let finish!: (v: unknown) => void
    const spy = vi.spyOn(api, 'getDashboardStats').mockImplementation(async (_t, type) => {
      if (type === 'LastDay') return new Promise((r) => { finish = r }) as never
      return (type === 'Custom' ? { kind: 'ok', data: PREVIOUS } : { kind: 'ok', data: CURRENT }) as never
    })
    inShell(<Dashboard token="t" />)
    await screen.findByText('Change vs previous hour')
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    expect(spy.mock.calls.some((c) => c[1] === 'LastDay')).toBe(true)
    expect(screen.queryByText(/vs previous/)).not.toBeInTheDocument()
    await act(async () => { finish({ kind: 'error', message: 'x' }) })
  })

  it('an answer without instants (an older server) asks nothing more', async () => {
    const plain = { ...CURRENT, mainChartData: { labels: ['a'], datasets: [{ label: 'Total', data: [1] }] } }
    const spy = vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: plain } as never)
    inShell(<Dashboard token="t" />)
    await screen.findByText('Total Queries')
    await act(async () => { await Promise.resolve() })
    expect(spy.mock.calls.filter((c) => c[1] === 'Custom')).toHaveLength(0)
  })
})

describe('Dashboard: from a chart to Query Logs', () => {
  it('a point of Queries opens that minute, From its start To its last second, on this node', async () => {
    serve()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)
    await screen.findByTestId('chart-Queries over time')
    act(() => charts.get('Queries over time')!.onPick!(59))
    const [domain, client, node, filters] = vi.mocked(handoff.showQueryLogs).mock.calls[0]
    expect([domain, client, node]).toEqual([null, null, 'cluster'])
    expect(toIso(filters!.start!)).toBe(new Date(LAST - MIN).toISOString())
    expect(toIso(filters!.end!)).toBe(new Date(LAST - 1000).toISOString())
  })

  it('a response type slice opens that response type over the period; Dropped has none', async () => {
    serve()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)
    await screen.findByTestId('chart-Query Response Types')
    const ring = charts.get('Query Response Types')!
    expect(ring.pickable!(4)).toBe(false)
    act(() => ring.onPick!(2))
    const filters = vi.mocked(handoff.showQueryLogs).mock.calls[0][3]!
    expect(filters.responseType).toBe('Cached')
    expect(toIso(filters.start!)).toBe(new Date(LAST - 60 * MIN).toISOString())
  })

  it('a query type bar opens that type, a protocol bar that protocol, and Others is not a button', async () => {
    serve()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)
    const types = within(await screen.findByLabelText('Query Types'))
    await userEvent.click(types.getByRole('button', { name: /^AAAA/ }))
    expect(vi.mocked(handoff.showQueryLogs).mock.calls[0][3]).toMatchObject({ qtype: 'AAAA' })
    expect(types.queryByRole('button', { name: /^Others/ })).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByLabelText('Protocol Types')).getByRole('button', { name: /^Tcp/ }))
    expect(vi.mocked(handoff.showQueryLogs).mock.calls[1][3]).toMatchObject({ protocol: 'Tcp' })
  })

  it('with Query Logs out of reach no chart takes the click', async () => {
    serve()
    inShell(<Dashboard token="t" />, nav(false))
    await screen.findByTestId('chart-Queries over time')
    expect(charts.get('Queries over time')!.onPick).toBeUndefined()
    expect(charts.get('Query Response Types')!.onPick).toBeUndefined()
    expect(within(screen.getByLabelText('Query Types')).queryByRole('button')).not.toBeInTheDocument()
  })
})
