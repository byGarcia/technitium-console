import { useSyncExternalStore } from 'react'

/*
Persistent display timezone preference for timestamp rendering across the console.
Supports standard industry timezones covering Asia/India, Americas, Europe, Middle East,
Asia-Pacific, UTC, and Browser Local time, defaulting to IST (Asia/Kolkata, UTC+05:30).
*/

export type SupportedTimezone =
  | 'Asia/Kolkata' // Indian Standard Time (default)
  | 'UTC' // Coordinated Universal Time
  | 'America/New_York' // US Eastern Time
  | 'America/Chicago' // US Central Time
  | 'America/Denver' // US Mountain Time
  | 'America/Los_Angeles' // US Pacific Time
  | 'Europe/London' // London / GMT
  | 'Europe/Paris' // Central European Time
  | 'Asia/Dubai' // Gulf Standard Time
  | 'Asia/Singapore' // Singapore Standard Time
  | 'Asia/Tokyo' // Japan Standard Time
  | 'Australia/Sydney' // Australian Eastern Time
  | 'local' // Browser Local Time

export interface TimezoneOption {
  value: SupportedTimezone
  label: string
  offset: string
  region: string
}

export const TIMEZONE_KEY = 'display_timezone'
export const DEFAULT_TIMEZONE: SupportedTimezone = 'Asia/Kolkata'

export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: 'Asia/Kolkata', label: 'IST — India Standard Time', offset: 'UTC+05:30', region: 'Asia' },
  { value: 'UTC', label: 'UTC — Universal Coordinated Time', offset: 'UTC+00:00', region: 'Universal' },
  { value: 'America/New_York', label: 'US Eastern — New York', offset: 'UTC-05:00', region: 'Americas' },
  { value: 'America/Chicago', label: 'US Central — Chicago', offset: 'UTC-06:00', region: 'Americas' },
  { value: 'America/Denver', label: 'US Mountain — Denver', offset: 'UTC-07:00', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'US Pacific — Los Angeles', offset: 'UTC-08:00', region: 'Americas' },
  { value: 'Europe/London', label: 'GMT / BST — London', offset: 'UTC+00:00', region: 'Europe' },
  { value: 'Europe/Paris', label: 'CET / CEST — Paris / Berlin', offset: 'UTC+01:00', region: 'Europe' },
  { value: 'Asia/Dubai', label: 'GST — Dubai', offset: 'UTC+04:00', region: 'Middle East' },
  { value: 'Asia/Singapore', label: 'SGT — Singapore', offset: 'UTC+08:00', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'JST — Tokyo', offset: 'UTC+09:00', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'AEST / AEDT — Sydney', offset: 'UTC+10:00', region: 'Australia' },
  { value: 'local', label: 'Browser Local Time', offset: 'System', region: 'Client' },
]

const KNOWN_TIMEZONES = new Set<string>(TIMEZONE_OPTIONS.map((o) => o.value))

/** Read stored timezone preference, defaulting to Asia/Kolkata (IST). */
export function readTimezone(): SupportedTimezone {
  try {
    const stored = localStorage.getItem(TIMEZONE_KEY)
    if (stored != null && KNOWN_TIMEZONES.has(stored)) {
      return stored as SupportedTimezone
    }
  } catch {
    /* Restricted environment / SSR / disabled localStorage */
  }
  return DEFAULT_TIMEZONE
}

/** Store timezone preference in localStorage. */
export function writeTimezone(tz: SupportedTimezone): void {
  try {
    localStorage.setItem(TIMEZONE_KEY, tz)
  } catch {
    /* Ignore write error if storage is unavailable */
  }
}

let activeTimezone: SupportedTimezone = readTimezone()
const listeners = new Set<() => void>()

/** Get current active timezone. */
export function getTimezone(): SupportedTimezone {
  return activeTimezone
}

/** Change timezone and notify subscribers. */
export function setTimezone(tz: SupportedTimezone): void {
  if (activeTimezone === tz) return
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
  timezone: SupportedTimezone
  setTimezone: (tz: SupportedTimezone) => void
} {
  const timezone = useSyncExternalStore(subscribeTimezone, getTimezone, () => DEFAULT_TIMEZONE)
  return { timezone, setTimezone }
}
