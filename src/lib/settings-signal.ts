/*
"This console has just written the server's settings." OURS, and in-page only: a
setting changed from another browser is not heard here.

It exists for the sidebar's Blocking mark (`screens/blocking/blocking-state.ts`):
blocking can be switched from the Overview, the Dashboard's menu and Settings ›
Blocking, and the sidebar is in none of them. The writes say so themselves
(`api/settings.ts`: `settings/set`, `settings/temporaryDisableBlocking` and
`settings/restore`, on success), so no screen has to remember to.
*/

type Listener = () => void

const listeners = new Set<Listener>()

export function onSettingsChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function settingsChanged(): void {
  for (const listener of [...listeners]) listener()
}
