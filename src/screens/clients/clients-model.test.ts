import { describe, expect, it } from 'vitest'
import type { QueryLogEntry } from '../../api/logs'
import type { DhcpLease } from '../../api/dhcp'
import {
  HEAVY_MIN, activity, blockedShare, busiest, clientCard, clientRows, filterCounts, isHeavy, isQuiet, latest,
  leaseFor, matchesFilter, matchesSearch, median, readFilter, readSortBy, sortRows, summarise, type ClientRow,
} from './clients-model'

let row = 0
function entry(
  clientIpAddress: string,
  responseType = 'Recursive',
  qname: string | null = 'example.com',
  qtype: string | null = 'A',
  timestamp = '2026-11-06T10:00:00Z',
  extra: Partial<QueryLogEntry> = {},
): QueryLogEntry {
  row++
  return {
    rowNumber: row, timestamp, clientIpAddress, protocol: 'Udp', responseType,
    rcode: 'NoError', qname, qtype, qclass: 'IN', answer: null, ...extra,
  }
}

const TOP = [
  { name: '10.0.0.1', hits: 40, domain: 'phone.home.arpa' },
  { name: '10.0.0.2', hits: 30, domain: '' },
  { name: '10.0.0.3', hits: 5, rateLimited: true },
]

function client(over: Partial<ClientRow>): ClientRow {
  return { ip: '10.0.0.9', name: null, hits: 1, rateLimited: false, sampled: null, blocked: null, ...over }
}

describe('clientRows', () => {
  it('keeps the period order and counts each client in the sample, the three blocked classes together', () => {
    const sample = [
      entry('10.0.0.1', 'Blocked'), entry('10.0.0.1', 'UpstreamBlocked'), entry('10.0.0.1', 'Cached'),
      entry('10.0.0.2', 'Recursive'), entry('10.0.0.2', 'UpstreamBlockedCached'),
    ]
    expect(clientRows(TOP, sample)).toEqual([
      { ip: '10.0.0.1', name: 'phone.home.arpa', hits: 40, rateLimited: false, sampled: 3, blocked: 2 },
      { ip: '10.0.0.2', name: null, hits: 30, rateLimited: false, sampled: 2, blocked: 1 },
      /* Not in the sample at all: no blocked figure, which is not zero. */
      { ip: '10.0.0.3', name: null, hits: 5, rateLimited: true, sampled: 0, blocked: null },
    ])
  })

  it('without a sample no client has a sample figure', () => {
    expect(clientRows(TOP, null).map((r) => [r.sampled, r.blocked])).toEqual([[null, null], [null, null], [null, null]])
  })
})

describe('the tags and the filters', () => {
  it('Heavy blocking: a fifth or more blocked, over at least ten of its queries', () => {
    expect(isHeavy(client({ sampled: HEAVY_MIN, blocked: 2 }))).toBe(true)
    expect(isHeavy(client({ sampled: HEAVY_MIN, blocked: 1 }))).toBe(false)
    /* Two of three is a share, not yet a tag. */
    expect(isHeavy(client({ sampled: 3, blocked: 2 }))).toBe(false)
    expect(isHeavy(client({ sampled: null, blocked: null }))).toBe(false)
    expect(blockedShare(client({ sampled: 4, blocked: 1 }))).toBe(0.25)
    expect(blockedShare(client({ sampled: 0, blocked: null }))).toBeNull()
  })

  it('Quiet: under 1% of the period, never with an empty period', () => {
    expect(isQuiet(client({ hits: 9 }), 1000)).toBe(true)
    expect(isQuiet(client({ hits: 10 }), 1000)).toBe(false)
    expect(isQuiet(client({ hits: 0 }), 0)).toBe(false)
  })

  it('counts each filter and keeps what it names', () => {
    const rows = [
      client({ ip: 'a', hits: 900, sampled: 20, blocked: 10 }),
      client({ ip: 'b', hits: 95, sampled: 20, blocked: 0 }),
      client({ ip: 'c', hits: 5, sampled: 0, blocked: null }),
    ]
    expect(filterCounts(rows, 1000)).toEqual({ all: 3, heavy: 1, quiet: 1 })
    expect(rows.filter((r) => matchesFilter(r, 'quiet', 1000)).map((r) => r.ip)).toEqual(['c'])
    expect(rows.filter((r) => matchesFilter(r, 'heavy', 1000)).map((r) => r.ip)).toEqual(['a'])
  })

  it('the bar forms fall back to the defaults', () => {
    expect(readFilter('heavy')).toBe('heavy')
    expect(readFilter('nonsense')).toBe('all')
    expect(readFilter(null)).toBe('all')
    expect(readSortBy('name')).toBe('name')
    expect(readSortBy('oops')).toBe('queries')
  })

  it('the search reads the address and the name', () => {
    const r = client({ ip: '10.0.0.7', name: 'TV.home.arpa' })
    expect(matchesSearch(r, 'tv')).toBe(true)
    expect(matchesSearch(r, '0.7')).toBe(true)
    expect(matchesSearch(r, 'phone')).toBe(false)
    expect(matchesSearch(r, '  ')).toBe(true)
  })
})

describe('sortRows', () => {
  const rows = [
    client({ ip: '10.0.0.10', name: 'b', hits: 100, blocked: 3 }),
    client({ ip: '10.0.0.2', name: null, hits: 20, blocked: null }),
    client({ ip: '10.0.0.9', name: 'a', hits: 9, blocked: 12 }),
  ]
  const ips = (by: Parameters<typeof sortRows>[1]) => sortRows(rows, by).map((r) => r.ip)
  it('most queries, most blocked (outside the sample last), and the name shown in natural order', () => {
    expect(ips('queries')).toEqual(['10.0.0.10', '10.0.0.2', '10.0.0.9'])
    expect(ips('blocked')).toEqual(['10.0.0.9', '10.0.0.10', '10.0.0.2'])
    /* `10.0.0.2` is shown by its address, which sorts before the letters. */
    expect(ips('name')).toEqual(['10.0.0.2', '10.0.0.9', '10.0.0.10'])
  })
})

describe('summarise and busiest', () => {
  it('counts the sample, its blocked queries and the client with the most, named from Top Clients', () => {
    const sample = [entry('10.0.0.2', 'Blocked'), entry('10.0.0.1', 'Blocked'), entry('10.0.0.1', 'UpstreamBlocked'), entry('10.0.0.1')]
    expect(summarise(sample, TOP)).toEqual({ total: 4, blocked: 3, mostBlocked: { ip: '10.0.0.1', name: 'phone.home.arpa', count: 2 } })
    expect(summarise([])).toEqual({ total: 0, blocked: 0, mostBlocked: null })
  })

  it('the busiest clients with their shares and what they cover', () => {
    const rows = clientRows(TOP, null)
    const b = busiest(rows, 100, 2)
    expect(b.rows.map((r) => [r.row.ip, r.share])).toEqual([['10.0.0.1', 0.4], ['10.0.0.2', 0.3]])
    expect(b.covered).toBeCloseTo(0.7)
    expect(busiest(rows, 0).covered).toBe(0)
  })
})

describe('leaseFor', () => {
  const lease: DhcpLease = {
    scope: 'Home', type: 'Dynamic', hardwareAddress: 'AA-BB-CC-DD-EE-FF', clientIdentifier: '1-aabbccddeeff',
    address: '10.0.0.2', hostName: 'tv', leaseObtained: '', leaseExpires: '',
  }
  it('matches by address, and nothing otherwise', () => {
    expect(leaseFor([lease], '10.0.0.2')).toBe(lease)
    expect(leaseFor([lease], '10.0.0.20')).toBeNull()
    expect(leaseFor(null, '10.0.0.2')).toBeNull()
  })
})

describe('clientCard', () => {
  it('counts the queries, the blocked and cached shares, the median time and the lists', () => {
    const entries = [
      entry('10.0.0.1', 'Blocked', 'ads.example', 'A', '2026-11-06T10:00:03Z'),
      entry('10.0.0.1', 'Recursive', 'example.com', 'AAAA', '2026-11-06T10:00:05Z', { responseRtt: 30, protocol: 'Tcp' }),
      entry('10.0.0.1', 'Cached', 'example.com', 'A', '2026-11-06T10:00:01Z'),
      entry('10.0.0.1', 'UpstreamBlocked', 'ads.example', 'HTTPS', '2026-11-06T10:00:02Z', { responseRtt: 10 }),
      /* No question: not a domain and not a type. */
      entry('10.0.0.1', 'Dropped', null, null, '2026-11-06T10:00:00Z'),
    ]
    const c = clientCard(entries)
    expect(c.total).toBe(5)
    expect(c.last).toBe('2026-11-06T10:00:05Z')
    expect(c.blocked).toBe(2)
    expect(c.cached).toBe(1)
    /* The two entries that carry a time: their mean is the median of two. */
    expect(c.medianRtt).toBe(20)
    expect(c.domains).toEqual([{ domain: 'ads.example', count: 2 }, { domain: 'example.com', count: 2 }])
    expect(c.blockedDomains).toEqual([{ domain: 'ads.example', count: 2 }])
    expect(c.types).toEqual([{ type: 'A', count: 2 }, { type: 'AAAA', count: 1 }, { type: 'HTTPS', count: 1 }])
    expect(c.protocols).toEqual([{ type: 'Udp', count: 4 }, { type: 'Tcp', count: 1 }])
  })

  it('no timed entry gives no median, and an empty read nothing at all', () => {
    expect(clientCard([entry('10.0.0.1')]).medianRtt).toBeNull()
    expect(clientCard([]).last).toBeNull()
    expect(median([5, 1, 3])).toBe(3)
    expect(median([])).toBeNull()
  })
})

describe('activity and latest', () => {
  it('cuts the sample in equal slices from its oldest query to its newest, whole and blocked', () => {
    const entries = [
      entry('x', 'Blocked', 'a', 'A', '2026-11-06T10:00:00Z'),
      entry('x', 'Cached', 'a', 'A', '2026-11-06T10:00:01Z'),
      entry('x', 'Cached', 'a', 'A', '2026-11-06T10:00:04Z'),
    ]
    const a = activity(entries, 4)!
    expect(a.total).toEqual([1, 1, 0, 1])
    expect(a.blocked).toEqual([1, 0, 0, 0])
    expect(a.starts[0]).toBe(Date.parse('2026-11-06T10:00:00Z'))
    /* One instant is one slice. */
    expect(activity([entries[0]], 4)!.total).toEqual([1])
    expect(activity([])).toBeNull()
  })

  it('the newest first, as many as asked', () => {
    const entries = [
      entry('x', 'Cached', 'old', 'A', '2026-11-06T10:00:00Z'),
      entry('x', 'Cached', 'new', 'A', '2026-11-06T10:00:09Z'),
      entry('x', 'Cached', 'mid', 'A', '2026-11-06T10:00:05Z'),
    ]
    expect(latest(entries, 2).map((e) => e.qname)).toEqual(['new', 'mid'])
  })
})
