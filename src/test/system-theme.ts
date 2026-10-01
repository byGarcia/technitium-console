import { act } from '@testing-library/react'

/*
`matchMedia` in the test environment, for the theme.

jsdom does not implement it, and the console copes with that (no system
preference: light). A test that needs the operating system to prefer dark, or to
CHANGE its mind while the page is open, installs this one, which keeps its
listeners and fires them the way a browser does.
*/
export function mockSystemTheme(dark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const query = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, l: (e: MediaQueryListEvent) => void) => listeners.add(l),
    removeEventListener: (_type: string, l: (e: MediaQueryListEvent) => void) => listeners.delete(l),
  }
  const matchMedia = (media: string) => ({ ...query, media, matches: query.matches })
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true, writable: true })
  return {
    listeners,
    /** The operating system switches to dark (`true`) or light (`false`). */
    change(next: boolean) {
      query.matches = next
      act(() => listeners.forEach((l) => l({ matches: next } as MediaQueryListEvent)))
    },
  }
}

/** Back to jsdom as it comes: no `matchMedia`, no theme on `<html>`. */
export function resetTheme() {
  delete (window as { matchMedia?: unknown }).matchMedia
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
  localStorage.clear()
}
