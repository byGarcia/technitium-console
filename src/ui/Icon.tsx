import type { ReactElement, SVGProps } from 'react'

/*
The console's icon set, drawn here.

They used to be Unicode characters (`▣ ◆ ○ ✓ ⊘ ⊞ ⌕ ⚙ ▤ ☺ ≡ ⓘ`), and that has two
and a half problems: every operating system paints them with its own font, so the
console changed appearance depending on the machine; they share neither stroke
weight nor grid, because they are not a set but twelve loose symbols from
different tables; and `☺` for Administration is literally a smiley face.

A library cannot be brought in: the server's CSP is `default-src 'self'` with no
`font-src` (DnsWebService.cs:1969-1975), so no CDN and no icon font. They go as
inline SVG, which is also what lets them inherit the text colour.

24 grid, 1.75 stroke and round caps, the same for all of them.
*/

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export type IconName =
  | 'dashboard' | 'clients' | 'zones' | 'cache' | 'allowed' | 'blocked' | 'apps'
  | 'dnsclient' | 'settings' | 'dhcp' | 'admin' | 'logs' | 'about'
  | 'chevronDown' | 'chevronRight' | 'chevronLeft'
  | 'first' | 'last' | 'close' | 'menu' | 'plus' | 'sort' | 'back' | 'check'
  | 'edit' | 'power' | 'card' | 'convert' | 'warning' | 'lock'
  | 'moveUp' | 'moveDown'
  | 'shield' | 'add' | 'trash' | 'refresh' | 'search' | 'download' | 'upload' | 'run' | 'store' | 'key' | 'save'
  | 'file' | 'eye' | 'copy'
  | 'external' | 'mail'
  | 'user' | 'theme' | 'bell' | 'bellOff' | 'logout'

const PATHS: Record<IconName, ReactElement> = {
  // ── Leading a button's label (`ui/Button`, `lead`), 2026-11-05 ──────────
  /* A shield with a tick: a zone's DNSSEC (Zones, the DNSSEC card). */
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 8 7 9.5 4.1-1.5 7-5.3 7-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  /* A cross: add something to a list (Add Zone, Add block list…). */
  add: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  /* A bin: what empties or removes (Flush Cache, Delete Zones). */
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  /* Two turning arrows: read again (Refresh, Update Now). */
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  /* A lens: look something up (Query, Browse, Check). */
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  /* Out of the console (Export, Backup Settings). */
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  /* Into the console (Import, Restore Settings, Install from file). */
  upload: (
    <>
      <path d="M12 20V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 4h14" />
    </>
  ),
  /* Send it off (Resolve). */
  run: <path d="M7 5v14l11-7z" />,
  /* Four tiles: a catalogue to pick from (App Store). */
  store: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  /* A key: a credential (Create Token). */
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8" />
      <path d="m16 7 3 3" />
    </>
  ),
  /* A disk: keep what changed (Save Settings). */
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4" />
      <path d="M8 20v-6h8v6" />
    </>
  ),

  // ── Sections ───────────────────────────────────────────────────────────
  /* A panel with its readings: the dashboard. */
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
    </>
  ),
  /* A screen and a phone side by side: the machines that ask the server. */
  clients: (
    <>
      <rect x="2.5" y="4.5" width="13" height="9.5" rx="1.5" />
      <path d="M6 19h6" />
      <path d="M9 14v5" />
      <rect x="17.5" y="8" width="4.5" height="11" rx="1.25" />
      <path d="M19.75 16.5h0" />
    </>
  ),
  /* A domain tree: the root and its branches. That is what a zone is. */
  zones: (
    <>
      <path d="M12 3v5" />
      <path d="M6 21v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
      <path d="M12 12v4" />
      <circle cx="12" cy="4.5" r="1.5" />
      <circle cx="6" cy="19.5" r="1.5" />
      <circle cx="18" cy="19.5" r="1.5" />
      <circle cx="12" cy="10.5" r="1.5" />
    </>
  ),
  /* Stacked layers: what is stored waiting to be served again. */
  cache: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="2.75" />
      <path d="M4 5.5v6c0 1.5 3.6 2.75 8 2.75s8-1.25 8-2.75v-6" />
      <path d="M4 11.5v6c0 1.5 3.6 2.75 8 2.75s8-1.25 8-2.75v-6" />
    </>
  ),
  /* Shield with a tick: what gets through. */
  allowed: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 8 7 9.5 4.1-1.5 7-5.3 7-9.5V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  /* Shield with a cross: what does not. */
  blocked: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 8 7 9.5 4.1-1.5 7-5.3 7-9.5V6z" />
      <path d="m9.5 9.5 5 5m0-5-5 5" />
    </>
  ),
  /* A module that plugs into the server. */
  apps: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M9 8V5.5a2.5 2.5 0 0 1 5 0V8" />
      <path d="M9.5 14h5" />
    </>
  ),
  /* A query going out and an answer coming back. */
  dnsclient: (
    <>
      <path d="M4 9h11" />
      <path d="m11.5 5.5 3.5 3.5-3.5 3.5" />
      <path d="M20 15H9" />
      <path d="m12.5 11.5-3.5 3.5 3.5 3.5" />
    </>
  ),
  /* The sliders of a settings panel. */
  settings: (
    <>
      <path d="M5 7h9" />
      <path d="M18 7h1" />
      <path d="M5 17h4" />
      <path d="M13 17h6" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="11" cy="17" r="2" />
    </>
  ),
  /* An assignment: the address handed out to a machine. */
  dhcp: (
    <>
      <rect x="3" y="4" width="18" height="9" rx="2" />
      <path d="M7.5 8.5h4" />
      <path d="M12 17v3" />
      <path d="M8 20h8" />
      <path d="M12 13v4" />
    </>
  ),
  /* A key: who can do what. Not a smiley, not a person. */
  admin: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M11.8 11h8.2" />
      <path d="M17 11v3.5" />
      <path d="M20 11v2.5" />
    </>
  ),
  /* Log lines, one shorter because the last one is mid-write. */
  logs: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M4.5 10.5h15" />
      <path d="M4.5 14.5h15" />
      <path d="M4.5 18.5h8" />
    </>
  ),
  /*
The notice triangle. It was the only icon the design pass added to the set, and it is drawn
with the same grid and the same stroke as the other twenty-seven. Its inside
repeats the language of `about` (stem and dot) because they are the same idea seen
two ways, and `about` is the circle that belongs to the `Note!`.
  */
  warning: (
    <>
      <path d="M12 4.5 21.5 20.5H2.5z" />
      <path d="M12 10.5v4" />
      <path d="M12 17v.5" />
    </>
  ),
  /*
The padlock. It is the second word of the console's two-word vocabulary
("amber = you can, padlock = you cannot"), and it was not drawn: the set had the
notice triangle but not this.

Same closed body and same arc as the rest: a grid of 24 and a stroke of
  */
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75v.5" />
    </>
  ),

  // ── Controls ──────────────────────────────────────────────────────────
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  first: (
    <>
      <path d="m17 6-6 6 6 6" />
      <path d="M7.5 6v12" />
    </>
  ),
  last: (
    <>
      <path d="m7 6 6 6-6 6" />
      <path d="M16.5 6v12" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m20 6-11 11-5-5" />,

  // ── Row actions ───────────────────────────────────────────────────────
  edit: (
    <>
      <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
    </>
  ),
  /* Power on and off: the same symbol for both states, because the "Status"
     column already says which one it is in. */
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </>
  ),
  /* Someone's record: "View Details". */
  card: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M5.5 17c.7-1.8 2-2.5 3.5-2.5s2.8.7 3.5 2.5" />
      <path d="M15 9.5h3.5" />
      <path d="M15 13h3.5" />
    </>
  ),
  /* A page with its corner folded: the zone as a text file (Edit Zone File). */
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  /* An eye: open to look, not to change (View Zone, for the types whose records
     this server does not edit). */
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  /* Two sheets, one over the other: make another like this (Clone Zone). */
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  convert: (
    <>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 13-3 3 3 3" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  /* The three dots of a row menu. Filled, not stroked. */
  plus: (
    <g fill="currentColor" stroke="none">
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18.5" r="1.6" />
    </g>
  ),
  /* The double arrowhead of a sortable column, with no direction yet. */
  sort: (
    <>
      <path d="m8 10 4-4 4 4" />
      <path d="m8 14 4 4 4-4" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  /* One line up or down: the row's move buttons in Blocking › Lists. */
  moveUp: (
    <>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  moveDown: (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  /* A box with an arrow leaving it: the destination opens outside the console
     (About's link rows). */
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  // ── The account menu (2026-11-06) ────────────────────────────────────
  /* A head and shoulders: the signed-in account (My Profile). */
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  /* A disc half filled: light and dark (Change Theme). */
  theme: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </>
  ),
  /* A bell: the update notification is on, so the entry turns it off. */
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  /* The bell struck through: the notification is off, the entry turns it on. */
  bellOff: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
      <path d="m4 4 16 16" />
    </>
  ),
  /* A door with an arrow leaving it (Logout). */
  logout: (
    <>
      <path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" />
      <path d="M10.5 12H20" />
      <path d="m16.5 8.5 3.5 3.5-3.5 3.5" />
    </>
  ),
  /* An envelope: the destination is an email address (About's support row). */
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
}

export function Icon({
  name,
  size = 16,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'ref'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...STROKE}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
