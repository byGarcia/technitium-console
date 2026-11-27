import { describe, expect, it } from 'vitest'
import { toIso } from '../logs/dates'
import { bucketWindow, localInput, periodFilters, protocolFilter, responseTypeFilter, spanFilters } from './jump'

describe('the window a chart point opens in Query Logs', () => {
  it('writes the browser zone, which is how Query Logs reads From and To back', () => {
    const at = Date.UTC(2026, 9, 15, 19, 4, 0)
    expect(toIso(localInput(at))).toBe(new Date(at).toISOString())
  })

  it('a day labelled by its start opens the whole UTC day', () => {
    const day = Date.UTC(2026, 9, 14)
    const chart = { labelFormat: 'MM/DD', labels: ['x'], instants: [new Date(day).toISOString()], datasets: [] }
    const f = bucketWindow(chart, 0)!
    expect(toIso(f.start!)).toBe(new Date(day).toISOString())
    expect(toIso(f.end!)).toBe(new Date(day + 86_400_000 - 1000).toISOString())
  })

  it('a chart without instants opens nothing', () => {
    expect(bucketWindow({ labels: ['10:00'], datasets: [] }, 0)).toBeNull()
  })

  it('a slice carries the period it counts', () => {
    expect(periodFilters({ unit: 'hour', from: 0, to: 3_600_000, count: 1 })).toEqual(spanFilters(0, 3_600_000))
    expect(periodFilters(null)).toEqual({})
  })
})

describe('which values have a field in Query Logs', () => {
  it('response types: the four Query Logs lists, not Dropped', () => {
    for (const t of ['Authoritative', 'Recursive', 'Cached', 'Blocked']) expect(responseTypeFilter(t)).toBe(t)
    expect(responseTypeFilter('Dropped')).toBeNull()
  })

  it('protocols: the server names, as the Protocol field sends them', () => {
    expect(protocolFilter('Udp')).toBe('Udp')
    expect(protocolFilter('Tcp')).toBe('Tcp')
    expect(protocolFilter('UDP')).toBeNull()
  })
})
