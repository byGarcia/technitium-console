import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import './tokens.css'
import './base.css'
import {
  applyTheme,
  readChoice,
  resolveTheme,
  systemPrefersDark,
  systemQuery,
  writeChoice,
  type OfferedTheme,
  type ThemeChoice,
} from './theme'
import { ThemeContext } from './useTheme'

/*
The theme, as upstream handles it (main.js:3208-3263): read from `localStorage`
under the shared key `theme`, picked from the `Change Theme` dialog, and
"Use System Theme (default)" following the operating system LIVE. The rules of
what each stored value draws are in `theme.ts`; this only keeps them current.

The first application is not here but in `main.tsx`, before React mounts; this
provider takes over from there.

The system's changes are listened to always, as upstream's `initTheme` does, and
ignored while an explicit theme is chosen: `resolveTheme` does not look at the
system for Light, Dark or a stored Amber.

What is NOT replicated: upstream re-reads `localStorage` inside that listener, so
a pick made in ANOTHER tab decides whether this one follows the system. Here the
choice is the one this page read or made.
*/
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice | null>(readChoice)
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark)

  useEffect(() => {
    const query = systemQuery()
    if (query == null) return
    const follow = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [])

  const resolved = resolveTheme(choice, prefersDark)

  /* A layout effect, so the attribute changes before any child's passive effect
     runs: the charts re-read their palette in one, and the tokens they read have
     to be the new theme's already. */
  useLayoutEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setChoice = useCallback((next: OfferedTheme) => {
    writeChoice(next)
    setChoiceState(next)
  }, [])

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
