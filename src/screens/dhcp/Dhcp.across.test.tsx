/*
DHCP across the cluster's nodes (deviation 38), on the screen: every node's lists
read with its `node`, a Node column, the cards summing the nodes, a failing node
named, the row's node for every action, each scope's usage on its own node, the
view in the address bar, and nothing changed without a cluster.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Dhcp, type SubTab } from './Dhcp'
import * as api from '../../api/dhcp'
import type { DhcpLease, DhcpScope, DhcpScopeRow } from '../../api/dhcp'
import { forgetRoot } from '../../app/route'

const NODES = [
  { name: 'ns1.test', type: 'Primary' },
  { name: 'ns2.test', type: 'Secondary' },
  { name: 'ns3.test', type: 'Secondary' },
]

const lease = (address: string, clientIdentifier: string, type = 'Dynamic'): DhcpLease => ({
  scope: 'LAN', type, clientIdentifier, hardwareAddress: '02-00-00-00-00-01', address, hostName: `h-${address}`,
  leaseObtained: '2026-11-06T07:00:00Z', leaseExpires: '2026-11-07T07:00:00Z',
})
/* Both nodes have a scope called LAN, and both lease to client 1-a. */
const LEASES: Record<string, DhcpLease[]> = {
  'ns1.test': [lease('10.0.0.10', '1-a'), lease('10.0.0.11', '1-b', 'Reserved')],
  'ns2.test': [lease('10.0.1.10', '1-a')],
}
const LAN: DhcpScopeRow = {
  name: 'LAN', enabled: true, startingAddress: '10.0.0.1', endingAddress: '10.0.0.10', subnetMask: '255.255.255.0',
  networkAddress: '10.0.0.0', broadcastAddress: '10.0.0.255', interfaceAddress: '10.0.0.2',
}
const SCOPES: Record<string, DhcpScopeRow[]> = {
  'ns1.test': [LAN],
  'ns2.test': [{ ...LAN, startingAddress: '10.0.1.1', endingAddress: '10.0.1.4', enabled: false }],
}
const DETAIL: DhcpScope = {
  name: 'LAN', startingAddress: '10.0.1.1', endingAddress: '10.0.1.4', subnetMask: '255.255.255.0',
  leaseTimeDays: 1, leaseTimeHours: 0, leaseTimeMinutes: 0, offerDelayTime: 0, pingCheckEnabled: false,
  pingCheckTimeout: 1000, pingCheckRetries: 2, dnsUpdates: true, dnsOverwriteForDynamicLease: false, dnsTtl: 900,
  useThisDnsServer: true, reservedLeases: [], allowOnlyReservedLeases: false,
  blockLocallyAdministeredMacAddresses: false, ignoreClientIdentifierOption: false,
}

const DOWN = { kind: 'error' as const, message: 'The cluster node ns3.test did not respond.' }
const OK = { kind: 'ok' as const, data: {} }

function serve() {
  const leases = vi.spyOn(api, 'listLeases').mockImplementation(async (_t, node = '') =>
    node === 'ns3.test' ? DOWN : { kind: 'ok', data: LEASES[node === '' ? 'ns1.test' : node] },
  )
  const scopes = vi.spyOn(api, 'listScopes').mockImplementation(async (_t, node = '') =>
    node === 'ns3.test' ? DOWN : { kind: 'ok', data: SCOPES[node === '' ? 'ns1.test' : node] },
  )
  return { leases, scopes }
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
const param = (name: string) => new URLSearchParams(window.location.search).get(name)

function Section({ first, cluster = true }: { first: SubTab; cluster?: boolean }) {
  const [sub, setSub] = useState<SubTab>(first)
  return (
    <Dhcp
      token="t"
      nodes={cluster ? NODES : []}
      clusterInitialised={cluster}
      sub={sub}
      onSubChange={(t) => {
        setSub(t)
        window.history.pushState(null, '', `/dhcp/${t.toLowerCase()}/${window.location.search}`)
      }}
    />
  )
}

beforeEach(() => servedAt('/dhcp/leases/', 'dhcp/leases'))
afterEach(() => {
  vi.restoreAllMocks()
  servedAt('/', null)
})

const cells = (row: HTMLElement) => within(row).queryAllByRole('cell').map((c) => c.textContent)

describe('Leases, All nodes', () => {
  it("reads every node's leases with its node, draws them with a Node column, sums them, and names the failing node", async () => {
    const { leases } = serve()
    render(<Section first="Leases" />)
    await screen.findByText('Total Leases: 2')
    expect(leases.mock.calls.map((c) => c[1])).toEqual([''])

    await userEvent.click(screen.getByRole('button', { name: 'All nodes' }))
    await screen.findByText('Total Leases: 3')
    expect(leases.mock.calls.slice(1).map((c) => c[1])).toEqual(['ns1.test', 'ns2.test', 'ns3.test'])
    expect(param('nodes')).toBe('all')

    expect(screen.getByRole('columnheader', { name: 'Node' })).toBeInTheDocument()
    expect(cells(screen.getByRole('row', { name: /10\.0\.1\.10/ }))[0]).toBe('ns2.test')
    expect(cells(screen.getByRole('row', { name: /10\.0\.0\.10/ }))[0]).toBe('ns1.test')
    expect(screen.getByText('ns3.test', { selector: 'b' }).closest('[role="status"]')).toHaveTextContent(
      'ns3.test did not answer: The cluster node ns3.test did not respond.',
    )
    expect(screen.getByText('Their rows are missing here: only the nodes that answered are listed.')).toBeInTheDocument()
  })

  it("converts and removes a lease on the row's node", async () => {
    const user = userEvent.setup()
    serve()
    const reserve = vi.spyOn(api, 'convertToReservedLease').mockResolvedValue(OK)
    const remove = vi.spyOn(api, 'removeLease').mockResolvedValue(OK)
    servedAt('/dhcp/leases/?nodes=all', 'dhcp/leases')
    render(<Section first="Leases" />)
    await screen.findByText('Total Leases: 3')

    const ns2 = within(screen.getByRole('row', { name: /10\.0\.1\.10/ }))
    await user.click(ns2.getByRole('button', { name: 'Convert To Reserved Lease' }))
    await user.click(screen.getByRole('button', { name: 'Convert' }))
    await waitFor(() => expect(reserve).toHaveBeenCalledWith('t', 'LAN', '1-a', 'ns2.test'))
    /* Only that node's row changed: ns1's lease to the same client is still Dynamic. */
    expect(within(screen.getByRole('row', { name: /10\.0\.1\.10/ })).getByText('Reserved')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /10\.0\.0\.10/ })).getByText('Dynamic')).toBeInTheDocument()

    await user.click(within(screen.getByRole('row', { name: /10\.0\.0\.10/ })).getByRole('button', { name: 'Actions for 10.0.0.10' }))
    await user.click(screen.getByRole('menuitem', { name: 'Remove Lease' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('t', 'LAN', '1-a', 'ns1.test'))
    await waitFor(() => expect(screen.queryByRole('row', { name: /10\.0\.0\.10/ })).not.toBeInTheDocument())
    expect(screen.getByRole('row', { name: /10\.0\.1\.10/ })).toBeInTheDocument()
  })

  it('with every node failing it says that no node answered', async () => {
    vi.spyOn(api, 'listLeases').mockResolvedValue(DOWN)
    servedAt('/dhcp/leases/?nodes=all', 'dhcp/leases')
    render(<Section first="Leases" />)
    expect(await screen.findByText('Could not load the list.')).toBeInTheDocument()
    expect(screen.getByText('No node answered.')).toBeInTheDocument()
  })
})

describe('Scopes, All nodes', () => {
  beforeEach(() => servedAt('/dhcp/scopes/?nodes=all', 'dhcp/scopes'))

  it("reads every node's scopes and leases, sums the cards, and each row's usage is its own node's", async () => {
    const { scopes, leases } = serve()
    render(<Section first="Scopes" />)
    await screen.findByText('Total Scopes: 2')
    expect(scopes.mock.calls.map((c) => c[1])).toEqual(['ns1.test', 'ns2.test', 'ns3.test'])
    expect(leases.mock.calls.map((c) => c[1])).toEqual(['ns1.test', 'ns2.test', 'ns3.test'])

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => cells(r)[0])).toEqual(['ns1.test', 'ns2.test'])
    /* ns1's LAN holds ns1's two leases of its ten addresses; ns2's is disabled. */
    expect(screen.getByRole('img', { name: 'LAN: 2 of the 10 addresses in its range leased, 20%' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /addresses in its range leased/ })).toHaveLength(1)
    expect(screen.getByText('ns3.test', { selector: 'b' }).closest('[role="status"]')).toHaveTextContent('ns3.test did not answer')
  })

  it("enables, opens and deletes a scope on the row's node, and the open scope keeps its node in the bar", async () => {
    const user = userEvent.setup()
    serve()
    const enable = vi.spyOn(api, 'enableScope').mockResolvedValue(OK)
    const get = vi.spyOn(api, 'getScope').mockResolvedValue(DETAIL)
    const del = vi.spyOn(api, 'deleteScope').mockResolvedValue(OK)
    render(<Section first="Scopes" />)
    await screen.findByText('Total Scopes: 2')

    const ns2 = () => screen.getAllByRole('row').find((r) => cells(r)[0] === 'ns2.test') as HTMLElement
    await user.click(within(ns2()).getByRole('button', { name: 'Enable Scope' }))
    await waitFor(() => expect(enable).toHaveBeenCalledWith('t', 'LAN', 'ns2.test'))

    await screen.findByText('Total Scopes: 2')
    await user.click(within(ns2()).getByRole('button', { name: 'LAN' }))
    await waitFor(() => expect(get).toHaveBeenCalledWith('t', 'LAN', 'ns2.test'))
    await waitFor(() => expect(param('scope')).toBe('LAN'))
    expect(param('on')).toBe('ns2.test')

    await user.click(screen.getByRole('button', { name: 'Scopes' }))
    await screen.findByText('Total Scopes: 2')
    expect(param('on')).toBeNull()
    await user.click(within(ns2()).getByRole('button', { name: 'Actions for LAN' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete Scope' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('t', 'LAN', 'ns2.test'))
    await waitFor(() => expect(screen.getAllByRole('row').slice(1).map((r) => cells(r)[0])).toEqual(['ns1.test']))
  })

  it('a link to a scope opened from All nodes opens it on its node', async () => {
    servedAt('/dhcp/scopes/?nodes=all&scope=LAN&on=ns2.test', 'dhcp/scopes')
    serve()
    const get = vi.spyOn(api, 'getScope').mockResolvedValue(DETAIL)
    render(<Section first="Scopes" />)
    await waitFor(() => expect(get).toHaveBeenCalledWith('t', 'LAN', 'ns2.test'))
  })

  it('the view stays when the tab changes, and goes with This node', async () => {
    const user = userEvent.setup()
    const { leases } = serve()
    render(<Section first="Scopes" />)
    await screen.findByText('Total Scopes: 2')
    leases.mockClear()
    await user.click(screen.getByRole('button', { name: 'This node' }))
    await waitFor(() => expect(param('nodes')).toBeNull())
    await screen.findByText('Total Scopes: 1')
    expect(screen.queryByRole('columnheader', { name: 'Node' })).not.toBeInTheDocument()
    expect(leases.mock.calls.map((c) => c[1])).toEqual([''])
  })
})

describe('DHCP without a cluster', () => {
  it('draws no toggle, reads the one server, and ignores ?nodes=all', async () => {
    servedAt('/dhcp/leases/?nodes=all', 'dhcp/leases')
    const { leases } = serve()
    render(<Section first="Leases" cluster={false} />)
    await screen.findByText('Total Leases: 2')
    expect(screen.queryByRole('group', { name: 'DHCP view' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Node' })).not.toBeInTheDocument()
    expect(leases.mock.calls.map((c) => c[1])).toEqual([''])
    expect(param('nodes')).toBeNull()
  })
})
