/*
The theme preference, without React: what is stored, what it resolves to, and how
it reaches the page. A replica of upstream's `initTheme` / `changeTheme`
(main.js:3208-3263 in v15.5.1).

The key is upstream's own, `theme`, and that is not a coincidence to tidy up: this
console replaces upstream's `www` on the SAME origin, so the value is shared. A
user who picked Light in the stock console gets Light here without doing anything,
and the other way round.

What upstream stores, and what each value draws here:

    light               → light
    dark                → dark
    amber               → dark   Amber is not offered (CONVENTIONS.md, deliberate
                                 deviations). The stored value is left alone, so
                                 going back to the stock console still finds Amber.
    system, or anything → the system's `prefers-color-scheme`, followed LIVE.
    else (missing,        `"null"` is in that list on purpose: upstream's
    "null", garbage)      `initTheme` passes what it read to `changeTheme`, which
                          writes it back, so a first load stores the STRING
                          "null" (`localStorage.setItem("theme", null)`).

That write on load is an accident of how upstream reuses `changeTheme`, not a
contract anybody reads, so it is NOT replicated: this console only writes when the
user picks.
*/

export type ThemeChoice = 'system' | 'light' | 'dark' | 'amber'
/** What the user can pick here: upstream's list without Amber. */
export type OfferedTheme = Exclude<ThemeChoice, 'amber'>
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'theme'
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

const KNOWN: readonly string[] = ['system', 'light', 'dark', 'amber']

/*
Storage and `matchMedia` can both be missing or throw: a browser in a privacy
mode refuses `localStorage`, and the test environment has no `matchMedia`. Neither
may stop the console from drawing, so each access is guarded and falls back to
"nothing stored" and "the system does not prefer dark".
*/

/** The stored choice, or `null` when nothing upstream recognises is stored. */
export function readChoice(): ThemeChoice | null {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
  return stored != null && KNOWN.includes(stored) ? (stored as ThemeChoice) : null
}

/** Exactly what upstream's `changeTheme` stores for the same pick. */
export function writeChoice(choice: OfferedTheme): void {
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch {
    /* Not persisted: the pick still applies to this page, as it would upstream. */
  }
}

export function systemQuery(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_DARK_QUERY) : null
  } catch {
    return null
  }
}

/*
Without `matchMedia` upstream applies no class at all, which leaves its page in
the light look its stylesheet starts from. "The system does not prefer dark" is
the same answer.
*/
export function systemPrefersDark(): boolean {
  return systemQuery()?.matches ?? false
}

export function resolveTheme(choice: ThemeChoice | null, prefersDark: boolean): ResolvedTheme {
  switch (choice) {
    case 'light':
      return 'light'
    case 'dark':
    case 'amber':
      return 'dark'
    default:
      return prefersDark ? 'dark' : 'light'
  }
}

/*
`data-theme` on `<html>` is the contract with the stylesheets: the tokens are
declared per theme under that attribute. `color-scheme` goes with it so the
browser's own parts —scrollbars, date pickers, form controls— follow the page.
*/
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

/*
Called from `main.tsx`, synchronously, before React renders anything, login
included: nothing the console draws ever appears in the wrong theme. Upstream
does it from document-ready (main.js:268), which is later.

The page can still show its empty background for a frame before the module runs.
An inline `<script>` in `index.html` would close that gap (the server's CSP does
allow `'unsafe-inline'`), at the price of a second copy of this resolution
outside the bundle; it is not done.
*/
export function applyStoredTheme(): ResolvedTheme {
  const resolved = resolveTheme(readChoice(), systemPrefersDark())
  applyTheme(resolved)
  return resolved
}
