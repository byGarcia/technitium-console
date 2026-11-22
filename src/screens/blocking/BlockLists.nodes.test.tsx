import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as settings from '../../api/settings'
import * as dashboard from '../../api/dashboard'
import * as quick from '../../lib/quick-lists'
import { BlockLists } from './BlockLists'
import { nodeFailure } from './lists-on-nodes'

/* Deviation 39: the Lists tab's `Block Lists Across Nodes` card on a cluster. */

afterEach(() => {
  vi.restoreAllMocks()
})

const HOSTS = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'
const NODES = [
  { name: 'ns1.home.lan', type: 'Primary' },
  { name: 'ns2.home.lan', type: 'Secondary' },
  { name: 'ns3.home.lan', type: 'Secondary' },
]
const NEXT = '2999-01-02T07:11:00Z'
const ok = (data: unknown) => ({ kind: 'ok' as const, data: data as never })
const down = { kind: 'error' as const, message: 'The cluster node ns3.home.lan did not respond.' }

function serve({ failing = ['ns3.home.lan'] }: { failing?: string[] } = {}) {
  vi.spyOn(quick, 'loadQuickList').mockResolvedValue([])
  const read = vi.spyOn(settings, 'readSettings').mockImplementation(async (_t, node = '') => {
    if (failing.includes(node)) return down
    return ok({
      blockListUrls: [HOSTS],
      blockListUpdateIntervalHours: node === 'ns2.home.lan' ? 12 : 24,
      blockListNextUpdatedOn: NEXT,
    })
  })
  const stats = vi.spyOn(dashboard, 'getDashboardStats').mockImplementation(async (_t, _r, _c, node) => {
    if (failing.includes(node ?? '')) return down
    const block = node === 'ns1.home.lan' ? 1_203_411 : node === 'ns2.home.lan' ? 1_201_507 : 999
    return ok({ stats: { blockListZones: block, allowListZones: 0 } })
  })
  const force = vi.spyOn(settings, 'forceUpdateBlockLists').mockResolvedValue(true)
  return { read, stats, force }
}

describe('BlockLists on each node', () => {
  it('reads settings/get and stats/get once per node, each with its node', async () => {
    const { read, stats } = serve()
    render(<BlockLists token="T" permissions={undefined} clusterInitialised nodes={NODES} />)
    await screen.findByText('Did not answer: The cluster node ns3.home.lan did not respond.')
    for (const n of NODES) {
      expect(read).toHaveBeenCalledWith('T', n.name)
      expect(stats).toHaveBeenCalledWith('T', 'LastHour', undefined, n.name)
    }
    // The strip's own reads stay the cluster's.
    expect(read).toHaveBeenCalledWith('T', 'cluster')
    expect(stats).toHaveBeenCalledWith('T', 'LastHour', undefined, 'cluster')
  })

  it('draws each node its count, its last update and its next update', async () => {
    serve()
    render(<BlockLists token="T" permissions={undefined} clusterInitialised nodes={NODES} />)
    const row1 = (await screen.findByText('1,203,411')).closest('tr') as HTMLElement
    expect(row1).toHaveTextContent('ns1.home.lan')
    // Next update minus the interval: 24 h before for ns1, 12 h for ns2.
    expect(row1).toHaveTextContent('2999-01-01')
    const row2 = screen.getByText('1,201,507').closest('tr') as HTMLElement
    expect(row2).toHaveTextContent('ns2.home.lan')
    expect(row2).toHaveTextContent('2999-01-01')
  })

  it('names a failing node once, in its own row', async () => {
    serve()
    render(<BlockLists token="T" permissions={undefined} clusterInitialised nodes={NODES} />)
    const line = await screen.findByText('Did not answer: The cluster node ns3.home.lan did not respond.')
    expect(line.closest('tr')).toHaveTextContent('ns3.home.lan')
    expect(screen.getAllByText(/did not respond/)).toHaveLength(1)
  })

  it('an answer with no count in it is that node\'s count not read, and the card still draws', async () => {
    serve({ failing: [] })
    vi.mocked(dashboard.getDashboardStats).mockImplementation(async (_t, _r, _c, node) =>
      node === 'ns2.home.lan' ? ok({}) : ok({ stats: { blockListZones: 1_203_411, allowListZones: 0 } }))
    render(<BlockLists token="T" permissions={undefined} clusterInitialised nodes={NODES} />)
    const row2 = (await screen.findByText('ns2.home.lan', { selector: 'td *, td' })).closest('tr') as HTMLElement
    expect(row2).toHaveTextContent('Not read')
  })

  it('a row stands for a failed node only when its settings did not answer', () => {
    expect(nodeFailure({ node: 'a', domains: { kind: 'failed', message: 'x' }, schedule: { kind: 'ok', value: { next: null, interval: 24 } } })).toBeNull()
    expect(nodeFailure({ node: 'a', domains: null, schedule: { kind: 'failed', message: 'gone' } })).toBe('gone')
    expect(nodeFailure({ node: 'a', domains: { kind: 'failed', message: 'x' }, schedule: { kind: 'failed', message: 'gone' } })).toBe('gone')
  })

  it('Update Now moves into the card, asks upstream\'s question and sends upstream\'s call, with no node', async () => {
    const { force } = serve({ failing: [] })
    render(<BlockLists token="T" permissions={undefined} clusterInitialised nodes={NODES} />)
    await screen.findByText('1,203,411')
    expect(screen.queryByRole('button', { name: 'Update Now' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update Now on All Nodes' }))
    expect(force).not.toHaveBeenCalled()
    expect(screen.getByText('Are you sure to force download and update the block lists?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(force).toHaveBeenCalledTimes(1)
    expect(force).toHaveBeenCalledWith('T')
    expect(await screen.findByText('Block list update was triggered successfully.')).toBeInTheDocument()
    // All nodes are fetching now: each row says so, as the strip does.
    const rows = screen.getAllByRole('row')
    expect(rows.filter((r) => /Updating Now/.test(r.textContent ?? ''))).toHaveLength(NODES.length)
  })

  it('a Save that empties the lists during Update Now\'s wait ends its Updating Now', async () => {
    serve({ failing: [] })
    vi.spyOn(settings, 'setSettings').mockResolvedValue(ok({
      response: { blockListUrls: [], blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: NEXT },
    }))
    render(<BlockLists token="T" permissions={undefined} clusterInitialised nodes={NODES} />)
    await screen.findByText('1,203,411')
    await userEvent.click(screen.getByRole('button', { name: 'Update Now on All Nodes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    await screen.findByText('Block list update was triggered successfully.')
    await userEvent.click(screen.getByRole('button', { name: `Remove ${HOSTS}` }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('DNS Server settings were saved successfully.')
    await vi.waitFor(() => expect(screen.getAllByRole('row').filter((r) => /Updating Now/.test(r.textContent ?? ''))).toHaveLength(0))
  })

  it('without Dashboard: View the nodes\' counts are not asked for', async () => {
    const { stats, read } = serve({ failing: [] })
    render(
      <BlockLists token="T" permissions={{ Dashboard: { canView: false, canModify: false, canDelete: false } } as never}
        clusterInitialised nodes={NODES} />,
    )
    await screen.findByRole('heading', { name: 'Block Lists Across Nodes' })
    await vi.waitFor(() => expect(read).toHaveBeenCalledWith('T', 'ns2.home.lan'))
    expect(stats).not.toHaveBeenCalled()
    expect(screen.queryByRole('columnheader', { name: 'Block List Domains' })).not.toBeInTheDocument()
  })

  it('without a cluster nothing changes: no card, no per-node read, Update Now in the strip', async () => {
    const { read, stats } = serve({ failing: [] })
    render(<BlockLists token="T" permissions={undefined} clusterInitialised={false} nodes={NODES} />)
    expect(await screen.findByRole('button', { name: 'Update Now' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Block Lists Across Nodes' })).not.toBeInTheDocument()
    for (const n of NODES) {
      expect(read).not.toHaveBeenCalledWith('T', n.name)
      expect(stats).not.toHaveBeenCalledWith('T', 'LastHour', undefined, n.name)
    }
  })
})
