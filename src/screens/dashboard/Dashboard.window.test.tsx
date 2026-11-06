/*
Deviation 41 on the screen: a drag across the Queries chart opens Query Logs for the
window it covers, as a point's click opens its bucket (deviation 7), on the total
line and on the lines compared by node (deviation 36). The gesture itself is tested
in `Chart.drag.test.tsx`; here `./Chart` is doubled, as in `Dashboard.compare.test.tsx`,
so a test can hand the screen a drag's first and last bucket.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'
import { HandoffContext, type Handoff } from '../../app/handoff'
import { toIso } from '../logs/dates'

type Props = { aria: string; data: { datasets: { label?: string }[] }; onPick?: (i: number) => void; onPickRange?: (a: number, b: number) => void }
const charts = new Map<string, Props>()
vi.mock('./Chart', () => ({
  Chart: (props: Props) => {
    charts.set(props.aria, props)
    return <div data-testid={`chart-${props.aria}`} />
  },
}))

afterEach(() => {
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
/* The minute bucket `i` of the hour starts here; the server labels it with its end. */
const startOf = (i: number) => LAST - (60 - i) * MIN

function hour(per: number) {
  const instants = Array.from({ length: 60 }, (_, i) => new Date(LAST - (59 - i) * MIN).toISOString())
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
      datasets: SERIES.map((label) => ({ label, data: instants.map(() => (label === 'Total' ? per : 0)) })),
    },
    queryResponseChartData: { labels: ['Authoritative'], datasets: [{ label: '', data: [1] }] },
    queryTypeChartData: { labels: ['A'], datasets: [{ label: '', data: [1] }] },
    protocolTypeChartData: { labels: ['Udp'], datasets: [{ label: '', data: [1] }] },
    topClients: [], topDomains: [], topBlockedDomains: [],
  }
}

function serve() {
  return vi.spyOn(api, 'getDashboardStats').mockImplementation(async () => ({ kind: 'ok', data: hour(3) }) as never)
}
const nav = (canShowQueryLogs = true): Handoff => ({ queryDnsServer: vi.fn(), showQueryLogs: vi.fn(), canShowQueryLogs })
const inShell = (ui: ReactNode, handoff: Handoff = nav()) =>
  render(<HandoffContext.Provider value={handoff}>{ui}</HandoffContext.Provider>)
const queries = () => charts.get('Queries over time')!
const NODES = [{ name: 'ns1.test', type: 'Primary' }, { name: 'ns2.test', type: 'Secondary' }]

describe('Dashboard: a window chosen on the Queries chart', () => {
  it('a drag opens Query Logs from the start of its first bucket to the last second of its last, on this node', async () => {
    serve()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)
    await screen.findByTestId('chart-Queries over time')
    act(() => queries().onPickRange!(14, 10))
    const [domain, client, node, filters] = vi.mocked(handoff.showQueryLogs).mock.calls[0]
    expect([domain, client, node]).toEqual([null, null, 'cluster'])
    expect(toIso(filters!.start!)).toBe(new Date(startOf(10)).toISOString())
    expect(toIso(filters!.end!)).toBe(new Date(startOf(15) - 1000).toISOString())
    expect(Object.keys(filters!).sort()).toEqual(['end', 'start'])
  })

  it('a plain click still opens one bucket', async () => {
    serve()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)
    await screen.findByTestId('chart-Queries over time')
    act(() => queries().onPick!(10))
    const filters = vi.mocked(handoff.showQueryLogs).mock.calls[0][3]!
    expect(toIso(filters.start!)).toBe(new Date(startOf(10)).toISOString())
    expect(toIso(filters.end!)).toBe(new Date(startOf(11) - 1000).toISOString())
  })

  it('says so in the hint while it can land', async () => {
    serve()
    inShell(<Dashboard token="t" />)
    expect(await screen.findByText('Click a point to open Query Logs for that minute, or drag to choose a window')).toBeInTheDocument()
  })

  it('works on the lines compared by node, from the buckets they are laid on', async () => {
    serve()
    localStorage.setItem('dashboardCompareNodes', 'true')
    const handoff = nav()
    inShell(<Dashboard token="t" clusterInitialised nodes={NODES} />, handoff)
    // The compared lines are the ones on the canvas.
    await vi.waitFor(() => expect(queries().data.datasets.map((d) => d.label)).toEqual(['ns1.test', 'ns2.test']))
    act(() => queries().onPickRange!(0, 59))
    const filters = vi.mocked(handoff.showQueryLogs).mock.calls[0][3]!
    expect(toIso(filters.start!)).toBe(new Date(startOf(0)).toISOString())
    expect(toIso(filters.end!)).toBe(new Date(LAST - 1000).toISOString())
  })

  it('with Query Logs out of reach the chart takes no drag and no click, and no hint is drawn', async () => {
    serve()
    inShell(<Dashboard token="t" />, nav(false))
    await screen.findByTestId('chart-Queries over time')
    expect(queries().onPickRange).toBeUndefined()
    expect(queries().onPick).toBeUndefined()
    expect(screen.queryByText(/drag to choose a window/)).not.toBeInTheDocument()
  })
})
