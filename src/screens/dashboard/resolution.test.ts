import { describe, expect, it } from 'vitest'
import type { QueryLogEntry } from '../../api/logs'
import { flowOf, place } from './resolution'

const e = (responseType: string, rcode: string): QueryLogEntry => ({
  rowNumber: 1, timestamp: '', clientIpAddress: '10.0.0.1', protocol: 'Udp', responseType, rcode, qname: 'a', qtype: 'A', qclass: 'IN', answer: null,
})

describe('How a query is resolved', () => {
  it('counts every query by how it was answered and by what, and the pairs between them', () => {
    const f = flowOf([e('Cached', 'NoError'), e('Cached', 'NxDomain'), e('Recursive', 'NoError'), e('Blocked', 'NxDomain'), e('UpstreamBlocked', 'NxDomain')])
    expect(f.total).toBe(5)
    expect(f.how.map((n) => [n.label, n.count])).toEqual([['Cached', 2], ['Recursive', 1], ['Blocked', 2]])
    expect(f.what.map((n) => [n.label, n.count])).toEqual([['No Error', 2], ['NX Domain', 3]])
    expect(f.links).toEqual([[1, 1], [1, 0], [0, 2]])
  })

  it('puts a kind or a code with no name of its own under Other, with no filter', () => {
    const f = flowOf([e('Dropped', 'Refused'), e('Cached', 'YXDomain')])
    const other = f.how.find((n) => n.label === 'Other')!
    expect(other.count).toBe(1)
    expect(other.value).toBeNull()
    expect(f.what.find((n) => n.label === 'Other')?.count).toBe(1)
    expect(f.what.find((n) => n.label === 'Refused')?.value).toBe('Refused')
  })

  it('takes no entries for an empty flow', () => {
    expect(flowOf(undefined)).toEqual({ total: 0, how: [], what: [], links: [] })
  })

  it('stacks the nodes down the column in proportion, gap apart', () => {
    const at = place([3, 1], 110, 10)
    expect(at).toEqual([{ y: 0, h: 75 }, { y: 85, h: 25 }])
  })
})
