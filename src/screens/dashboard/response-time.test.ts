import { describe, expect, it } from 'vitest'
import type { QueryLogEntry } from '../../api/logs'
import { BUCKETS, ms, percentile, responseTimes } from './response-time'

const e = (rtt?: number): QueryLogEntry => ({
  rowNumber: 1, timestamp: '', clientIpAddress: '10.0.0.1', protocol: 'Udp', responseType: rtt == null ? 'Cached' : 'Recursive',
  ...(rtt == null ? {} : { responseRtt: rtt }), rcode: 'NoError', qname: 'a.example', qtype: 'A', qclass: 'IN', answer: null,
})

describe('Response Time', () => {
  it('takes nearest-rank percentiles over the timed entries only', () => {
    expect(percentile([], 50)).toBeNull()
    expect(percentile([1, 2, 3, 4], 50)).toBe(2)
    expect(percentile([1, 2, 3, 4], 95)).toBe(4)
    const t = responseTimes([e(), e(3), e(12), e(), e(150)])
    expect(t.sampled).toBe(5)
    expect(t.timed).toBe(3)
    expect(t.p50).toBe(12)
    expect(t.p95).toBe(150)
    expect(t.slowShare).toBeCloseTo(1 / 3)
  })

  it('puts each time in the first bucket it is under, the edge in the next one', () => {
    const t = responseTimes([e(0.4), e(1), e(1.9), e(100), e(250)])
    const at = (label: string) => t.counts[BUCKETS.findIndex((b) => b.label === label)]
    expect(at('<1')).toBe(1)
    expect(at('1-2')).toBe(2)
    expect(at('100-200')).toBe(1)
    expect(at('>200')).toBe(1)
    expect(t.counts.reduce((a, b) => a + b, 0)).toBe(5)
  })

  it('has nothing to say with no timed entry, and ignores nonsense values', () => {
    const t = responseTimes([e(), { ...e(), responseRtt: Number.NaN }, { ...e(), responseRtt: -1 }])
    expect(t.timed).toBe(0)
    expect(t.p50).toBeNull()
    expect(t.slowShare).toBe(0)
  })

  it('writes milliseconds as a person reads them', () => {
    expect(ms(null)).toBe('—')
    expect(ms(3.25)).toBe('3.3 ms')
    expect(ms(123.4)).toBe('123 ms')
    expect(ms(1520)).toBe('1.5 s')
  })
})
