import type { Section } from './sections'

/*
The console's route, in the real address bar.

Upstream has none: its tabs are Bootstrap 3's, which call `preventDefault()` and
never touch the URL, so reloading always returns to the Dashboard. This is
therefore an ADDITION of ours and not recovered parity. It is stated here because
the project's governing constraint is "design only, zero functionality" and whoever
reads the diff should know which of the two they are looking at.

**And it needs no server change.** `www/` is served with `UseDefaultFiles()`, which
resolves `/settings/logging/` to `/settings/logging/index.html` and redirects the
slash-less version with a 301. The build (see `vite.config.ts`) emits one folder
per route, so the URL genuinely exists: it can be copied, bookmarked and reloaded.

**The application root cannot be assumed.** The server honours
`X-Forwarded-Prefix` by mounting a `PathBase` (`DnsWebService.cs:1943-1945`), so the
console may be hanging off `/dns/` without knowing it. Each copy carries its own
route in `<meta name="route">`, and the root comes from subtracting it from the
`pathname`. That is the piece that makes all of this work behind a proxy.
*/

export { toSlug } from './slug'
import { toSlug } from './slug'
export { forgetRoot, appRoot } from './base'
import { appRoot } from './base'
import { LEGACY_ROUTES } from './static-routes'

export interface Route {
  section: string
  sub: string | null
}

/**
 * Where the console hangs from, ending in `/`.
 *
 * On the front page it is the `pathname` itself. At `/dns/settings/logging/` it is
 * `/dns/`, and that is known because the document declares its route to be
 * `settings/logging`.
 */
/** What the address bar says, resolved against the visible sections. */
export function readRoute(sections: Section[]): Route | null {
  const base = appRoot()
  const trail = window.location.pathname
  if (!trail.startsWith(base)) return null

  const [sectionId, slugSub] = trail.slice(base.length).split('/').filter(Boolean)
  if (sectionId == null) return null

  const section = sections.find((s) => s.id === sectionId)
  if (section == null) return null

  // A sub that does not exist does not invalidate the section: it falls to the first.
  const sub = slugSub == null ? null : (section.subs?.find((t) => toSlug(t) === slugSub) ?? null)
  return { section: section.id, sub }
}

export function toTrail({ section, sub }: Route): string {
  return appRoot() + (sub == null ? `${section}/` : `${section}/${toSlug(sub)}/`)
}

/**
 * Writes the route. `replaceEntry` for the boot normalisation (which is not a
 * navigation and must not leave a history entry) and pushing for what the user
 * does, so the back button walks the sections instead of taking them out of the
 * console.
 *
 * The `search` is kept and the `hash` is NOT: the hash is only used by the SSO
 * return (`session/boot.ts`), which has already read it and wants it gone from the
 * bar.
 */
export function writeRoute(route: Route, replaceEntry = false): void {
  const blank = toTrail(route) + window.location.search
  if (window.location.pathname + window.location.search === blank) return
  if (replaceEntry) window.history.replaceState(null, '', blank)
  else window.history.pushState(null, '', blank)
}

/*
`/allowed/` and `/blocked/` are Blocking's Rules tab now. The bar is rewritten to
`blocking/rules/?rule=…` BEFORE the route is read, with `replaceState` so the back
button does not walk into the old address. The root comes from `appRoot()`, which
the legacy folder's own `<meta name="route">` lets it compute behind a prefix.
*/
export function translateLegacyRoute(): boolean {
  const base = appRoot()
  const trail = window.location.pathname
  if (!trail.startsWith(base)) return false
  const parts = trail.slice(base.length).split('/').filter(Boolean)
  const legacy = parts.length === 1 ? LEGACY_ROUTES[parts[0]] : undefined
  if (legacy == null) return false
  const params = new URLSearchParams(window.location.search)
  params.set('rule', legacy.rule)
  window.history.replaceState(null, '', `${base}${legacy.section}/${toSlug(legacy.sub)}/?${params.toString()}`)
  return true
}

/**
 * A click the browser should handle itself: another button, or with a modifier
 * (open in a new tab, in a window, download), or one something else already took.
 * Intercepting them would turn a real link into a button in disguise. The sidebar,
 * the sub-tabs and `ui/RouteLink` all ask this same question.
 */
export function plainClick(e: {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented?: boolean
}): boolean {
  return e.defaultPrevented !== true && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/**
 * Goes to another section from inside a screen, without reloading the console.
 *
 * The route is pushed (it is something the user did, so the back button returns)
 * and then announced with the same `popstate` the back button fires. The Shell
 * already follows that event (it reads the bar and moves to what it says), so a
 * screen needs no handle on the Shell's state to send the user elsewhere.
 */
export function navigateTo(route: Route): void {
  writeRoute(route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
