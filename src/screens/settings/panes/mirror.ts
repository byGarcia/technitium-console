import { createContext } from 'react'

/*
True while a pane is drawn out of sight only so Search settings can count what it
holds (`Settings.tsx`, `search.ts`). Such a pane reads nothing: the two that load a
Quick Select list (Blocking, Proxy & Forwarders) skip it, so a search fetches no
file and asks the server nothing.
*/
export const PaneMirror = createContext(false)
