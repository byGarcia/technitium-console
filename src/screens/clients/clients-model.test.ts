import { describe, expect, it } from 'vitest'
import type { QueryLogEntry } from '../../api/logs'
import type { Keys } from '../../ui/Table'
import {
  clientDetail, clientRows, nextSort, readSort, sortClients, summarise, writeSort, type ClientRow,
} from './clients-model'

let row = 0
function entry(
  clientIpAddress: string,
  responseType = 'Recursive',
  qname: string | null = 'example.com',
  qtype: string | null = 'A',
  timestamp = '2026-11-06T10:00:00Z',
): QueryLogEntry {
  row++
  return {
    rowNumber: row, timestamp, clientIpAddress, protocol: 'Udp', responseType,
    rcode: 'NoError', qname, qtype, qclass: 'IN', answer: null,
  }
}

const TOP = [
  { name: '10.0.0.1', hits: 40, domain: 'phone.home.arpa' },
  { name: '10.0.0.2', hits: 30, domain: '' },
  { name: '10.0.0.3', hits: 5, rateLimited: true },
]

describe('clientRows', () => {
  it('keeps the period order and counts each client blocked queries in the sample, the three blocked classes together', () => {
    const sample = [
      entry('10.0.0.1', 'Blocked'), entry('10.0.0.1', 'UpstreamBlocked'), entry('10.0.0.1', 'Cached'),
      entry('10.0.0.2', 'Recursive'), entry('10.0.0.2', 'UpstreamBlockedCached'),
    ]
    expect(clientRows(TOP, sample)).toEqual([
      { ip: '10.0.0.1', name: 'phone.home.arpa', hits: 40, rateLimited: false, blocked: 2 },
      { ip: '10.0.0.2', name: null, hits: 30, rateLimited: false, blocked: 1 },
      /* Not in the sample at all: no figure, which is not zero. */
      { ip: '10.0.0.3', name: null, hits: 5, rateLimited: true, blocked: null },
    ])
  })

  it('a client in the sample with nothing blocked counts zero', () => {
    expect(clientRows(TOP.slice(0, 1), [entry('10.0.0.1', 'Cached')])[0].blocked).toBe(0)
  })

  it('without a sample no client has a blocked figure', () => {
    expect(clientRows(TOP, null).map((r) => r.blocked)).toEqual([null, null, null])
  })
})

describe('summarise', () => {
  it('counts the sample, its blocked queries and the client with the most, named from Top Clients', () => {
    const sample = [
      entry('10.0.0.2', 'Blocked'), entry('10.0.0.1', 'Blocked'), entry('10.0.0.1', 'UpstreamBlocked'),
      entry('10.0.0.1', 'Recursive'),
    ]
    expect(summarise(sample, TOP)).toEqual({
      total: 4,
      blocked: 3,
      mostBlocked: { ip: '10.0.0.1', name: 'phone.home.arpa', count: 2 },
    })
  })

  it('with nothing blocked there is no most blocked client', () => {
    expect(summarise([entry('10.0.0.1')]).mostBlocked).toBeNull()
    expect(summarise([])).toEqual({ total: 0, blocked: 0, mostBlocked: null })
  })
})

describe('clientDetail', () => {
  it('counts its domains, its blocked domains, its types and its response types, most first', () => {
    const entries = [
      entry('10.0.0.1', 'Blocked', 'ads.example', 'A', '2026-11-06T10:00:03Z'),
      entry('10.0.0.1', 'Recursive', 'example.com', 'AAAA', '2026-11-06T10:00:05Z'),
      entry('10.0.0.1', 'Cached', 'example.com', 'A', '2026-11-06T10:00:01Z'),
      entry('10.0.0.1', 'UpstreamBlocked', 'ads.example', 'HTTPS', '2026-11-06T10:00:02Z'),
      /* No question: not a domain and not a type. */
      entry('10.0.0.1', 'Dropped', null, null, '2026-11-06T10:00:00Z'),
    ]
    const d = clientDetail(entries)
    expect(d.total).toBe(5)
    expect(d.last).toBe('2026-11-06T10:00:05Z')
    expect(d.domains).toEqual([{ domain: 'ads.example', count: 2 }, { domain: 'example.com', count: 2 }])
    expect(d.blocked).toEqual([{ domain: 'ads.example', count: 2 }])
    expect(d.types).toEqual([{ type: 'A', count: 2 }, { type: 'AAAA', count: 1 }, { type: 'HTTPS', count: 1 }])
    expect(d.responses.map((r) => r.type)).toEqual(['Blocked', 'Recursive', 'Cached', 'UpstreamBlocked', 'Dropped'])
  })

  it('keeps only the first rows of each list, and says nothing of an empty read', () => {
    const entries = ['a', 'b', 'c'].map((n) => entry('10.0.0.1', 'Blocked', `${n}.example`))
    expect(clientDetail(entries, 2).blocked).toHaveLength(2)
    expect(clientDetail([])).toEqual({ total: 0, last: null, domains: [], blocked: [], types: [], responses: [] })
  })
})

const KEYS: Keys<ClientRow> = {
  client: (r) => r.ip,
  name: (r) => r.name,
  queries: (r) => r.hits,
  blocked: (r) => r.blocked,
}

const ROWS: ClientRow[] = [
  { ip: '10.0.0.10', name: 'b', hits: 100, rateLimited: false, blocked: 3 },
  { ip: '10.0.0.2', name: 'a', hits: 20, rateLimited: false, blocked: null },
  { ip: '10.0.0.9', name: null, hits: 9, rateLimited: false, blocked: 12 },
]

describe('the order of the table', () => {
  it('reads and writes the bar form: the name ascending, a dash before it descending', () => {
    expect(readSort('queries', KEYS)).toEqual({ field: 'queries', desc: false })
    expect(readSort('-blocked', KEYS)).toEqual({ field: 'blocked', desc: true })
    expect(readSort('nonsense', KEYS)).toBeNull()
    expect(readSort(null, KEYS)).toBeNull()
    expect(writeSort({ field: 'client', desc: true })).toBe('-client')
    expect(writeSort(null)).toBeNull()
  })

  it('figures as figures and addresses in natural order, empty first', () => {
    const ips = (s: Parameters<typeof sortClients>[1]) => sortClients(ROWS, s, KEYS).map((r) => r.ip)
    expect(ips({ field: 'queries', desc: false })).toEqual(['10.0.0.9', '10.0.0.2', '10.0.0.10'])
    expect(ips({ field: 'client', desc: false })).toEqual(['10.0.0.2', '10.0.0.9', '10.0.0.10'])
    expect(ips({ field: 'blocked', desc: true })).toEqual(['10.0.0.9', '10.0.0.10', '10.0.0.2'])
    expect(ips(null)).toEqual(['10.0.0.10', '10.0.0.2', '10.0.0.9'])
  })

  it('a click sorts ascending unless the column is already ascending as drawn', () => {
    expect(nextSort('queries', ROWS, KEYS)).toEqual({ field: 'queries', desc: false })
    const asc = sortClients(ROWS, { field: 'queries', desc: false }, KEYS)
    expect(nextSort('queries', asc, KEYS)).toEqual({ field: 'queries', desc: true })
  })
})
