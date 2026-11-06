import { describe, expect, it } from 'vitest'
import type { QueryLogEntry } from '../../api/logs'
import { blockedCount, byClient, byDomain, byRcode, byResponseType, percent, rcodeColour, responseColour } from './query-facts'

function entry(partial: Partial<QueryLogEntry>): QueryLogEntry {
  return {
    rowNumber: 1,
    timestamp: '2026-11-06T07:00:00Z',
    clientIpAddress: '10.0.0.1',
    protocol: 'Udp',
    responseType: 'Recursive',
    rcode: 'NoError',
    qname: 'example.com',
    qtype: 'A',
    qclass: 'IN',
    answer: null,
    ...partial,
  }
}

const PAGE = [
  entry({ responseType: 'Cached' }),
  entry({ responseType: 'Recursive', clientIpAddress: '10.0.0.2' }),
  entry({ responseType: 'Blocked', rcode: 'NxDomain', qname: 'ads.example' }),
  entry({ responseType: 'UpstreamBlockedCached', qname: 'ads.example' }),
  entry({ responseType: 'Authoritative', rcode: 'Refused', qname: null }),
  entry({ responseType: 'Recursive', rcode: 'Weird', qname: '' }),
]

describe('Query Logs: what the page holds', () => {
  it('counts response types in the dropdown order, with its labels', () => {
    expect(byResponseType(PAGE).map((t) => [t.value, t.count, t.known])).toEqual([
      ['Authoritative', 1, true],
      ['Recursive', 2, true],
      ['Cached', 1, true],
      ['Blocked', 1, true],
      ['UpstreamBlockedCached', 1, true],
    ])
  })

  it('counts RCODEs by the labels the RCODE field shows, and marks one it has no option for', () => {
    const codes = byRcode(PAGE)
    expect(codes.map((c) => [c.label, c.count, c.known])).toEqual([
      ['No Error', 3, true],
      ['NX Domain', 1, true],
      ['Refused', 1, true],
      ['Weird', 1, false],
    ])
  })

  it('puts the busiest clients and names first, leaves out an entry with no question, keeps the root', () => {
    expect(byClient(PAGE).map((c) => [c.value, c.count])).toEqual([
      ['10.0.0.1', 5],
      ['10.0.0.2', 1],
    ])
    expect(byDomain(PAGE).map((d) => [d.value, d.count])).toEqual([
      ['ads.example', 2],
      ['example.com', 2],
      ['', 1],
    ])
  })

  it('a blocked answer is any of the three blocked response types, in any case', () => {
    expect(blockedCount([...PAGE, entry({ responseType: 'upstreamblocked' })])).toBe(3)
  })

  it('writes a share as a whole percentage, and never rounds a real share to 0', () => {
    expect(percent(0, 10)).toBe('0%')
    expect(percent(1, 0)).toBe('0%')
    expect(percent(1, 4)).toBe('25%')
    expect(percent(1, 500)).toBe('<1%')
  })

  it('paints by the Dashboard colour of the same name, and an unknown one neutral', () => {
    expect(responseColour('Cached')).toBe('var(--ch-cache)')
    expect(responseColour('UpstreamBlocked')).toBe('var(--ch-block)')
    expect(rcodeColour('NxDomain')).toBe('var(--ch-nx)')
    expect(rcodeColour('Weird')).toBe('var(--ch-drop)')
  })
})
