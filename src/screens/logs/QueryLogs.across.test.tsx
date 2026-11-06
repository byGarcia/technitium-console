/*
Query Logs across the cluster's nodes (deviation 37), on the screen: which calls
with which `node` and filters, the merge and its cut, each node's total, a node
that fails, Live Update every node each turn, the row's node for Query DNS Server,
the view in the address bar, and nothing changed without a cluster.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Logs } from './Logs'
import * as logs from '../../api/logs'
import * as apps from '../../api/apps'
import type { InstalledApp } from '../../api/apps'
import type { QueryLogEntry, QueryLogsParams } from '../../api/logs'
import { HandoffContext, type Handoff } from '../../app/handoff'
import { forgetRoot } from '../../app/route'
import { choose, valueShown } from '../../test/dropdown'

const APP: InstalledApp = {
  name: 'Query Logs (Sqlite)',
  description: 'Logs all incoming DNS requests.',
  version: '8.0',
  dnsApps: [
    {
      classPath: 'QueryLogsSqlite.App', description: 'Logs queries.', recordDataTemplate: null,
      isAppRecordRequestHandler: false, isRequestController: false, isAuthoritativeRequestHandler: false,
      isRequestBlockingHandler: false, isQueryLogger: true, isQueryLogs: true, isPostProcessor: false,
    },
  ],
}

const NODES = [
  { name: 'ns1.test', type: 'Primary' },
  { name: 'ns2.test', type: 'Secondary' },
  { name: 'ns3.test', type: 'Secondary' },
]

const entry = (rowNumber: number, timestamp: string, qname: string): QueryLogEntry => ({
  rowNumber, timestamp, clientIpAddress: '10.0.0.7', protocol: 'Udp', responseType: 'Recursive',
  rcode: 'NoError', qname, qtype: 'A', qclass: 'IN', answer: null,
})

const at = (s: number) => `2026-11-06T10:00:${String(s).padStart(2, '0')}Z`
/* ns1: rows 9 to 1 at even seconds; ns2: rows 3 to 1 at 13, 9 and 1 s. */
const NS1 = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => entry(r, at(r * 2), `a${r}.example`))
const NS2 = [entry(3, at(13), 'b3.example'), entry(2, at(9), 'b2.example'), entry(1, at(1), 'b1.example')]

/* ns1 and ns2 answer, ns3 fails. Each node's rows are numbered on its own, so both
   have a row 1. `totals` lets a test grow a node's log between Live Update turns. */
function serve(totals: Record<string, number> = { 'ns1.test': 7574, 'ns2.test': 4414 }) {
  vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: [APP] } } } as never)
  return vi.spyOn(logs, 'queryLogs').mockImplementation(async (_t, p: QueryLogsParams) => {
    const node = p.node ?? ''
    if (node === 'ns3.test') return { kind: 'error', message: 'The cluster node ns3.test did not respond.' } as never
    const entries = node === 'ns2.test' ? NS2 : NS1
    const n = Number(p.entriesPerPage)
    return {
      kind: 'ok',
      data: { response: { pageNumber: 1, totalPages: 9, totalEntries: totals[node] ?? 99, entries: entries.slice(0, n) } },
    } as never
  })
}

const sent = (spy: ReturnType<typeof serve>) => spy.mock.calls.map((c) => c[1])

function nav() {
  return { queryDnsServer: vi.fn<Handoff['queryDnsServer']>(), showQueryLogs: vi.fn<Handoff['showQueryLogs']>() }
}
function inShell(ui: ReactNode, handoff: Handoff = nav()) {
  return render(<HandoffContext.Provider value={handoff}>{ui}</HandoffContext.Provider>)
}

function servedAt(trail: string, route: string | null) {
  document.head.querySelector('meta[name="route"]')?.remove()
  if (route != null) {
    const m = document.createElement('meta')
    m.setAttribute('name', 'route')
    m.setAttribute('content', route)
    document.head.appendChild(m)
  }
  window.history.replaceState(null, '', trail)
  forgetRoot()
}

beforeEach(() => {
  servedAt('/logs/query-logs/', 'logs/query-logs')
  vi.stubGlobal('localStorage', { getItem: () => '10', setItem: () => {}, removeItem: () => {} })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  servedAt('/', null)
})

const cluster = { nodes: NODES, clusterInitialised: true }

async function allNodes() {
  await userEvent.click(await screen.findByRole('button', { name: 'All nodes' }))
}

describe('Query Logs, All nodes', () => {
  it('sends the filters to every node on page 1, newest first, at the page size, and merges the answers', async () => {
    const spy = serve()
    inShell(<Logs token="t" sub="Query Logs" {...cluster} />)
    await screen.findByLabelText('App Name')
    await choose(userEvent.setup(), screen.getByLabelText('Order'), 'Ascending')
    await userEvent.type(screen.getByLabelText('Page Number'), '{selectall}3')
    await allNodes()
    /* Pinned as Live Update pins them: the newest page is the one it sends. */
    expect(screen.getByLabelText('Order')).toBeDisabled()
    expect(valueShown(screen.getByLabelText('Order'))).toBe('Descending')
    expect(screen.getByLabelText('Page Number')).toHaveValue(1)
    expect(screen.getByLabelText('Page Number')).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Client IP Address'), '10.0.0.7')
    await userEvent.click(screen.getByRole('button', { name: 'Query' }))

    await screen.findAllByText('Newest 10 across the nodes')
    const calls = sent(spy)
    expect(calls.map((c) => c.node)).toEqual(['ns1.test', 'ns2.test', 'ns3.test'])
    for (const c of calls) {
      expect(c).toMatchObject({ pageNumber: '1', descendingOrder: 'true', entriesPerPage: '10', clientIpAddress: '10.0.0.7', name: APP.name })
    }

    /* Merged by time, newest first, and cut at the page's 10: a1 and b1 are left out. */
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[3].textContent)).toEqual([
      'a9.example', 'a8.example', 'a7.example', 'b3.example', 'a6.example',
      'a5.example', 'b2.example', 'a4.example', 'a3.example', 'a2.example',
    ])
    expect(rows.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual([
      'ns1.test', 'ns1.test', 'ns1.test', 'ns2.test', 'ns1.test', 'ns1.test', 'ns2.test', 'ns1.test', 'ns1.test', 'ns1.test',
    ])
    expect(screen.getByRole('columnheader', { name: 'Node' })).toBeInTheDocument()

    /* Each node's total, the failing node named once with the server's words. */
    expect(screen.getByText('Matching logs on each node')).toBeInTheDocument()
    expect(screen.getByText('7,574')).toBeInTheDocument()
    expect(screen.getByText('4,414')).toBeInTheDocument()
    const failed = screen.getByText('ns3.test').closest('[role="status"]') as HTMLElement
    expect(within(failed).getByText('ns3.test')).toBeInTheDocument()
    expect(failed).toHaveTextContent('ns3.test did not answer: The cluster node ns3.test did not respond.')
    expect(failed).toHaveTextContent('Their rows are missing here: only the nodes that answered are listed.')
    /* One page only: nothing after it. */
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it("the row's Query DNS Server goes to the row's node", async () => {
    serve()
    const handoff = nav()
    inShell(<Logs token="t" sub="Query Logs" {...cluster} />, handoff)
    await screen.findByLabelText('App Name')
    await allNodes()
    await userEvent.click(screen.getByRole('button', { name: 'Query' }))
    await screen.findByTitle('b2.example')

    await userEvent.click(screen.getByRole('button', { name: 'Actions for row 2 on ns2.test' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Query DNS Server' }))
    expect(handoff.queryDnsServer).toHaveBeenCalledWith('b2.example', 'A', 'ns2.test')
  })

  it('keeps the view in the address bar, reads it on arrival, and drops it with This node', async () => {
    servedAt('/logs/query-logs/?nodes=all&qname=x.example', 'logs/query-logs')
    const spy = serve()
    inShell(<Logs token="t" sub="Query Logs" {...cluster} />)
    await screen.findAllByText('Newest 10 across the nodes')
    expect(sent(spy).map((c) => [c.node, c.qname])).toEqual([
      ['ns1.test', 'x.example'], ['ns2.test', 'x.example'], ['ns3.test', 'x.example'],
    ])
    expect(new URLSearchParams(window.location.search).get('nodes')).toBe('all')

    spy.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'This node' }))
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('nodes')).toBeNull())
    /* Back to the screen's own node, one call, and no Node column. */
    await waitFor(() => expect(sent(spy).map((c) => c.node)).toEqual(['']))
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'Node' })).not.toBeInTheDocument())
  })

  it('arriving in the merged view pins page 1 and newest first in the form, and This node goes back to that', async () => {
    servedAt('/logs/query-logs/?nodes=all&pageNumber=4&descendingOrder=false', 'logs/query-logs')
    const spy = serve()
    inShell(<Logs token="t" sub="Query Logs" {...cluster} />)
    await screen.findAllByText('Newest 10 across the nodes')
    spy.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'This node' }))
    await waitFor(() => expect(sent(spy)).toHaveLength(1))
    expect(sent(spy)[0]).toMatchObject({ node: '', pageNumber: '1', descendingOrder: 'true' })
  })

  it('another screen’s ?nodes=all, left in the bar, is not read', async () => {
    servedAt('/cache/?nodes=all', null)
    serve()
    inShell(<Logs token="t" sub="Query Logs" {...cluster} />)
    await screen.findByLabelText('App Name')
    expect(screen.getByRole('button', { name: 'This node' })).toHaveAttribute('aria-pressed', 'true')
  })

  /* Generous waits: the full suite runs this beside two hundred other files, and a
     turn's first answer can take longer than `waitFor`'s default second there. */
  const SLOW = { timeout: 5000 }

  it('Live Update asks every node each turn, and counts what arrived on all of them', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ delay: null })
      const totals = { 'ns1.test': 100, 'ns2.test': 50 }
      const spy = serve(totals)
      inShell(<Logs token="t" sub="Query Logs" {...cluster} />)
      await vi.waitFor(() => expect(screen.queryByLabelText('App Name')).toBeInTheDocument(), SLOW)
      await user.click(screen.getByRole('button', { name: 'All nodes' }))
      await user.click(screen.getByLabelText('Live Update'))
      /* The clock also runs for real (`shouldAdvanceTime`), so under load a turn more
         may land: what is checked is that each turn asks the three nodes, in order. */
      const turns = () => {
        const nodes = sent(spy).map((c) => c.node)
        expect(nodes.length % 3).toBe(0)
        for (let i = 0; i < nodes.length; i += 3) expect(nodes.slice(i, i + 3)).toEqual(['ns1.test', 'ns2.test', 'ns3.test'])
        return nodes.length / 3
      }
      await vi.waitFor(() => expect(turns()).toBeGreaterThanOrEqual(1), SLOW)
      const first = turns()

      totals['ns1.test'] = 103
      totals['ns2.test'] = 52
      await vi.advanceTimersByTimeAsync(2000)
      await vi.waitFor(() => expect(turns()).toBeGreaterThan(first), SLOW)
      await vi.waitFor(() => expect(screen.getByText('5 new')).toBeInTheDocument(), SLOW)

      await user.click(screen.getByLabelText('Live Update'))
      await vi.waitFor(() => expect(sent(spy).length % 3).toBe(0), SLOW)
      const stopped = spy.mock.calls.length
      await vi.advanceTimersByTimeAsync(6000)
      expect(spy).toHaveBeenCalledTimes(stopped)
    } finally {
      vi.useRealTimers()
    }
  })

  it('with every node failing it says that no node answered', async () => {
    vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: [APP] } } } as never)
    vi.spyOn(logs, 'queryLogs').mockResolvedValue({ kind: 'error', message: 'Down.' } as never)
    inShell(<Logs token="t" sub="Query Logs" {...cluster} />)
    await screen.findByLabelText('App Name')
    await allNodes()
    await userEvent.click(screen.getByRole('button', { name: 'Query' }))
    expect(await screen.findByText('No node answered.')).toBeInTheDocument()
    expect(screen.getAllByText(/did not answer: Down\./)).toHaveLength(3)
  })
})

describe('Query Logs without a cluster', () => {
  it('draws no toggle, sends one query with the screen’s node, and ignores ?nodes=all', async () => {
    servedAt('/logs/query-logs/?nodes=all', 'logs/query-logs')
    const spy = serve()
    inShell(<Logs token="t" sub="Query Logs" nodes={[]} clusterInitialised={false} />)
    await screen.findByLabelText('App Name')
    expect(screen.queryByRole('button', { name: 'All nodes' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Query' }))
    await screen.findByTitle('a3.example')
    expect(sent(spy).map((c) => c.node)).toEqual([''])
    expect(screen.queryByRole('columnheader', { name: 'Node' })).not.toBeInTheDocument()
    expect(screen.queryByText('Matching logs on each node')).not.toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('nodes')).toBeNull()
  })

  it('an uninitialised cluster with nodes is a single server too', async () => {
    serve()
    inShell(<Logs token="t" sub="Query Logs" nodes={NODES} clusterInitialised={false} />)
    await screen.findByLabelText('App Name')
    expect(screen.queryByRole('group', { name: 'Query Logs view' })).not.toBeInTheDocument()
  })
})
