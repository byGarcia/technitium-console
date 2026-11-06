/*
Deviation 35 on the screen: Cache's `All nodes`. The switch beside the node selector
and where it is kept, the reads it adds (cache/list once per node, with its node),
the merged table with a TTL column per node, the filters, a node that fails, Flush
Cache staying on the chosen node, and a single server where nothing changes.
*/
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cache } from './Lists'
import * as api from '../../api/zonelists'
import type { DnsRecord, ListNode } from '../../api/zonelists'

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

const NODES = [
  { name: 'ns1.test', type: 'Primary' },
  { name: 'ns2.test', type: 'Secondary' },
  { name: 'ns3.test', type: 'Secondary' },
]

const rec = (type: string, ttl: string, rData: Record<string, unknown>, name = 'example.com') =>
  ({ name, type, ttl, rData, dnssecStatus: 'Insecure' }) as DnsRecord
const A = (ttl: string) => rec('A', ttl, { ipAddress: '93.184.216.34' })
const MX = (ttl: string) => rec('MX', ttl, { preference: 10, exchange: 'mail.example.com' })

const HELD: Record<string, ListNode> = {
  '': { domain: 'example.com', zones: ['api.example.com'], records: [A('2141 (35m41s)'), MX('300 (5m)')] },
  'ns1.test': { domain: 'example.com', zones: ['api.example.com'], records: [A('2141 (35m41s)'), MX('300 (5m)')] },
  'ns2.test': { domain: 'example.com', zones: ['cdn.example.com'], records: [A('1974 (32m54s)')] },
}

function serving({ failing = ['ns3.test'] }: { failing?: string[] } = {}) {
  return vi.spyOn(api, 'listNode').mockImplementation(async (_list, _token, domain, _dir, node = '') => {
    if (failing.includes(node)) return { kind: 'error', message: `${node} did not answer.` }
    if (domain === 'example.com') return { kind: 'ok', data: HELD[node] ?? HELD[''] }
    return { kind: 'ok', data: { domain: '', zones: ['com'], records: [] } }
  })
}

const onNode = (spy: ReturnType<typeof serving>, node: string) => spy.mock.calls.filter((c) => c[4] === node)

async function openAcross() {
  window.history.replaceState(null, '', '/cache/?domain=example.com')
  const spy = serving()
  render(<Cache token="t" nodes={NODES} clusterInitialised />)
  await screen.findByRole('heading', { level: 1, name: 'example.com' })
  await userEvent.click(screen.getByRole('button', { name: 'All nodes' }))
  await screen.findByRole('columnheader', { name: /ns1\.test/ })
  return spy
}

describe('Cache: All nodes', () => {
  it('reads the domain on screen once from every node, with that node', async () => {
    const spy = await openAcross()
    for (const n of NODES) {
      const calls = onNode(spy, n.name)
      expect(calls).toHaveLength(1)
      expect(calls[0].slice(0, 4)).toEqual(['cache', 't', 'example.com', undefined])
    }
  })

  it('merges the records, one TTL column per node', async () => {
    await openAcross()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('93.184.216.34')
    expect(rows[0]).toHaveTextContent('2141 (35m41s)')
    expect(rows[0]).toHaveTextContent('1974 (32m54s)')
    expect(rows[1]).toHaveTextContent('300 (5m)')
    expect(rows[1]).toHaveTextContent('not cached here')
    expect(screen.getByText(/2 records at/)).toHaveTextContent('2 records at example.com across 3 nodes')
  })

  it('says each node keeps its own cache, once, and how many records each holds here', async () => {
    await openAcross()
    expect(screen.getAllByText(/Each node keeps its own cache/)).toHaveLength(1)
    const ns1 = screen.getByRole('heading', { level: 2, name: 'ns1.test' }).parentElement!
    expect(ns1).toHaveTextContent('2records at example.com')
    const ns2 = screen.getByRole('heading', { level: 2, name: 'ns2.test' }).parentElement!
    expect(ns2).toHaveTextContent('1records at example.com')
  })

  it('a node that fails says so on its card and in its column', async () => {
    await openAcross()
    const ns3 = screen.getByRole('heading', { level: 2, name: 'ns3.test' }).parentElement!
    expect(ns3).toHaveTextContent('Could not read this node. ns3.test did not answer.')
    expect(screen.getByRole('columnheader', { name: /ns3\.test/ })).toHaveTextContent('Not read')
    for (const row of screen.getAllByRole('row').slice(1)) expect(row).toHaveTextContent('not read')
  })

  it('filters by how many nodes hold a record, with the counts', async () => {
    await openAcross()
    const group = screen.getByRole('group', { name: 'Records across nodes' })
    expect(within(group).getByRole('button', { name: 'All 2' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(group).getByRole('button', { name: 'On all nodes 1' }))
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1)
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('A')
    expect(screen.getByText(/1 of 2 records/)).toHaveTextContent('1 of 2 records at example.com, on every node')
    await userEvent.click(within(group).getByRole('button', { name: 'Missing on some nodes 1' }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('MX')
  })

  it('the zones of every node are offered', async () => {
    await openAcross()
    expect(screen.getByText('2 zones')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cdn.example.com' })).toBeInTheDocument()
  })

  it('is kept in the address bar, read on arrival, and dropped with the screen', async () => {
    await openAcross()
    expect(new URLSearchParams(window.location.search).get('nodes')).toBe('all')
    await userEvent.click(screen.getByRole('button', { name: 'All nodes' }))
    expect(new URLSearchParams(window.location.search).get('nodes')).toBeNull()
    expect(screen.queryByRole('columnheader', { name: /ns1\.test/ })).not.toBeInTheDocument()

    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/cache/?domain=example.com&nodes=all')
    const spy = serving()
    const { unmount } = render(<Cache token="t" nodes={NODES} clusterInitialised />)
    expect(await screen.findAllByRole('button', { name: 'All nodes', pressed: true })).not.toHaveLength(0)
    await waitFor(() => expect(onNode(spy, 'ns2.test')).toHaveLength(1))
    unmount()
    expect(window.location.search).toBe('')
  })

  it('Flush Cache still goes to the node chosen in the selector', async () => {
    await openAcross()
    const flush = vi.spyOn(api, 'flushCache').mockResolvedValue({ kind: 'ok', data: {} })
    await userEvent.click(screen.getByRole('combobox', { name: 'Cluster Node' }))
    await userEvent.click(screen.getByRole('option', { name: 'ns2.test (secondary)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Flush Cache' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Flush Cache' }))
    await waitFor(() => expect(flush).toHaveBeenCalledWith('t', 'ns2.test'))
  })

  it('without a cluster nothing changes: no switch, and the bar does not open it', async () => {
    window.history.replaceState(null, '', '/cache/?domain=example.com&nodes=all')
    const spy = serving()
    render(<Cache token="t" />)
    await screen.findByRole('heading', { level: 1, name: 'example.com' })
    expect(screen.queryByRole('button', { name: 'All nodes' })).not.toBeInTheDocument()
    expect(spy.mock.calls.every((c) => c[4] === '')).toBe(true)
    expect(screen.getByRole('group', { name: 'Records by type' })).toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('nodes')).toBeNull()
  })
})
