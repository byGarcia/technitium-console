/*
THE COLOURS OF ZONES (2026-11-05). Each record type and each zone type has ONE
series colour, the same wherever it is drawn: its chip in the records table, its
segment in a card's bar, its swatch in a legend. They are the Dashboard's series
tokens (`--ch-*` in theme/tokens.css), already measured against each other and
against both themes, so nothing new is invented here and nothing here is a text
token's colour (DESIGN, rule 5).

The common types get a colour of their own; every other type shares the neutral
series, so a zone full of DNSSEC records does not turn into a rainbow. The
colour is never the only channel: the type is always written beside it.
*/

const RECORD: Record<string, string> = {
  A: '--ch-1',
  AAAA: '--ch-2',
  CNAME: '--ch-3',
  MX: '--ch-4',
  NS: '--ch-5',
  SOA: '--ch-6',
  TXT: '--ch-8',
  PTR: '--ch-nx',
}

const ZONE: Record<string, string> = {
  Primary: '--ch-1',
  Secondary: '--ch-5',
  Forwarder: '--ch-4',
  Stub: '--ch-8',
  Catalog: '--ch-3',
  SecondaryForwarder: '--ch-2',
  SecondaryCatalog: '--ch-6',
}

const NEUTRAL = '--ch-drop'

/** The CSS value of a record type's colour, `var(--ch-…)`. */
export function recordColour(type: string): string {
  return `var(${RECORD[type.toUpperCase()] ?? NEUTRAL})`
}

/** The CSS value of a zone type's colour, `var(--ch-…)`. */
export function zoneColour(type: string): string {
  return `var(${ZONE[type] ?? NEUTRAL})`
}
