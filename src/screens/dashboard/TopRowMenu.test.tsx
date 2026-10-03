import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import * as api from '../../api/dashboard'
import * as client from '../../api/client'
import { HandoffContext, type Handoff } from '../../app/handoff'
import { Dashboard } from './Dashboard'
import { TopStats } from './TopStats'

/*
The top lists' row menus: the Dashboard's three panels (main.js:2796-2853) and the
Top Stats modal behind their "More" buttons (main.js:2952-3019).
*/

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

const chart = { labels: ['a', 'b'], datasets: [{ label: 'Total', data: [1, 2] }] }
const DATA = {
  stats: {
    totalQueries: 10, totalNoError: 10, totalServerFailure: 0, totalNxDomain: 0,
    totalRefused: 0, totalAuthoritative: 0, totalRecursive: 10, totalCached: 0,
    totalBlocked: 0, totalDropped: 0, totalClients: 2,
    zones: 1, cachedEntries: 0, allowedZones: 0, blockedZones: 0,
    allowListZones: 0, blockListZones: 0,
  },
  mainChartData: chart,
  queryResponseChartData: chart,
  queryTypeChartData: chart,
  protocolTypeChartData: chart,
  topClients: [{ name: '10.0.0.1', domain: 'pc.home.test', hits: 12, rateLimited: false }],
  topDomains: [{ name: 'github.com', hits: 7 }],
  topBlockedDomains: [{ name: 'ads.example', hits: 3 }],
}

function nav() {
  return {
    queryDnsServer: vi.fn<Handoff['queryDnsServer']>(),
    showQueryLogs: vi.fn<Handoff['showQueryLogs']>(),
  }
}

function inShell(ui: ReactNode, handoff: Handoff = nav()) {
  return render(<HandoffContext.Provider value={handoff}>{ui}</HandoffContext.Provider>)
}

function stats() {
  return vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: DATA } as never)
}

async function openMenu(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  return screen.getByRole('menu', { name: `Actions for ${name}` })
}

const items = (menu: HTMLElement) => within(menu).getAllByRole('menuitem').map((i) => i.textContent)

describe('Dashboard: the top lists row menus', () => {
  it('each list offers upstream entries, in upstream order', async () => {
    stats()
    inShell(<Dashboard token="t" />)

    expect(items(await openMenu('10.0.0.1'))).toEqual(['Show Query Logs'])
    await userEvent.keyboard('{Escape}')
    expect(items(await openMenu('github.com'))).toEqual(['Show Query Logs', 'Query DNS Server', 'Block Domain'])
    await userEvent.keyboard('{Escape}')
    expect(items(await openMenu('ads.example'))).toEqual(['Show Query Logs', 'Query DNS Server', 'Allow Domain'])
  })

  it('a client shows its query logs by client, with the aggregate the Dashboard reads', async () => {
    stats()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)

    await openMenu('10.0.0.1')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Show Query Logs' }))
    expect(handoff.showQueryLogs).toHaveBeenCalledWith(null, '10.0.0.1', 'cluster')
  })

  it('a domain shows its query logs by domain and queries the server with no type', async () => {
    stats()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)

    await openMenu('github.com')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Show Query Logs' }))
    expect(handoff.showQueryLogs).toHaveBeenCalledWith('github.com', null, 'cluster')

    await openMenu('ads.example')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Query DNS Server' }))
    expect(handoff.queryDnsServer).toHaveBeenCalledWith('ads.example', null, 'cluster')
  })

  it('the node handed over is the one chosen in the Dashboard', async () => {
    localStorage.setItem('dashboardClusterNode', 'node2.example')
    stats()
    const handoff = nav()
    inShell(<Dashboard token="t" />, handoff)

    await openMenu('github.com')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Query DNS Server' }))
    expect(handoff.queryDnsServer).toHaveBeenCalledWith('github.com', null, 'node2.example')
  })

  it('Block Domain runs the two calls and reports on the page', async () => {
    stats()
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    inShell(<Dashboard token="t" />)

    await openMenu('github.com')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Block Domain' }))

    expect(await screen.findByText("Domain 'github.com' was added to Blocked Zone successfully.")).toBeInTheDocument()
    expect(screen.getByText('Blocked!')).toBeInTheDocument()
    /* The live Last Hour reads the counters too; only the row's calls matter here. */
    const calls = spy.mock.calls.filter((c) => c[0] !== 'dashboard/stats/get' && c[0] !== 'dashboard/metrics/json')
    expect(calls.map((c) => c[0])).toEqual(['allowed/delete', 'blocked/add'])
    expect(calls[1][1]?.body).toEqual({ domain: 'github.com' })
  })

  it('Allow Domain runs the two calls and reports on the page', async () => {
    stats()
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    inShell(<Dashboard token="t" />)

    await openMenu('ads.example')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Allow Domain' }))

    expect(await screen.findByText("Domain 'ads.example' was added to Allowed Zone successfully.")).toBeInTheDocument()
    expect(spy.mock.calls.map((c) => c[0]).filter((p) => p !== 'dashboard/metrics/json')).toEqual(['blocked/delete', 'allowed/add'])
  })

  it('with empty lists there is no row menu', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({
      kind: 'ok',
      data: { ...DATA, topClients: [], topDomains: [], topBlockedDomains: [] },
    } as never)
    inShell(<Dashboard token="t" />)
    expect(await screen.findAllByText('No data for this period.')).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument()
  })
})

describe('Top Stats modal: the row menus', () => {
  function top(response: Record<string, unknown>) {
    return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) =>
      path === 'dashboard/stats/getTop'
        ? ({ kind: 'ok', data: { status: 'ok', response } } as never)
        : ({ kind: 'ok', data: { status: 'ok' } } as never),
    )
  }

  it('the modal is asked for with the node it was given', async () => {
    const spy = top({ topDomains: [] })
    inShell(<TopStats type="TopDomains" range="LastHour" token="t" node="node2.example" onClose={() => {}} />)
    await waitFor(() => {
      const call = spy.mock.calls.find((c) => c[0] === 'dashboard/stats/getTop')
      expect(call?.[1]?.node).toBe('node2.example')
    })
  })

  it('the three kinds carry the same entries as the panels', async () => {
    top({ topClients: [{ name: '10.0.0.1', domain: '', hits: 1 }] })
    const { unmount } = inShell(<TopStats type="TopClients" range="LastHour" token="t" onClose={() => {}} />)
    expect(items(await openMenu('10.0.0.1'))).toEqual(['Show Query Logs'])
    unmount()

    top({ topDomains: [{ name: 'github.com', hits: 1 }] })
    const second = inShell(<TopStats type="TopDomains" range="LastHour" token="t" onClose={() => {}} />)
    expect(items(await openMenu('github.com'))).toEqual(['Show Query Logs', 'Query DNS Server', 'Block Domain'])
    second.unmount()

    top({ topBlockedDomains: [{ name: 'ads.example', hits: 1 }] })
    inShell(<TopStats type="TopBlockedDomains" range="LastHour" token="t" onClose={() => {}} />)
    expect(items(await openMenu('ads.example'))).toEqual(['Show Query Logs', 'Query DNS Server', 'Allow Domain'])
  })

  it('the jumps carry the node of the Dashboard', async () => {
    top({ topClients: [{ name: '10.0.0.1', domain: '', hits: 1 }] })
    const handoff = nav()
    inShell(
      <TopStats type="TopClients" range="LastHour" token="t" node="node2.example" onClose={() => {}} />,
      handoff,
    )
    await openMenu('10.0.0.1')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Show Query Logs' }))
    expect(handoff.showQueryLogs).toHaveBeenCalledWith(null, '10.0.0.1', 'node2.example')
  })

  it('allowing reports INSIDE the modal, as upstream sends it to divTopStatsAlert', async () => {
    const spy = top({ topBlockedDomains: [{ name: 'ads.example', hits: 1 }] })
    inShell(<TopStats type="TopBlockedDomains" range="LastHour" token="t" onClose={() => {}} />)

    await openMenu('ads.example')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Allow Domain' }))

    const dialog = screen.getByRole('dialog')
    expect(
      await within(dialog).findByText("Domain 'ads.example' was added to Allowed Zone successfully."),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Allowed!')).toBeInTheDocument()
    expect(spy.mock.calls.map((c) => c[0]).filter((p) => p !== 'dashboard/stats/getTop')).toEqual([
      'blocked/delete',
      'allowed/add',
    ])
  })

  it('with no data there is no row menu', async () => {
    top({ topDomains: [] })
    inShell(<TopStats type="TopDomains" range="LastHour" token="t" onClose={() => {}} />)
    expect(await screen.findByText('No Data')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument()
  })
})
