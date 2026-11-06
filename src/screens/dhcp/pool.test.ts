import { describe, expect, it } from 'vitest'
import type { DhcpLease, DhcpScopeRow } from '../../api/dhcp'
import { expiringSoon, ipv4, leaseKey, leasesPerScope, matchesSearch, newest, poolTotals, rangeSize } from './pool'

const NOW = Date.parse('2026-11-06T07:00:00Z')

function lease(over: Partial<DhcpLease>): DhcpLease {
  return {
    scope: 'Office LAN',
    type: 'Dynamic',
    hardwareAddress: 'A4-83-E7-11-22-33',
    clientIdentifier: '1-A483E7112233',
    address: '10.77.0.111',
    hostName: 'macbook-ana.office.lan',
    leaseObtained: '2026-11-06T06:00:00Z',
    leaseExpires: '2026-11-07T06:00:00Z',
    ...over,
  }
}

const OFFICE: DhcpScopeRow = {
  name: 'Office LAN',
  enabled: true,
  startingAddress: '10.77.0.100',
  endingAddress: '10.77.0.199',
  subnetMask: '255.255.255.0',
  networkAddress: '10.77.0.0',
  broadcastAddress: '10.77.0.255',
}

describe('the address arithmetic', () => {
  it('reads an IPv4 address as a number and refuses anything else', () => {
    expect(ipv4('10.0.0.1')).toBe(167772161)
    expect(ipv4('255.255.255.255')).toBe(4294967295)
    expect(ipv4('10.0.0')).toBeNull()
    expect(ipv4('10.0.0.256')).toBeNull()
    expect(ipv4('fe80::1')).toBeNull()
    expect(ipv4('')).toBeNull()
  })

  it('a range holds both its ends, and a backwards or broken one holds nothing', () => {
    expect(rangeSize('10.77.0.100', '10.77.0.199')).toBe(100)
    expect(rangeSize('192.168.1.1', '192.168.1.1')).toBe(1)
    expect(rangeSize('10.0.0.255', '10.0.1.0')).toBe(2)
    expect(rangeSize('10.0.0.9', '10.0.0.1')).toBeNull()
    expect(rangeSize('10.0.0.1', 'x')).toBeNull()
  })
})

describe('the pool', () => {
  it('counts leases per scope by the name they carry', () => {
    const per = leasesPerScope([lease({}), lease({ clientIdentifier: 'b' }), lease({ scope: 'Guest' })])
    expect(per.get('Office LAN')).toBe(2)
    expect(per.get('Guest')).toBe(1)
  })

  it('adds the ranges and leases of the ENABLED scopes only', () => {
    const lab: DhcpScopeRow = { ...OFFICE, name: 'Lab', enabled: false, startingAddress: '172.20.10.20', endingAddress: '172.20.10.60' }
    const leases = [lease({}), lease({ clientIdentifier: 'b' }), lease({ scope: 'Lab' })]
    expect(poolTotals([OFFICE, lab], leases)).toEqual({ addresses: 100, leased: 2 })
  })

  it('a pool with no scopes is zero, not nothing', () => {
    expect(poolTotals([], [])).toEqual({ addresses: 0, leased: 0 })
  })
})

describe('the clock figures', () => {
  it('expiring soon is within the next hour, soonest first, past ones left out', () => {
    const a = lease({ address: 'a', leaseExpires: '2026-11-06T07:40:00Z' })
    const b = lease({ address: 'b', leaseExpires: '2026-11-06T07:10:00Z' })
    const late = lease({ address: 'late', leaseExpires: '2026-11-06T08:00:01Z' })
    const gone = lease({ address: 'gone', leaseExpires: '2026-11-06T06:59:00Z' })
    expect(expiringSoon([a, late, b, gone], NOW).map((l) => l.address)).toEqual(['b', 'a'])
  })

  it('the newest lease is the one obtained last, and none without leases', () => {
    const old = lease({ address: 'old', leaseObtained: '2026-11-05T07:00:00Z' })
    const fresh = lease({ address: 'fresh', leaseObtained: '2026-11-06T06:59:00Z' })
    expect(newest([old, fresh])?.address).toBe('fresh')
    expect(newest([])).toBeNull()
  })
})

describe('the search', () => {
  it('finds the address, the host name and the MAC, ignoring case', () => {
    const l = lease({})
    expect(matchesSearch(l, '10.77.0.11')).toBe(true)
    expect(matchesSearch(l, 'MACBOOK')).toBe(true)
    expect(matchesSearch(l, 'a4-83-e7')).toBe(true)
    expect(matchesSearch(l, 'printer')).toBe(false)
    expect(matchesSearch(l, '   ')).toBe(true)
  })

  it('a MAC typed with colons finds the dashes the server writes', () => {
    expect(matchesSearch(lease({}), 'A4:83:E7')).toBe(true)
  })

  it('a lease with no host name is still found by its address', () => {
    expect(matchesSearch(lease({ hostName: null }), '10.77')).toBe(true)
    expect(matchesSearch(lease({ hostName: null }), 'macbook')).toBe(false)
  })

  it('a lease is known by its scope and client identifier', () => {
    expect(leaseKey(lease({}))).toBe('Office LAN\n1-A483E7112233')
  })
})
