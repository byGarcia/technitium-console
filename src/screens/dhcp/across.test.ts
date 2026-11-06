/*
DHCP across the cluster's nodes (deviation 38): every node's lists with their
`node`, a failing node named, and the usage and the pool counted per node, since
two nodes can each have a scope of the same name.
*/
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../api/dhcp'
import type { DhcpLease, DhcpScopeRow } from '../../api/dhcp'
import { leasesAcross, scopeKey, scopesAcross } from './across'
import { leaseKey, poolTotals, scopeUsage } from './pool'

afterEach(() => vi.restoreAllMocks())

const NODES = [
  { name: 'ns1', type: 'Primary' },
  { name: 'ns2', type: 'Secondary' },
  { name: 'ns3', type: 'Secondary' },
]

const lease = (scope: string, clientIdentifier: string, type = 'Dynamic'): DhcpLease => ({
  scope, type, clientIdentifier, hardwareAddress: '02-00-00-00-00-01', address: '10.0.0.10', hostName: 'h',
  leaseObtained: '2026-11-06T07:00:00Z', leaseExpires: '2026-11-07T07:00:00Z',
})
const LAN: DhcpScopeRow = {
  name: 'LAN', enabled: true, startingAddress: '10.0.0.1', endingAddress: '10.0.0.10', subnetMask: '255.255.255.0',
  networkAddress: '10.0.0.0', broadcastAddress: '10.0.0.255',
}

describe('the reads', () => {
  it('leases from every node with its node, a failure named with the server’s message', async () => {
    const spy = vi.spyOn(api, 'listLeases').mockImplementation(async (_t, node) =>
      node === 'ns3' ? { kind: 'error', message: 'ns3 is down.' } : { kind: 'ok', data: [lease('LAN', `1-${node}`)] },
    )
    const all = await leasesAcross('t', NODES)
    expect(spy.mock.calls.map((c) => c[1])).toEqual(['ns1', 'ns2', 'ns3'])
    expect(all.leases.map((l) => l.node)).toEqual(['ns1', 'ns2'])
    expect(all.failed).toEqual([{ node: 'ns3', message: 'ns3 is down.' }])
    expect(all.answered).toBe(2)
  })

  it('scopes and leases from every node; a node counts only when both lists answered', async () => {
    const scopes = vi.spyOn(api, 'listScopes').mockImplementation(async (_t, node) =>
      node === 'ns3' ? { kind: 'error', message: 'ns3 is down.' } : { kind: 'ok', data: [LAN] },
    )
    const leases = vi.spyOn(api, 'listLeases').mockImplementation(async (_t, node) =>
      node === 'ns2' ? { kind: 'error', message: 'Access was denied.' } : { kind: 'ok', data: [lease('LAN', '1-a')] },
    )
    const all = await scopesAcross('t', NODES)
    expect(scopes.mock.calls.map((c) => c[1])).toEqual(['ns1', 'ns2', 'ns3'])
    expect(leases.mock.calls.map((c) => c[1])).toEqual(['ns1', 'ns2', 'ns3'])
    expect(all.scopes.map((s) => s.node)).toEqual(['ns1'])
    expect(all.leases.map((l) => l.node)).toEqual(['ns1'])
    expect(all.failed).toEqual([
      { node: 'ns2', message: 'Access was denied.' },
      { node: 'ns3', message: 'ns3 is down.' },
    ])
  })
})

describe('per node', () => {
  const leases = [
    { ...lease('LAN', '1-a'), node: 'ns1' },
    { ...lease('LAN', '1-b', 'Reserved'), node: 'ns1' },
    { ...lease('LAN', '1-a'), node: 'ns2' },
  ]

  it("a scope's usage counts only its own node's leases", () => {
    expect(scopeUsage({ ...LAN, node: 'ns1' }, leases)).toMatchObject({ leased: 2, dynamic: 1, reserved: 1, size: 10 })
    expect(scopeUsage({ ...LAN, node: 'ns2' }, leases)).toMatchObject({ leased: 1, size: 10 })
  })

  it('the pool sums the nodes without counting a lease twice', () => {
    expect(poolTotals([{ ...LAN, node: 'ns1' }, { ...LAN, node: 'ns2' }], leases)).toEqual({ addresses: 20, leased: 3 })
  })

  it('with one node, the name alone, as before', () => {
    expect(scopeUsage(LAN, [lease('LAN', '1-a')])).toMatchObject({ leased: 1 })
    expect(poolTotals([LAN], [lease('LAN', '1-a')])).toEqual({ addresses: 10, leased: 1 })
  })

  it('keys carry the node only when the row has one', () => {
    expect(leaseKey(leases[0])).not.toBe(leaseKey(leases[2]))
    expect(leaseKey(lease('LAN', '1-a'))).toBe('LAN\n1-a')
    expect(scopeKey(LAN)).toBe('LAN')
    expect(scopeKey({ ...LAN, node: 'ns2' })).toBe('ns2\nLAN')
  })
})
