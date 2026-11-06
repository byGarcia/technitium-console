import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { publicUrl } from './app/base'
import { applyStoredTheme } from './theme/theme'

/*
The icons are anchored before anything else.

In the HTML they go as `./favicon.ico` and `./favicon.svg` (both the console's
mark since 2026-11-06; a browser that reads SVG icons takes the second), relative
because the console can hang off any prefix (see `app/route.ts`), and the browser
resolves them LATE, against
whatever address is current at that moment. Since the application normalises the
route as soon as it starts (`/settings/` → `/settings/general/`), the resolution
landed one level below and asked for `/settings/favicon.ico`: a 404 on every
route that is not the root.

Pinning it here makes it absolute once, with the root already deduced, and it
stops depending on what the address bar says afterwards.
*/
for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
  link.setAttribute('href', publicUrl(link.getAttribute('href')?.replace(/^\.\//, '') ?? 'favicon.ico'))
}

/* The theme goes on before the first render, so not even the login is drawn in
   the wrong one (see `theme/theme.ts`). */
applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
