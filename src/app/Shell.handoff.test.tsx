import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell, type ShellSession } from './Shell'
import { ThemeProvider } from '../theme/ThemeProvider'
import * as client from '../api/client'
import * as dashboard from '../api/dashboard'
import * as dnsclient from '../api/dnsclient'
import * as apps from '../api/apps'
import * as logs from '../api/logs'
import type { InstalledApp } from '../api/apps'
import { forgetRoot } from './route'

/*
The jumps between screens, end to end through the Shell (`app/handoff.ts`):
the row menu asks, the Shell switches section, and the target screen arrives
filled in and runs its query, once.
*/

const chart = { labels: ['a', 'b'], datasets: [{ label: 'Total', data: [1, 2] }] }
const STATS = {
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
  topBlockedDomains: [],
}

const APP: InstalledApp = {
  name: 'Query Logs (Sqlite)',
  description: 'Logs all incoming DNS requests.',
  version: '8.0',
  dnsApps: [
    {
      classPath: 'QueryLogsSqlite.App',
      description: 'Logs queries.',
      recordDataTemplate: null,
      isAppRecordRequestHandler: false,
      isRequestController: false,
      isAuthoritativeRequestHandler: false,
      isRequestBlockingHandler: false,
      isQueryLogger: true,
      isQueryLogs: true,
      isPostProcessor: false,
    },
  ],
}

const ENTRY = {
  rowNumber: 1,
  timestamp: '2026-08-26T05:32:14Z',
  clientIpAddress: '10.0.0.1',
  protocol: 'Udp',
  responseType: 'Recursive',
  rcode: 'NoError',
  qname: 'api.github.com',
  qtype: 'HTTPS',
  qclass: 'IN',
  answer: null,
}

function session(canViewDnsClient = true): ShellSession {
  const sections = ['Dashboard', 'Zones', 'Cache', 'Allowed', 'Blocked', 'Apps', 'DnsClient', 'Settings', 'DhcpServer', 'Administration', 'Logs']
  return {
    token: 'tok',
    displayName: 'Administrator',
    username: 'admin',
    type: 'Local',
    info: {
      version: '15.6',
      uptimestamp: '2026-08-25T13:07:31Z',
      dnsServerDomain: 'dns.example.net',
      permissions: Object.fromEntries(
        sections.map((s) => [
          s,
          { canView: s === 'DnsClient' ? canViewDnsClient : true, canModify: true, canDelete: true },
        ]),
      ),
    },
  }
}

function mount(s: ShellSession = session()) {
  return render(
    <StrictMode>
      <ThemeProvider>
        <Shell session={s} onLogout={() => {}} />
      </ThemeProvider>
    </StrictMode>,
  )
}

let resolve: ReturnType<typeof vi.spyOn>
let query: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  localStorage.clear()
  forgetRoot()
  window.history.replaceState(null, '', '/')
  vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: {} } } as never)
  vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: STATS } as never)
  resolve = vi.spyOn(dnsclient, 'resolve').mockResolvedValue({
    kind: 'ok',
    data: { status: 'ok', response: { result: { answer: 'ok' } } },
  } as never)
  vi.spyOn(apps, 'listApps').mockResolvedValue({
    kind: 'ok',
    data: { status: 'ok', response: { apps: [APP] } },
  } as never)
  query = vi.spyOn(logs, 'queryLogs').mockResolvedValue({
    kind: 'ok',
    data: { response: { pageNumber: 1, totalPages: 1, totalEntries: 1, entries: [ENTRY] } },
  } as never)
})
afterEach(() => vi.restoreAllMocks())

async function pick(row: string, item: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${row}` }))
  await userEvent.click(screen.getByRole('menuitem', { name: item }))
}

const sidebar = () => screen.getByRole('navigation', { name: 'Sections' })

describe('Shell: the jumps of the row menus', () => {
  it('Query DNS Server opens DNS Client filled in and runs the query once', async () => {
    mount()
    await pick('github.com', 'Query DNS Server')

    expect(await screen.findByRole('heading', { name: 'DNS Client' })).toBeInTheDocument()
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1))
    expect(resolve.mock.calls[0][1]).toMatchObject({
      server: 'this-server',
      domain: 'github.com',
      type: 'A',
      protocol: 'UDP',
      dnssec: false,
      eDnsClientSubnet: '',
      node: '',
    })
    expect(window.location.pathname).toBe('/dnsclient/')
  })

  it('coming back to DNS Client later finds a clean form and runs nothing', async () => {
    mount()
    await pick('github.com', 'Query DNS Server')
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1))

    await userEvent.click(within(sidebar()).getByRole('link', { name: 'Dashboard' }))
    await userEvent.click(within(sidebar()).getByRole('link', { name: 'DNS Client' }))

    expect(await screen.findByLabelText('Domain')).toHaveValue('')
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('Show Query Logs opens Logs › Query Logs filtered by the client and queries', async () => {
    mount()
    await pick('10.0.0.1', 'Show Query Logs')

    expect(await screen.findByText('api.github.com')).toBeInTheDocument()
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][1]).toMatchObject({ qname: '', clientIpAddress: '10.0.0.1', node: '' })
    expect(screen.getByLabelText('Client IP Address')).toHaveValue('10.0.0.1')
    expect(window.location.pathname).toBe('/logs/query-logs/')
  })

  it('from a Query Logs row, Query DNS Server goes on to DNS Client with the type of the row', async () => {
    mount()
    await pick('github.com', 'Show Query Logs')
    expect(await screen.findByText('api.github.com')).toBeInTheDocument()
    expect(query.mock.calls[0][1]).toMatchObject({ qname: 'github.com', clientIpAddress: '' })

    await pick('row 1', 'Query DNS Server')
    expect(await screen.findByRole('heading', { name: 'DNS Client' })).toBeInTheDocument()
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1))
    expect(resolve.mock.calls[0][1]).toMatchObject({ domain: 'api.github.com', type: 'HTTPS' })
  })

  it('a section the user cannot see is not opened', async () => {
    mount(session(false))
    await pick('github.com', 'Query DNS Server')
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(resolve).not.toHaveBeenCalled()
  })
})
