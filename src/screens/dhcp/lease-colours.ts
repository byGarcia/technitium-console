/*
THE COLOURS OF DHCP (deviation 19, 2026-11-06). A lease type has one series colour,
the same on its card segment, its chip and its dot in the table, taken from the
Dashboard's `--ch-*` like Zones' types (`zones/zone-colours.ts`). Dynamic takes
the blue upstream gives it (`label-primary`, dhcp.js:57); Reserved, which upstream
draws grey (`label-default`), takes the violet, because grey here means "off" (a
disabled scope). The type is always written beside its colour.

A scope's state is the Zones Health card's pair: Enabled `--ok`, Disabled
`--ch-drop`.
*/

const LEASE: Record<string, string> = {
  Dynamic: '--ch-1',
  Reserved: '--ch-3',
}

/** The CSS value of a lease type's colour, `var(--ch-…)`. */
export function leaseColour(type: string): string {
  return `var(${LEASE[type] ?? '--ch-drop'})`
}

export const ENABLED_COLOUR = 'var(--ok)'
export const DISABLED_COLOUR = 'var(--ch-drop)'
