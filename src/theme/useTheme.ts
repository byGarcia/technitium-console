import { createContext, useContext } from 'react'
import type { OfferedTheme, ResolvedTheme, ThemeChoice } from './theme'

export interface ThemeState {
  /** What is stored, `null` when nothing upstream recognises is (see `theme.ts`). */
  choice: ThemeChoice | null
  /** What is drawn. */
  resolved: ResolvedTheme
  /** A pick from the `Change Theme` dialog: stored and applied at once. */
  setChoice: (choice: OfferedTheme) => void
}

/*
Outside a `ThemeProvider` —screens mounted on their own in tests— there is nothing
to follow and nothing to pick: the dark theme, the tokens' default, and a pick that
does nothing.
*/
export const ThemeContext = createContext<ThemeState>({
  choice: null,
  resolved: 'dark',
  setChoice: () => {},
})

export function useTheme(): ThemeState {
  return useContext(ThemeContext)
}
