/*
What a cache node holds (deviation 16), counted from a real `cache/list` answer:
`github.com` read from a v15.6.1 on 2026-11-06 through 1.1.1.1, with its run of
TXT records cut to three and each negative answer's text cut after its first
two clauses (its NSEC3 records read as keys to the secret scanner). It carries stale records (`0 (0s)`), two negative
answers and two DNSSEC states.
*/
import { describe, expect, it } from 'vitest'
import type { DnsRecord, ListNode } from '../../api/zonelists'
import real from './cache-node.real.json'
import { byDnssec, byServer, byType, dnssecColour, dnssecTone, isNegative, isStale, ttlLeft } from './cache-facts'

const node = real as unknown as ListNode
const records = node.records

function rec(p: Partial<DnsRecord>): DnsRecord {
  return { name: 'x.test', type: 'A', ttl: '60 (1m)', rData: {}, ...p }
}

describe('the records of a node', () => {
  it('counts the types in the order the server writes them', () => {
    expect(byType(records)).toEqual([['A', 1], ['NS', 8], ['SOA', 1], ['MX', 1], ['TXT', 3], ['AAAA', 1], ['DS', 1]])
  })

  it('a record past its TTL is the one the server writes as 0 (0s)', () => {
    expect(records.filter(isStale).map((r) => r.type)).toEqual(['A', 'MX', 'TXT', 'TXT', 'TXT', 'DS'])
    expect(isStale(rec({ ttl: '1 (1s)' }))).toBe(false)
    // Allowed and Blocked write the TTL as a number: never stale.
    expect(isStale(rec({ ttl: 0 }))).toBe(false)
  })

  it('a negative answer is the server special cache record that says NegativeCache', () => {
    expect(records.filter(isNegative).map((r) => r.type)).toEqual(['AAAA', 'DS'])
    expect(isNegative(rec({ rData: { dataType: 'DnsSpecialCacheRecordData', data: 'FailureCache: ServerFailure' } }))).toBe(false)
    expect(isNegative(rec({ rData: { ipAddress: '192.0.2.1' } }))).toBe(false)
  })

  it('counts the DNSSEC states and the servers that answered', () => {
    expect(byDnssec(records)).toEqual([['Insecure', 14], ['Unknown', 2]])
    expect(byServer(records)).toEqual([['1.1.1.1', 16]])
  })

  it('puts the server that gave most records first, and names a missing one with the placeholder', () => {
    const meta = (nameServer: string | null) => ({ nameServer, protocol: 'Udp', datagramSize: '', roundTripTime: '' })
    const list = [rec({ responseMetadata: meta('a') }), rec({ responseMetadata: meta('b') }), rec({ responseMetadata: meta('b') }), rec({ responseMetadata: meta(null) }), rec({})]
    expect(byServer(list)).toEqual([['b', 2], ['a', 1], ['—', 1]])
  })
})

describe('the time left', () => {
  it('names the first record to leave and the longest time left, leaving the stale ones out', () => {
    const left = ttlLeft(records)
    expect(left?.next.record.type).toBe('AAAA')
    expect(left?.next.human).toBe('2m5s')
    expect(left?.longest).toBe('21m24s')
  })

  it('has nothing to say when every record is stale, or when there are none', () => {
    expect(ttlLeft(records.filter(isStale))).toBeNull()
    expect(ttlLeft([])).toBeNull()
  })

  it('does not guess a TTL that does not read as a number', () => {
    expect(ttlLeft([rec({ ttl: 'soon' })])).toBeNull()
  })
})

describe('a DNSSEC state is drawn by what it says', () => {
  it.each([
    ['Secure', 'var(--ok)', 'ok'],
    ['Bogus', 'var(--dan)', 'dan'],
    ['Indeterminate', 'var(--warn)', 'warn'],
    ['Unknown', 'var(--ch-3)', 'neutral'],
    ['Insecure', 'var(--ch-drop)', 'neutral'],
  ])('%s', (state, colour, tone) => {
    expect(dnssecColour(state)).toBe(colour)
    expect(dnssecTone(state)).toBe(tone)
  })
})
