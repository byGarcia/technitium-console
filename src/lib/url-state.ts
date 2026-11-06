/*
A screen's view state in the address bar, the way Blocking keeps its filter
(`?rule=`, 2026-10-15): what is on screen (Cache's open node, the zone list's page
and filters) is written to the search so a reload or a copied link lands on it.

Written by REPLACING the entry: moving through a screen is not a navigation, so
the back button still walks between sections and zones, not between pages. Only
the named parameters are touched; the rest of the search is kept. A value that is
the screen's default (an empty field, page 1) is left out, so the bar of an
untouched screen stays clean. Whoever writes parameters drops them when the
screen goes, because the Shell writes the next route with the search the bar
holds.
*/

/** One parameter of the bar, or `null` when it is not there or is empty. */
export function readParam(name: string, search = window.location.search): string | null {
  const v = new URLSearchParams(search).get(name)
  return v == null || v === '' ? null : v
}

/** Sets (or, with `null` or `''`, removes) these parameters, replacing the entry. */
export function writeParams(values: Record<string, string | null>): void {
  const params = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(values)) {
    if (v == null || v === '') params.delete(k)
    else params.set(k, v)
  }
  const out = params.toString()
  const search = out === '' ? '' : `?${out}`
  if (search !== window.location.search) {
    window.history.replaceState(window.history.state, '', window.location.pathname + search)
  }
}

/** Takes these parameters out of the bar, replacing the entry. */
export function dropParams(names: string[]): void {
  writeParams(Object.fromEntries(names.map((n) => [n, null])))
}
