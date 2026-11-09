import { describe, expect, it } from 'vitest'
import type { QueryLogEntry } from '../../api/logs'
import { countByClient, countByType } from './blocked-sample'

let row = 0
function entry(clientIpAddress: string, qtype: string | null, responseType = 'Blocked'): QueryLogEntry {
  row++
  return {
    rowNumber: row, timestamp: '2026-11-06T10:00:00Z', clientIpAddress, protocol: 'Udp', responseType,
    rcode: 'NxDomain', qname: qtype == null ? null : 'ads.example', qtype, qclass: qtype == null ? null : 'IN', answer: null,
  }
}

describe('countByClient', () => {
  it('counts each address, most blocked first, a tie in the order first met', () => {
    const entries = [
      entry('10.0.0.2', 'A'), entry('10.0.0.1', 'A'), entry('10.0.0.1', 'AAAA'),
      entry('10.0.0.3', 'A'), entry('10.0.0.1', 'HTTPS'), entry('10.0.0.3', 'A'),
    ]
    expect(countByClient(entries).map((c) => [c.ip, c.count])).toEqual([
      ['10.0.0.1', 3], ['10.0.0.3', 2], ['10.0.0.2', 1],
    ])
  })

  it('names an address with the domain the Top Clients give it, and only that', () => {
    const entries = [entry('10.0.0.1', 'A'), entry('10.0.0.2', 'A'), entry('10.0.0.3', 'A')]
    const names = [
      { name: '10.0.0.1', hits: 9, domain: 'phone.home.arpa' },
      { name: '10.0.0.2', hits: 4, domain: '' },
      { name: '10.0.0.9', hits: 2, domain: 'elsewhere.home.arpa' },
    ]
    expect(countByClient(entries, names).map((c) => c.name)).toEqual(['phone.home.arpa', null, null])
  })

  it('keeps the response type for the jump only when all its entries share one', () => {
    const entries = [
      entry('10.0.0.1', 'A', 'Blocked'), entry('10.0.0.1', 'A', 'Blocked'),
      entry('10.0.0.2', 'A', 'Blocked'), entry('10.0.0.2', 'A', 'UpstreamBlocked'),
    ]
    const [one, two] = countByClient(entries)
    expect(one.responseType).toBe('Blocked')
    expect(two.responseType).toBeNull()
  })

  it('leaves out an entry without an address, and an empty sample gives no rows', () => {
    expect(countByClient([entry('', 'A')])).toEqual([])
    expect(countByClient([])).toEqual([])
  })

  it('leaves out the server itself, so its own lookups do not fill the sample', () => {
    const entries = [
      entry('127.0.0.1', 'TXT'), entry('::1', 'TXT'), entry('::ffff:127.0.0.1', 'TXT'),
      entry('10.0.0.5', 'A'),
    ]
    expect(countByClient(entries).map((c) => c.ip)).toEqual(['10.0.0.5'])
  })
})

describe('countByType', () => {
  it('counts each query type, most frequent first, and an entry without a question is no type', () => {
    const entries = [
      entry('10.0.0.1', 'AAAA'), entry('10.0.0.1', 'A'), entry('10.0.0.2', 'A'),
      entry('10.0.0.2', null), entry('10.0.0.3', 'HTTPS'), entry('10.0.0.3', 'A'),
    ]
    expect(countByType(entries)).toEqual([
      { type: 'A', count: 3 }, { type: 'AAAA', count: 1 }, { type: 'HTTPS', count: 1 },
    ])
    expect(countByType([])).toEqual([])
  })
})
