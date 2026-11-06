import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changeText, keepReading, lastUpdateOf, readReadings, READINGS_KEPT } from './list-history'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('lastUpdateOf', () => {
  it('is the next update minus the interval, as the server adds them', () => {
    expect(lastUpdateOf('2026-11-07T07:11:00.000Z', 24)).toBe('2026-11-06T07:11:00.000Z')
    expect(lastUpdateOf('2026-11-06T10:00:00Z', 6)).toBe('2026-11-06T04:00:00.000Z')
  })

  it('says nothing when the schedule is off: no next update, or an interval of 0', () => {
    expect(lastUpdateOf(null, 24)).toBeNull()
    expect(lastUpdateOf(undefined, 24)).toBeNull()
    expect(lastUpdateOf('2026-11-07T07:11:00Z', 0)).toBeNull()
    expect(lastUpdateOf('2026-11-07T07:11:00Z', null)).toBeNull()
  })

  it('says nothing for an update that never happened: default(DateTime), or the epoch Update Now leaves', () => {
    expect(lastUpdateOf('0001-01-02T00:00:00Z', 24)).toBeNull()
    expect(lastUpdateOf(new Date(0).toISOString(), 24)).toBeNull()
    expect(lastUpdateOf('not a date', 24)).toBeNull()
  })
})

describe('the readings of Block List Domains', () => {
  it('keeps a reading only when the count differs from the last one kept', () => {
    keepReading('dns1', 100, '2026-11-01T00:00:00Z')
    keepReading('dns1', 100, '2026-11-02T00:00:00Z')
    keepReading('dns1', 120, '2026-11-03T00:00:00Z')
    keepReading('dns1', 100, '2026-11-04T00:00:00Z')
    expect(readReadings('dns1')).toEqual([
      { at: '2026-11-01T00:00:00Z', count: 100 },
      { at: '2026-11-03T00:00:00Z', count: 120 },
      { at: '2026-11-04T00:00:00Z', count: 100 },
    ])
  })

  it(`keeps at most ${READINGS_KEPT}, dropping the oldest`, () => {
    for (let i = 0; i < READINGS_KEPT + 5; i++) keepReading('dns1', i, `2026-11-01T00:00:${String(i).padStart(2, '0')}Z`)
    const kept = readReadings('dns1')
    expect(kept).toHaveLength(READINGS_KEPT)
    expect(kept[0].count).toBe(5)
    expect(kept[kept.length - 1].count).toBe(READINGS_KEPT + 4)
  })

  it('keeps each server apart', () => {
    keepReading('dns1', 1)
    keepReading('dns2', 2)
    expect(readReadings('dns1').map((r) => r.count)).toEqual([1])
    expect(readReadings('dns2').map((r) => r.count)).toEqual([2])
  })

  it('a storage that refuses keeps nothing and breaks nothing: the reading is still returned', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(keepReading('dns1', 7, '2026-11-01T00:00:00Z')).toEqual([{ at: '2026-11-01T00:00:00Z', count: 7 }])
    vi.restoreAllMocks()
    expect(readReadings('dns1')).toEqual([])
  })

  it('a storage that cannot be read gives no history', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(readReadings('dns1')).toEqual([])
  })

  it('what is stored and is not readings is ignored', () => {
    localStorage.setItem('blocking-list-domains:dns1', '{"no":1}')
    expect(readReadings('dns1')).toEqual([])
    localStorage.setItem('blocking-list-domains:dns1', '[{"at":"x","count":"3"},{"at":"2026-11-01T00:00:00Z","count":3},null]')
    expect(readReadings('dns1')).toEqual([{ at: '2026-11-01T00:00:00Z', count: 3 }])
    localStorage.setItem('blocking-list-domains:dns1', 'not json')
    expect(readReadings('dns1')).toEqual([])
  })

  it('a change reads as +N or -N, with nothing for the first reading', () => {
    expect(changeText(1_203_411, 1_201_507)).toBe(`+${(1904).toLocaleString()}`)
    expect(changeText(10, 22)).toBe('-12')
    expect(changeText(5, 5)).toBe('0')
    expect(changeText(5, undefined)).toBeNull()
  })
})
