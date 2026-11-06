import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cluster } from './Cluster'
import * as client from '../../api/client'
import { CLUSTER_NOT_INITIALISED, CLUSTER_PRIMARY } from './admin.fixture'
import type { ClusterState } from '../../api/admin-cluster'
import { sharesOf, type NodeRead } from './query-share'

/*
Deviation 40: Queries Across Nodes, under the Cluster table. The period's Total
Queries of `dashboard/stats/get` once per node, the node's name in `node`.
*/

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

const THREE: ClusterState = {
  ...CLUSTER_PRIMARY,
  clusterNodes: [
    ...CLUSTER_PRIMARY.clusterNodes!,
    { ...CLUSTER_PRIMARY.clusterNodes![1], id: 3, name: 'ns3.mycluster.test', url: 'https://ns3.mycluster.test:53443', state: 'Unreachable' },
  ],
}
const TOTALS: Record<string, number> = { 'ns1.mycluster.test': 14_322, 'ns2.mycluster.test': 10_114 }

function server({ state = THREE, failing = ['ns3.mycluster.test'] }: { state?: ClusterState; failing?: string[] } = {}) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string, opts?: { body?: Record<string, string>; node?: string | null }) => {
    if (path === 'admin/cluster/state') return ok({ response: state, server: 'x' })
    if (path === 'dashboard/stats/get') {
      const node = opts?.node ?? ''
      if (failing.includes(node)) return { kind: 'error' as const, message: 'The remote server did not respond.' }
      return ok({ response: { stats: { totalQueries: TOTALS[node] ?? 0 } } })
    }
    return ok({ response: {} })
  })
}

const props = { token: 'tok', cluster: null, onCluster: vi.fn(), onNotice: vi.fn(), canViewSettings: false }
const card = async () => (await screen.findByRole('heading', { name: 'Queries Across Nodes' })).parentElement!.parentElement as HTMLElement
const statReads = (api: ReturnType<typeof server>) => api.mock.calls.filter((c) => c[0] === 'dashboard/stats/get')

describe('Queries Across Nodes', () => {
  it('reads stats/get once per node, with its node and Last Day', async () => {
    const api = server()
    render(<Cluster {...props} />)
    await screen.findByText('14,322')
    const reads = statReads(api)
    expect(reads.map((c) => (c[1] as { node?: string }).node).sort()).toEqual(['ns1.mycluster.test', 'ns2.mycluster.test', 'ns3.mycluster.test'])
    for (const c of reads) expect((c[1] as { body: Record<string, string> }).body).toEqual({ type: 'LastDay', utc: 'true' })
  })

  it('draws each node with its count and share, and names a failing node once', async () => {
    server()
    render(<Cluster {...props} />)
    const t = await card()
    await within(t).findByText('14,322')
    const items = within(t).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['ns1.mycluster.test14,32259%', 'ns2.mycluster.test10,11441%'])
    expect(within(t).getByText(/did not answer: The remote server did not respond\./)).toHaveTextContent(
      'ns3.mycluster.test did not answer: The remote server did not respond.',
    )
    expect(within(t).getAllByText('ns3.mycluster.test')).toHaveLength(1)
  })

  it('reads again for another period', async () => {
    const api = server({ failing: [] })
    render(<Cluster {...props} />)
    const t = await card()
    await within(t).findByText('14,322')
    await userEvent.click(within(t).getByRole('button', { name: 'Last Week' }))
    await waitFor(() => expect(statReads(api).filter((c) => (c[1] as { body: Record<string, string> }).body.type === 'LastWeek')).toHaveLength(3))
  })

  it('says so when no node answered', async () => {
    server({ failing: ['ns1.mycluster.test', 'ns2.mycluster.test', 'ns3.mycluster.test'] })
    render(<Cluster {...props} />)
    expect(await within(await card()).findByText('No node answered.')).toBeInTheDocument()
  })

  it('without Dashboard: View nothing is read and the card says what is missing', async () => {
    const api = server()
    render(<Cluster {...props} canViewDashboard={false} />)
    expect(await within(await card()).findByText('Requires Dashboard: View')).toBeInTheDocument()
    expect(statReads(api)).toHaveLength(0)
  })

  it('without a cluster nothing is drawn or read', async () => {
    const api = server({ state: CLUSTER_NOT_INITIALISED })
    render(<Cluster {...props} />)
    await screen.findByText('Cluster Not Initialized')
    expect(screen.queryByRole('heading', { name: 'Queries Across Nodes' })).not.toBeInTheDocument()
    expect(statReads(api)).toHaveLength(0)
  })
})

describe('sharesOf', () => {
  const read = (node: string, total: number | null): NodeRead => ({
    node,
    outcome: total == null ? { kind: 'error', message: 'gone' } : ({ kind: 'ok', data: { stats: { totalQueries: total } } } as never),
  })

  it('shares the total of the nodes that answered, in whole percents that add up to 100', () => {
    const s = sharesOf([read('a', 1), read('b', 1), read('c', 1), read('d', null)])
    expect(s.total).toBe(3)
    expect(s.shares.map((x) => x.percent)).toEqual([34, 33, 33])
    expect(s.shares.map((x) => x.fraction)).toEqual([1 / 3, 1 / 3, 1 / 3])
    expect(s.failed).toEqual([{ node: 'd', message: 'gone' }])
  })

  it('gives the largest remainder the point left', () => {
    expect(sharesOf([read('a', 14_322), read('b', 10_114)]).shares.map((x) => x.percent)).toEqual([59, 41])
    expect(sharesOf([read('a', 1), read('b', 2)]).shares.map((x) => x.percent)).toEqual([33, 67])
  })

  it('a period with no queries is zero for everyone, not a division by zero', () => {
    const s = sharesOf([read('a', 0), read('b', 0)])
    expect(s.total).toBe(0)
    expect(s.shares.map((x) => [x.fraction, x.percent])).toEqual([[0, 0], [0, 0]])
  })
})
