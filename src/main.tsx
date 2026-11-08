import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { anchorHeadLinks } from './app/anchor-links'
import { applyStoredTheme } from './theme/theme'

anchorHeadLinks()

/* The theme goes on before the first render, so not even the login is drawn in
   the wrong one (see `theme/theme.ts`). */
applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
