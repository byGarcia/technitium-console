import { describe, expect, it } from 'vitest'
import type { DhcpLease, DhcpScopeRow } from '../../api/dhcp'
import { expiringSoon, ipv4, leaseKey, leaseTime, leasesPerScope, matchesScope, matchesSearch, newest, percent, poolTotals, rangeSize, scopeUsage } from './pool'

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

describe('the scope search and the lease time', () => {
  const s = {
    name: 'Office',
    enabled: true,
    startingAddress: '172.31.10.100',
    endingAddress: '172.31.10.199',
    subnetMask: '255.255.255.0',
    networkAddress: '172.31.10.0',
    broadcastAddress: '172.31.10.255',
    interfaceAddress: '172.31.10.2',
  }

  it('finds a scope by name, by an address its range holds, or by part of its addresses', () => {
    expect(matchesScope(s, 'off')).toBe(true)
    expect(matchesScope(s, '172.31.10.150')).toBe(true)
    expect(matchesScope(s, '172.31.10.250')).toBe(false)
    expect(matchesScope(s, '172.31.10')).toBe(true)
    expect(matchesScope(s, '')).toBe(true)
  })

  it('writes a lease time as the console writes a TTL', () => {
    expect(leaseTime(1, 0, 0)).toBe('1d')
    expect(leaseTime(0, 4, 30)).toBe('4h 30m')
    expect(leaseTime(0, 0, 0)).toBe('0m')
  })
})

describe('a scope usage (deviation 30)', () => {
  it('sizes an IPv4 range with both ends, across octets, and refuses what is not one', () => {
    expect(rangeSize('10.77.0.100', '10.77.0.199')).toBe(100)
    expect(rangeSize('10.0.0.5', '10.0.0.5')).toBe(1)
    expect(rangeSize('10.0.0.250', '10.0.1.10')).toBe(17)
    expect(rangeSize('172.16.0.0', '172.31.255.255')).toBe(1048576)
    expect(rangeSize('10.0.0.9', '10.0.0.1')).toBeNull()
    expect(rangeSize('fe80::1', 'fe80::9')).toBeNull()
  })

  it('counts the leases that carry the scope name, Dynamic and Reserved apart and together', () => {
    const leases = [
      lease({ clientIdentifier: 'a' }),
      lease({ clientIdentifier: 'b' }),
      lease({ clientIdentifier: 'c', type: 'Reserved' }),
      lease({ clientIdentifier: 'd', scope: 'Guest' }),
    ]
    expect(scopeUsage(OFFICE, leases)).toEqual({ leased: 3, dynamic: 2, reserved: 1, size: 100, share: 0.03, high: false })
    expect(scopeUsage(OFFICE, [])).toEqual({ leased: 0, dynamic: 0, reserved: 0, size: 100, share: 0, high: false })
  })

  it('writes the share in whole percents, and a few leases in a wide range as <1%', () => {
    expect(percent(0)).toBe('0%')
    expect(percent(0.004)).toBe('<1%')
    expect(percent(0.03)).toBe('3%')
    expect(percent(0.805)).toBe('81%')
    expect(percent(1)).toBe('100%')
    expect(percent(1.2)).toBe('120%')
  })

  it('is high only above 80% as the column writes it', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => lease({ clientIdentifier: String(i) }))
    expect(scopeUsage(OFFICE, many(80))?.high).toBe(false)
    expect(scopeUsage(OFFICE, many(81))?.high).toBe(true)
    expect(scopeUsage(OFFICE, many(100))?.high).toBe(true)
    const wide = { ...OFFICE, startingAddress: '10.77.0.1', endingAddress: '10.77.3.232' } // 1,000 addresses
    expect(scopeUsage(wide, many(804))?.high).toBe(false) // 80.4% is written 80%
    expect(scopeUsage(wide, many(805))?.high).toBe(true) // 80.5% is written 81%
  })

  it('has none for a disabled scope or a range that is not IPv4', () => {
    expect(scopeUsage({ ...OFFICE, enabled: false }, [lease({})])).toBeNull()
    expect(scopeUsage({ ...OFFICE, startingAddress: 'x' }, [lease({})])).toBeNull()
  })
})
