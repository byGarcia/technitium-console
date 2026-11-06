import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cluster } from './Cluster'
import { NodeSettings } from './NodeSettings'
import * as client from '../../api/client'
import { CLUSTER_NOT_INITIALISED, CLUSTER_PRIMARY } from './admin.fixture'
import { SETTINGS } from '../settings/settings.fixture'
import type { ClusterState } from '../../api/admin-cluster'
import type { DnsSettings } from '../../api/settings'

/*
Deviation 31: Settings Across Nodes, under the Cluster table. One `settings/get`
per node, the node's name in `node`; the cluster could not be observed live, so the
answers are the reference instance's `settings/get` with each node's domain.
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

function server({
  state = THREE,
  settings = {},
  failing = ['ns3.mycluster.test'],
}: { state?: ClusterState; settings?: Record<string, Partial<DnsSettings>>; failing?: string[] } = {}) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string, opts?: { body?: Record<string, string> }) => {
    if (path === 'admin/cluster/state') return ok({ response: state, server: 'x' })
    if (path === 'settings/get') {
      const node = opts?.body?.node ?? ''
      if (failing.includes(node)) return { kind: 'error' as const, message: 'The remote server did not respond.' }
      return ok({ response: { ...SETTINGS, dnsServerDomain: node, ...settings[node] } })
    }
    return ok({ response: {} })
  })
}

const props = { token: 'tok', cluster: null, onCluster: vi.fn(), onNotice: vi.fn() }
const card = async () => {
  const heading = await screen.findByRole('heading', { name: 'Settings Across Nodes' })
  // The panel: the title's header row, then the panel around it.
  return heading.parentElement!.parentElement as HTMLElement
}
const settingRows = (t: HTMLElement) =>
  within(within(t).getByRole('table')).getAllByRole('row').slice(1)

describe('Settings Across Nodes', () => {
  it('reads settings/get once per node, with its name in node', async () => {
    const api = server()
    render(<Cluster {...props} />)
    await screen.findByText('All settings agree')
    const reads = api.mock.calls.filter((c) => c[0] === 'settings/get')
    expect(reads.map((c) => (c[1] as { body: Record<string, string> }).body.node)).toEqual([
      'ns1.mycluster.test',
      'ns2.mycluster.test',
      'ns3.mycluster.test',
    ])
    expect(reads.every((c) => (c[1] as { token: string }).token === 'tok')).toBe(true)
  })

  it('draws nothing and reads nothing while the cluster is not initialised', async () => {
    const api = server({ state: CLUSTER_NOT_INITIALISED })
    render(<Cluster {...props} />)
    await screen.findByText('Cluster Not Initialized')
    expect(screen.queryByRole('heading', { name: 'Settings Across Nodes' })).not.toBeInTheDocument()
    expect(api.mock.calls.some((c) => c[0] === 'settings/get')).toBe(false)
  })

  it('a node that does not answer keeps its column, marked Unavailable, with the message of the server', async () => {
    server()
    render(<Cluster {...props} />)
    await screen.findByText('All settings agree')
    const t = await card()
    const head = within(t).getAllByRole('columnheader')
    expect(head.map((h) => h.textContent)).toEqual([
      'Setting',
      'ns1.mycluster.test',
      'ns2.mycluster.test',
      'ns3.mycluster.test Unavailable',
    ])
    expect(within(t).getByText(/did not answer: The remote server did not respond\./)).toHaveTextContent(
      'ns3.mycluster.test did not answer: The remote server did not respond.',
    )
    // Its cells are empty; the two that answered are compared alone.
    const version = settingRows(t).find((r) => r.textContent?.includes('Version'))!
    expect(within(version).getAllByRole('cell').map((c) => c.textContent)).toEqual(['IdentityVersion', '15.4', '15.4', ''])
  })

  it('lists the differing settings first, marked, says how many, and can show only them', async () => {
    const user = userEvent.setup()
    server({ settings: { 'ns2.mycluster.test': { forwarderProtocol: 'Https' } } })
    render(<Cluster {...props} />)
    await screen.findByText('1 setting differs')
    const t = await card()
    const rows = settingRows(t)
    expect(rows[0]).toHaveTextContent('Forwarder Protocol')
    expect(rows[0]).toHaveAttribute('data-differs')
    expect(within(rows[0]).getByText('Differs')).toBeInTheDocument()
    expect(within(rows[0]).getAllByRole('cell').slice(1).map((c) => c.textContent)).toEqual([
      'DNS-over-UDP',
      'DNS-over-HTTPS',
      '',
    ])
    expect(rows[1]).toHaveTextContent('DNS Server Domain')
    expect(rows[1]).not.toHaveAttribute('data-differs')
    expect(within(t).getAllByText('Differs')).toHaveLength(1)

    await user.click(within(t).getByLabelText('Show only differences'))
    expect(settingRows(t)).toHaveLength(1)
    await user.click(within(t).getByLabelText('Show only differences'))
    expect(settingRows(t).length).toBeGreaterThan(1)
  })

  it('with every setting matching, the toggle has nothing to hide', async () => {
    server()
    render(<Cluster {...props} />)
    await screen.findByText('All settings agree')
    expect(within(await card()).getByLabelText('Show only differences')).toBeDisabled()
  })

  it('reads again when the cluster is refreshed', async () => {
    const user = userEvent.setup()
    const api = server()
    render(<Cluster {...props} />)
    await screen.findByText('All settings agree')
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(api.mock.calls.filter((c) => c[0] === 'settings/get')).toHaveLength(6))
  })

  it('without Settings: View it reads nothing and says which permission is missing', async () => {
    const api = server()
    render(<Cluster {...props} canViewSettings={false} />)
    const t = await card()
    expect(within(t).getByText('Requires Settings: View')).toBeInTheDocument()
    expect(api.mock.calls.some((c) => c[0] === 'settings/get')).toBe(false)
  })

  it('an invalid session is said in words, not left blank', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'invalid-token' })
    render(<NodeSettings token="tok" nodes={CLUSTER_PRIMARY.clusterNodes!} canView refreshOn={1} />)
    expect(await screen.findByText('No node answered')).toBeInTheDocument()
    expect(screen.getAllByText(/did not answer: Invalid token or session expired\./)).toHaveLength(2)
  })
})
