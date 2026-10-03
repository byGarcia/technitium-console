import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Logs } from './Logs'
import * as logs from '../../api/logs'
import * as apps from '../../api/apps'
import * as client from '../../api/client'
import type { InstalledApp } from '../../api/apps'
import type { QueryLogEntry } from '../../api/logs'
import { HandoffContext, type Handoff } from '../../app/handoff'

/*
Each Query Logs row's menu (logs.js:539-552) and the arrival from the Dashboard's
`showQueryLogs` (logs.js:624-655).
*/

afterEach(() => vi.restoreAllMocks())

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

function entry(rowNumber: number, responseType: string, extra: Partial<QueryLogEntry> = {}): QueryLogEntry {
  return {
    rowNumber,
    timestamp: '2026-08-26T05:32:14Z',
    clientIpAddress: '10.0.0.7',
    protocol: 'Udp',
    responseType,
    rcode: 'NoError',
    qname: `r${rowNumber}.example`,
    qtype: 'AAAA',
    qclass: 'IN',
    answer: null,
    ...extra,
  }
}

const ENTRIES = [
  entry(1, 'Recursive'),
  entry(2, 'Blocked'),
  entry(3, 'UpstreamBlocked'),
  entry(4, 'upstreamblockedcached'),
  entry(5, 'Cached'),
  entry(6, 'Authoritative', { qname: null, qtype: null }),
]

function withApps(list: InstalledApp[] = [APP]) {
  return vi
    .spyOn(apps, 'listApps')
    .mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: list } } } as never)
}

function withEntries(entries: QueryLogEntry[] = ENTRIES) {
  return vi.spyOn(logs, 'queryLogs').mockResolvedValue({
    kind: 'ok',
    data: { response: { pageNumber: 1, totalPages: 1, totalEntries: entries.length, entries } },
  } as never)
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

async function queried() {
  await userEvent.click(await screen.findByRole('button', { name: 'Query' }))
  await screen.findByText('r1.example')
}

async function openRow(n: number) {
  await userEvent.click(screen.getByRole('button', { name: `Actions for row ${n}` }))
  return screen.getByRole('menu', { name: `Actions for row ${n}` })
}

describe('Query Logs: the row menu', () => {
  it('every row offers Query DNS Server and then Allow or Block by its response type', async () => {
    withApps()
    withEntries()
    inShell(<Logs token="t" sub="Query Logs" />)
    await queried()

    const expected: Record<number, string> = {
      1: 'Block Domain',
      2: 'Allow Domain',
      3: 'Allow Domain',
      4: 'Allow Domain',
      5: 'Block Domain',
      6: 'Block Domain',
    }
    for (const [n, verb] of Object.entries(expected)) {
      const menu = await openRow(Number(n))
      const items = within(menu).getAllByRole('menuitem').map((i) => i.textContent)
      expect(items).toEqual(['Query DNS Server', verb])
      await userEvent.keyboard('{Escape}')
    }
  })

  it('Query DNS Server hands over the domain, the type and the node of the screen', async () => {
    withApps()
    withEntries()
    const handoff = nav()
    inShell(<Logs token="t" sub="Query Logs" />, handoff)
    await queried()

    await openRow(1)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Query DNS Server' }))
    expect(handoff.queryDnsServer).toHaveBeenCalledWith('r1.example', 'AAAA', '')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('a row without a name or a type hands over an empty domain and the text "null", as upstream writes it', async () => {
    withApps()
    withEntries()
    const handoff = nav()
    inShell(<Logs token="t" sub="Query Logs" />, handoff)
    await queried()

    await openRow(6)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Query DNS Server' }))
    expect(handoff.queryDnsServer).toHaveBeenCalledWith('', 'null', '')
  })

  it('Allow Domain is blocked/delete then allowed/add, and the alert comes out on the page', async () => {
    withApps()
    withEntries()
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    inShell(<Logs token="t" sub="Query Logs" />)
    await queried()

    await openRow(2)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Allow Domain' }))

    expect(await screen.findByText("Domain 'r2.example' was added to Allowed Zone successfully.")).toBeInTheDocument()
    expect(screen.getByText('Allowed!')).toBeInTheDocument()
    const paths = spy.mock.calls.map((c) => c[0])
    expect(paths).toEqual(['blocked/delete', 'allowed/add'])
    expect(spy.mock.calls[0][1]?.body).toEqual({ domain: 'r2.example' })
    expect(spy.mock.calls[1][1]?.body).toEqual({ domain: 'r2.example' })
  })

  it('Block Domain is allowed/delete then blocked/add, with its own sentence', async () => {
    withApps()
    withEntries()
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    inShell(<Logs token="t" sub="Query Logs" />)
    await queried()

    await openRow(1)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Block Domain' }))

    expect(await screen.findByText("Domain 'r1.example' was added to Blocked Zone successfully.")).toBeInTheDocument()
    expect(screen.getByText('Blocked!')).toBeInTheDocument()
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['allowed/delete', 'blocked/add'])
    expect(spy.mock.calls[1][1]?.body).toEqual({ domain: 'r1.example' })
  })

  it('when the first call fails the second is never made and the server message is shown', async () => {
    withApps()
    withEntries()
    const spy = vi
      .spyOn(client, 'apiRequest')
      .mockResolvedValue({ kind: 'error', message: 'Access was denied.' } as never)
    inShell(<Logs token="t" sub="Query Logs" />)
    await queried()

    await openRow(1)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Block Domain' }))

    expect(await screen.findByText('Access was denied.')).toBeInTheDocument()
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['allowed/delete'])
  })

  it('with no entries there is no row menu at all', async () => {
    withApps()
    withEntries([])
    inShell(<Logs token="t" sub="Query Logs" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Query' }))
    expect(await screen.findAllByText('0 logs')).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^Actions for row/ })).not.toBeInTheDocument()
  })
})

describe('Query Logs: arriving from showQueryLogs', () => {
  it('the domain is filled in and the query runs on arrival, with the reset form', async () => {
    withApps()
    const query = withEntries()
    inShell(<Logs token="t" sub="Query Logs" request={{ domain: 'github.com', clientIp: null, node: '' }} />)

    await screen.findByText('r1.example')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][1]).toMatchObject({
      name: 'Query Logs (Sqlite)',
      classPath: 'QueryLogsSqlite.App',
      pageNumber: '1',
      entriesPerPage: '10',
      descendingOrder: 'true',
      qname: 'github.com',
      clientIpAddress: '',
      responseType: '',
      node: '',
    })
    expect(screen.getByLabelText('Domain')).toHaveValue('github.com')
    expect(screen.getByLabelText('Client IP Address')).toHaveValue('')
  })

  it('a client fills the client field and leaves the domain empty', async () => {
    withApps()
    const query = withEntries()
    inShell(<Logs token="t" sub="Query Logs" request={{ domain: null, clientIp: '10.0.0.7', node: '' }} />)

    await screen.findByText('r1.example')
    expect(query.mock.calls[0][1]).toMatchObject({ qname: '', clientIpAddress: '10.0.0.7' })
    expect(screen.getByLabelText('Client IP Address')).toHaveValue('10.0.0.7')
  })

  it('a node in the request is the node the query asks', async () => {
    withApps()
    const query = withEntries()
    inShell(<Logs token="t" sub="Query Logs" request={{ domain: 'github.com', clientIp: null, node: 'node2.example' }} />)

    await screen.findByText('r1.example')
    expect(query.mock.calls[0][1]).toMatchObject({ qname: 'github.com', node: 'node2.example' })
  })

  it('without the logging app it says what upstream says when Query runs', async () => {
    withApps([])
    const query = withEntries()
    inShell(<Logs token="t" sub="Query Logs" request={{ domain: 'github.com', clientIp: null, node: '' }} />)

    expect(
      await screen.findByText(
        "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature from the Apps section.",
      ),
    ).toBeInTheDocument()
    expect(query).not.toHaveBeenCalled()
  })

  it('without a request nothing is queried on arrival', async () => {
    withApps()
    const query = withEntries()
    inShell(<Logs token="t" sub="Query Logs" />)
    await screen.findByRole('button', { name: 'Query' })
    await waitFor(() => expect(screen.getByLabelText('Domain')).toHaveValue(''))
    expect(query).not.toHaveBeenCalled()
  })
})
