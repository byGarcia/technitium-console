import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TIMEZONE, TIMEZONE_KEY, TIMEZONE_OPTIONS, getTimezone, readTimezone, setTimezone, subscribeTimezone } from './timezone'

describe('timezone library', () => {
  beforeEach(() => {
    localStorage.clear()
    setTimezone(DEFAULT_TIMEZONE)
  })

  it('defaults to local (Browser Local Time)', () => {
    expect(DEFAULT_TIMEZONE).toBe('local')
    expect(readTimezone()).toBe('local')
    expect(getTimezone()).toBe('local')
  })

  it('reads stored valid timezone from localStorage', () => {
    localStorage.setItem(TIMEZONE_KEY, 'UTC')
    expect(readTimezone()).toBe('UTC')

    localStorage.setItem(TIMEZONE_KEY, 'Asia/Kolkata')
    expect(readTimezone()).toBe('Asia/Kolkata')

    localStorage.setItem(TIMEZONE_KEY, 'America/New_York')
    expect(readTimezone()).toBe('America/New_York')

    localStorage.setItem(TIMEZONE_KEY, 'local')
    expect(readTimezone()).toBe('local')
  })

  it('falls back to default if stored value is invalid or corrupted', () => {
    localStorage.setItem(TIMEZONE_KEY, 'Invalid/Unknown_Zone')
    expect(readTimezone()).toBe('local')

    localStorage.setItem(TIMEZONE_KEY, '')
    expect(readTimezone()).toBe('local')
  })

  it('writes timezone and notifies listeners on setTimezone', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTimezone(listener)

    setTimezone('Europe/London')
    expect(getTimezone()).toBe('Europe/London')
    expect(localStorage.getItem(TIMEZONE_KEY)).toBe('Europe/London')
    expect(listener).toHaveBeenCalledTimes(1)

    // Unsubscribe stops notifications
    unsubscribe()
    setTimezone('Asia/Tokyo')
    expect(getTimezone()).toBe('Asia/Tokyo')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('all supported timezones in TIMEZONE_OPTIONS are valid IANA timezones in Intl', () => {
    for (const opt of TIMEZONE_OPTIONS) {
      if (opt.value === 'local') continue
      expect(() => {
        new Intl.DateTimeFormat('en-CA', { timeZone: opt.value })
      }).not.toThrow()
    }
  })
})
