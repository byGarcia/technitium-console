import { toTrail } from '../../app/route'

/*
The open zone, in the address bar: `/zones/?zone=example.org`.

Upstream has no such thing. `showEditZone` hides one `div` and shows another and
never touches the URL (see the header of `app/route.ts`), so a reload, a bookmark
or the back button always lands on the zone list. This is an ADDITION of ours, the
same kind as the section routes: the zone view itself is unchanged, only the bar
now says which zone is on screen, so it can be reloaded, bookmarked, shared and
walked with back and forward.

**A query string and not a path.** The server has no SPA fallback: it serves only
real folders (CONVENTIONS.md, "Four constraints the server imposes"), and
`/zones/example.org/` has no folder on disk, so it would 404 on reload. `/zones/`
does exist, and whatever follows the `?` is never looked at by the server.

The trail comes from `toTrail`, so behind an `X-Forwarded-Prefix` the bar says
`/dns/zones/?zone=…` as every other route does. Other parameters in the search are
kept: only `zone` is ours.
*/

const PARAM = 'zone'

/** The zone the bar asks for, or `null` for the list. The root zone is `.`. */
export function readZoneParam(search = window.location.search): string | null {
  const zone = new URLSearchParams(search).get(PARAM)
  return zone == null || zone === '' ? null : zone
}

/** The search with `zone` set, or taken out for the list. */
function zoneSearch(search: string, zone: string | null): string {
  const params = new URLSearchParams(search)
  if (zone == null) params.delete(PARAM)
  else params.set(PARAM, zone)
  const out = params.toString()
  return out === '' ? '' : `?${out}`
}

/** Whether the bar is on the Zones folder, which is the only place `zone` means anything. */
export function onZonesTrail(): boolean {
  return window.location.pathname === toTrail({ section: 'zones', sub: null })
}

/**
 * Writes the zone on screen. Pushing for what the user does (opening a zone, the
 * breadcrumb back to the list), so the back button walks between them; replacing
 * for corrections that are not a navigation. Does nothing if the bar already
 * says it.
 */
export function writeZone(zone: string | null, replaceEntry = false): void {
  if (readZoneParam() === zone && onZonesTrail()) return
  const blank = toTrail({ section: 'zones', sub: null }) + zoneSearch(window.location.search, zone)
  if (replaceEntry) window.history.replaceState(null, '', blank)
  else window.history.pushState(null, '', blank)
}

/**
 * Takes `zone` out of whatever the bar says, replacing the entry. For leaving the
 * section: the Shell writes the next route with the search the bar holds, so
 * without this the zone would follow the user to `/dashboard/?zone=…`.
 */
export function dropZoneParam(): void {
  if (readZoneParam() == null) return
  window.history.replaceState(null, '', window.location.pathname + zoneSearch(window.location.search, null))
}
