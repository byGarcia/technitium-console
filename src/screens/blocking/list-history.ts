/*
What the Lists strip says about the past of the block lists (2026-11-06, CONVENTIONS.md,
deviation 32). Two things, neither of them a new question to the server. All of it is
OURS.

WHEN THE LISTS WERE LAST UPDATED. `settings/get` does not send it, but it sends what it
is made from. The server writes `blockListNextUpdatedOn` as its last successful update
plus the interval (`BlockListLastUpdatedOn.AddHours(BlockListUpdateIntervalHours)`,
WebServiceSettingsApi.cs:386), with the interval it sends beside it, and only while the
update timer runs (the key is left out otherwise). So `next - interval` is the server's
own last update, exactly, not an estimate: a download that ended well or found the
lists not modified (BlockListZoneManager.cs:674-704). Nothing is said when the schedule
is off (no key, or an interval of 0), and nothing when the server has no last update
(`default(DateTime)`, year 1, which it keeps after a change of lists until the next
download) or when the console has just asked for one (Update Now leaves the line at
"Updating Now" with the epoch, `BlockLists.tsx`).

THE COUNT OVER TIME. Each time the Lists tab or Blocking > Overview reads a `Block List
Domains` figure (`dashboard/stats/get`'s `blockListZones`, the read each already makes)
that differs from the last one kept, the reading `{ at, count }` is kept in this
browser's storage, per server (`dnsServerDomain`), at most 30 of them. It is a
per-viewer convenience: the storage can refuse (a private window, blocked site data),
and then there is simply no history. The readout says the readings are kept in this
browser, because another browser, or this one cleared, starts again.
*/

/** `blockListNextUpdatedOn` minus the interval: the server's last update, or null. */
export function lastUpdateOf(next: string | null | undefined, intervalHours: number | null | undefined): string | null {
  if (next == null || intervalHours == null || intervalHours <= 0) return null
  const at = Date.parse(next)
  if (Number.isNaN(at)) return null
  const last = at - intervalHours * 3_600_000
  /* `default(DateTime)` plus the interval, or the console's own epoch for "Updating
     Now": neither is an update that happened. */
  if (last <= 0) return null
  return new Date(last).toISOString()
}

export interface Reading {
  /** When this console read the figure, ISO. */
  at: string
  count: number
}

export const READINGS_KEPT = 30
const KEY = 'blocking-list-domains'

function keyOf(server: string): string {
  return `${KEY}:${server}`
}

export function readReadings(server: string): Reading[] {
  try {
    const raw = localStorage.getItem(keyOf(server))
    const list: unknown = raw == null ? [] : JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list
      .filter(
        (r): r is Reading =>
          r != null &&
          typeof r === 'object' &&
          typeof (r as Record<string, unknown>).at === 'string' &&
          Number.isFinite((r as Record<string, unknown>).count),
      )
      .slice(-READINGS_KEPT)
  } catch {
    return []
  }
}

/**
 * Keeps `count` when it differs from the last reading kept, the oldest dropped past
 * `READINGS_KEPT`, and returns the readings, oldest first. A storage that refuses
 * keeps nothing; what was read is still returned, for this screen.
 */
export function keepReading(server: string, count: number, at: string = new Date().toISOString()): Reading[] {
  const kept = readReadings(server)
  if (!Number.isFinite(count)) return kept
  if (kept.length > 0 && kept[kept.length - 1].count === count) return kept
  const next = [...kept, { at, count }].slice(-READINGS_KEPT)
  try {
    localStorage.setItem(keyOf(server), JSON.stringify(next))
  } catch {
    /* No storage: the reading lives for this screen only. */
  }
  return next
}

/** `+1,904`, `-12`, or null for the first reading, which has nothing to compare with. */
export function changeText(count: number, before: number | undefined): string | null {
  if (before == null) return null
  const d = count - before
  return d > 0 ? `+${d.toLocaleString()}` : d < 0 ? `-${Math.abs(d).toLocaleString()}` : '0'
}
