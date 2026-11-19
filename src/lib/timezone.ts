import { useSyncExternalStore } from 'react'

/*
Persistent display timezone preference for timestamp rendering across the console.
Supports the official IANA Time Zone Database (Unicode CLDR standard) encompassing all
global time zones, with featured quick-access zones and defaulting to IST (Asia/Kolkata, UTC+05:30).
*/

export type SupportedTimezone = string

export interface TimezoneOption {
  value: string
  label: string
  offset: string
  region?: string
}

export const TIMEZONE_KEY = 'display_timezone'
export const DEFAULT_TIMEZONE: string = 'local'

/** Featured standard industry timezones covering major operational hubs. */
export const FEATURED_TIMEZONES: readonly TimezoneOption[] = [
  { value: 'local', label: 'Browser Local Time (Default)', offset: 'System', region: 'Client' },
  { value: 'Asia/Kolkata', label: 'IST - India Standard Time', offset: 'UTC+05:30', region: 'Asia' },
  { value: 'UTC', label: 'UTC - Universal Coordinated Time', offset: 'UTC+00:00', region: 'Universal' },
  { value: 'America/New_York', label: 'US Eastern - New York', offset: 'UTC-05:00', region: 'Americas' },
  { value: 'America/Chicago', label: 'US Central - Chicago', offset: 'UTC-06:00', region: 'Americas' },
  { value: 'America/Denver', label: 'US Mountain - Denver', offset: 'UTC-07:00', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'US Pacific - Los Angeles', offset: 'UTC-08:00', region: 'Americas' },
  { value: 'Europe/London', label: 'GMT / BST - London', offset: 'UTC+00:00', region: 'Europe' },
  { value: 'Europe/Paris', label: 'CET / CEST - Paris / Berlin', offset: 'UTC+01:00', region: 'Europe' },
  { value: 'Asia/Dubai', label: 'GST - Dubai', offset: 'UTC+04:00', region: 'Middle East' },
  { value: 'Asia/Singapore', label: 'SGT - Singapore', offset: 'UTC+08:00', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'JST - Tokyo', offset: 'UTC+09:00', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'AEST / AEDT - Sydney', offset: 'UTC+10:00', region: 'Australia' },
]

export const TIMEZONE_OPTIONS = FEATURED_TIMEZONES

/** Validate whether a string is a valid IANA timezone identifier or 'local'. */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  if (tz === 'local' || tz === 'UTC') return true
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Compute live UTC offset string (e.g. UTC+05:30) for a given timezone. */
export function getTimezoneOffset(tz: string, now: Date = new Date()): string {
  if (tz === 'local') return 'System'
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    if (tzPart?.value) {
      return tzPart.value.replace(/^GMT/, 'UTC')
    }
  } catch {
    /* Fallback */
  }
  return 'UTC'
}

let cachedIanaTimezones: readonly TimezoneOption[] | null = null

/**
 * Return all canonical IANA timezones from the JavaScript engine (Intl / Unicode CLDR),
 * formatted with current UTC offsets.
 */
export function getIanaTimezones(): readonly TimezoneOption[] {
  if (cachedIanaTimezones) return cachedIanaTimezones

  let ids: string[] = []
  if (typeof Intl !== 'undefined' && typeof (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf === 'function') {
    try {
      ids = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone')
    } catch {
      ids = []
    }
  }

  // Ensure Asia/Kolkata and UTC are present in the list
  const set = new Set(ids)
  set.add('Asia/Kolkata')
  set.add('UTC')

  const now = new Date()
  const sorted = Array.from(set).sort()
  const list: TimezoneOption[] = sorted.map((id) => {
    const offset = getTimezoneOffset(id, now)
    const clean = id.replace(/_/g, ' ')
    const region = id.includes('/') ? id.split('/')[0] : 'Universal'
    return {
      value: id,
      label: `(${offset}) ${clean}`,
      offset,
      region,
    }
  })

  cachedIanaTimezones = list
  return list
}

/** Read stored timezone preference, defaulting to Asia/Kolkata (IST). */
export function readTimezone(): string {
  try {
    const stored = localStorage.getItem(TIMEZONE_KEY)
    if (stored != null && isValidTimezone(stored)) {
      return stored
    }
  } catch {
    /* Restricted environment / SSR / disabled localStorage */
  }
  return DEFAULT_TIMEZONE
}

/** Store timezone preference in localStorage. */
export function writeTimezone(tz: string): void {
  try {
    localStorage.setItem(TIMEZONE_KEY, tz)
  } catch {
    /* Ignore write error if storage is unavailable */
  }
}

let activeTimezone: string = readTimezone()
const listeners = new Set<() => void>()

/** Get current active timezone. */
export function getTimezone(): string {
  return activeTimezone
}

/** Change timezone and notify subscribers. */
export function setTimezone(tz: string): void {
  if (activeTimezone === tz || !isValidTimezone(tz)) return
  activeTimezone = tz
  writeTimezone(tz)
  for (const listener of listeners) {
    listener()
  }
}

/** Subscribe to timezone changes. */
export function subscribeTimezone(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/** React hook for reading and updating display timezone. */
export function useTimezone(): {
  timezone: string
  setTimezone: (tz: string) => void
} {
  const timezone = useSyncExternalStore(subscribeTimezone, getTimezone, () => DEFAULT_TIMEZONE)
  return { timezone, setTimezone }
}
