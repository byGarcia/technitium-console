import { dnsAppLabels, type InstalledApp } from '../../api/apps'

/*
THE KINDS OF DNS APP, AND THEIR COLOURS (deviation 17 in CONVENTIONS.md,
2026-11-06). A kind is one of the labels upstream writes under an app's class
(`getAppRowHtml`, apps.js:80-104; `dnsAppLabels` in api/apps.ts): what the class
plugs into in the server. Each has ONE series colour, the same wherever it is
drawn: its chip in the Kind column, its segment and chip in the Classes card, its
chip under a class in More Details.

The colours are the Dashboard's open cycle (`--ch-1` to `--ch-8` in
theme/tokens.css), the eight series `dev/palette-distance.mjs` measures against
each other in both themes, so nothing is invented here. `Generic`, a class that
plugs into nothing named, takes the neutral series. The colour is never the only
channel: the kind is always written beside it.
*/

/** The kinds in upstream's order, which is also the order of the Kind filter. */
export const KINDS = [
  'APP Record',
  'Access Control',
  'Authoritative',
  'Blocking',
  'Query Logger',
  'Query Logs',
  'Post Processor',
  'Generic',
] as const

const COLOUR: Record<string, string> = {
  'APP Record': '--ch-1',
  'Access Control': '--ch-4',
  Authoritative: '--ch-5',
  Blocking: '--ch-7',
  'Query Logger': '--ch-2',
  'Query Logs': '--ch-8',
  'Post Processor': '--ch-3',
}

/** The CSS value of a kind's colour, `var(--ch-…)`. */
export function kindColour(kind: string): string {
  return `var(${COLOUR[kind] ?? '--ch-drop'})`
}

/** The kinds an app's classes carry, each once, in upstream's order. */
export function kindsOf(app: InstalledApp): string[] {
  const all = new Set(app.dnsApps.flatMap((d) => dnsAppLabels(d)))
  return KINDS.filter((k) => all.has(k))
}

/** Advanced Blocking by its class, not its name: a zip uploaded under another name is still the app. */
export function isAdvancedBlocking(app: InstalledApp): boolean {
  return app.dnsApps.some((d) => d.classPath === 'AdvancedBlocking.App')
}

/*
WHERE AN APP STANDS AGAINST THE STORE (the Installed Apps card). The server writes
`updateVersion`, `updateUrl` and `updateAvailable` only for an app whose NAME the
store lists with a version for this server, and for none when the store did not
answer in time (api/apps.ts). Checked on 2026-11-06 against v15.6.1: the Wild IP
zip installed from a file as `Lab Wild IP` carries none of the three, the same zip
as `Wild IP` would. So the third state cannot be told apart any further.
*/
/** Why an app can carry no store version, which the screen cannot tell apart. */
export const NO_STORE_WHY =
  'The server gives a store version only for an app whose name the DNS App Store lists with a version for this server, and for none when the store could not be reached.'

export type UpdateState = 'Up to date' | 'Update available' | 'No store version'

/** Where an app stands against the store. `updateAvailable` may be absent. */
export function updateState(app: InstalledApp): UpdateState {
  if (app.updateAvailable === true) return 'Update available'
  if (app.updateAvailable === false) return 'Up to date'
  return 'No store version'
}

