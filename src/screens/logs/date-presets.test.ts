import { describe, expect, it } from 'vitest'
import { computeDatePreset, formatDatetimeLocal, DATE_PRESETS } from './date-presets'

describe('date-presets', () => {
  const fixedNow = new Date('2026-11-19T14:30:00')

  it('contains expected standard industry presets', () => {
    expect(DATE_PRESETS.map((p) => p.id)).toEqual(['1h', '6h', '24h', 'today', 'yesterday', '7d', '30d'])
  })

  it('formats dates to YYYY-MM-DDTHH:mm format', () => {
    expect(formatDatetimeLocal(fixedNow)).toBe('2026-11-19T14:30')
  })

  it('computes 1h preset correctly', () => {
    const { start, end } = computeDatePreset('1h', fixedNow)
    expect(start).toBe('2026-11-19T13:30')
    expect(end).toBe('2026-11-19T14:30')
  })

  it('computes 6h preset correctly', () => {
    const { start, end } = computeDatePreset('6h', fixedNow)
    expect(start).toBe('2026-11-19T08:30')
    expect(end).toBe('2026-11-19T14:30')
  })

  it('computes 24h preset correctly', () => {
    const { start, end } = computeDatePreset('24h', fixedNow)
    expect(start).toBe('2026-11-18T14:30')
    expect(end).toBe('2026-11-19T14:30')
  })

  it('computes today preset correctly', () => {
    const { start, end } = computeDatePreset('today', fixedNow)
    expect(start).toBe('2026-11-19T00:00')
    expect(end).toBe('2026-11-19T14:30')
  })

  it('computes yesterday preset correctly', () => {
    const { start, end } = computeDatePreset('yesterday', fixedNow)
    expect(start).toBe('2026-11-18T00:00')
    expect(end).toBe('2026-11-18T23:59')
  })

  it('computes 7d preset correctly', () => {
    const { start, end } = computeDatePreset('7d', fixedNow)
    expect(start).toBe('2026-11-12T14:30')
    expect(end).toBe('2026-11-19T14:30')
  })

  it('computes 30d preset correctly', () => {
    const { start, end } = computeDatePreset('30d', fixedNow)
    expect(start).toBe('2026-10-20T14:30')
    expect(end).toBe('2026-11-19T14:30')
  })
})
