import { toTrail } from '../../app/route'
import { readParam } from '../../lib/url-state'

/*
DHCP'S VIEW IN THE ADDRESS BAR (deviation 19, 2026-11-06). Upstream never touches
the URL; here what is on screen is written to the search, the way Cache and the
zone list keep theirs (`lib/url-state.ts`):

  · Leases: the search (`?q=`), the scope (`?scope=`) and the type (`?type=`) the
    table is narrowed to, written by replacing the entry.
  · Scopes: the search (`?q=`) and the state (`?state=`) of the scope list, written
    by replacing the entry, and the open scope (`?scope=`), PUSHED as Zones pushes
    `?zone=`, so Back walks between the list and a scope. A query string and not
    `/dhcp/scopes/<name>/` for the reason `zones/zone-url.ts` gives: the server
    serves only real folders.

Each tab drops its own parameters when it goes. A tab reads them on arrival ONLY
when the bar is on its own folder: a tab is drawn before the screen it replaces has
dropped its parameters, so on a switch from Scopes (or from Cache, whose `?type=`
means a record type) the bar still holds the other screen's search, and reading it
would carry a filter that belongs to someone else.
*/

export const Q = 'q'
export const SCOPE = 'scope'
export const TYPE = 'type'
export const STATE = 'state'

/** The parameters each tab writes, and drops when it goes. */
export const LEASE_PARAMS = [Q, SCOPE, TYPE]
export const SCOPE_PARAMS = [Q, STATE, SCOPE]

/** Whether the bar is on this tab's folder (Leases is also the section's own). */
export function onDhcpTab(tab: 'Leases' | 'Scopes'): boolean {
  const here = window.location.pathname
  if (tab === 'Scopes') return here === toTrail({ section: 'dhcp', sub: 'Scopes' })
  return here === toTrail({ section: 'dhcp', sub: 'Leases' }) || here === toTrail({ section: 'dhcp', sub: null })
}

/** A parameter of this tab, or `null` when the bar is somewhere else. */
export function readTabParam(tab: 'Leases' | 'Scopes', name: string): string | null {
  return onDhcpTab(tab) ? readParam(name) : null
}

/**
 * Writes the open scope (`null` for the list). Pushed for what the user does, so
 * Back returns; replaced for a correction (a scope that could not be read). Does
 * nothing when the bar already says it.
 */
export function writeScope(name: string | null, replaceEntry = false): void {
  if (readParam(SCOPE) === name && onDhcpTab('Scopes')) return
  const params = new URLSearchParams(window.location.search)
  if (name == null) params.delete(SCOPE)
  else params.set(SCOPE, name)
  const out = params.toString()
  const blank = toTrail({ section: 'dhcp', sub: 'Scopes' }) + (out === '' ? '' : `?${out}`)
  if (replaceEntry) window.history.replaceState(null, '', blank)
  else window.history.pushState(null, '', blank)
}
