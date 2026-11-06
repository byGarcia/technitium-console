import type { IconName } from '../../ui/Icon'
import type { Section } from '../sections'

/*
What the command palette offers (`CommandPalette.tsx`, CONVENTIONS.md deviation 26).

Every entry is a place the console already has or a step it already takes: a
section or sub-section, a zone, a screen opened on a name (DNS Client, Query Logs,
Cache, Blocking's rules and check, Settings' search) or an account dialog. Nothing
here calls the server: the palette only says where to go, and the screen it lands
on does what it always did. Its words are OURS: the group names, `Go to`, `Open
zone`, the action sentences, `Recent`, and the hints.

A `Target` is plain data so a recent entry can be kept in the browser and run
again after a reload.
*/
export type Target =
  | { kind: 'route'; section: string; sub: string | null; params?: Record<string, string> }
  | { kind: 'dnsclient'; domain: string }
  | { kind: 'logs'; domain: string | null; clientIp: string | null }
  | { kind: 'modal'; id: 'password' | 'twofa' | 'token' | 'theme' }
  | { kind: 'theme'; choice: 'light' | 'dark' | 'system' }
  | { kind: 'logout' }

export type Group = 'Recent' | 'Actions' | 'Pages' | 'Zones' | 'Account'

export interface PaletteItem {
  id: string
  group: Group
  label: string
  /** What it is, drawn at the right: `Page`, `Zone`, `Primary`… */
  hint?: string
  icon: IconName
  /** More words it answers to, never drawn. */
  keywords?: string
  target: Target
}

const ICONS: Record<string, IconName> = {
  dashboard: 'dashboard', zones: 'zones', cache: 'cache', blocking: 'blocked',
  apps: 'apps', dnsclient: 'dnsclient', settings: 'settings', dhcp: 'dhcp',
  admin: 'admin', logs: 'logs', about: 'about', profile: 'admin', clients: 'clients',
}

/** Every section and sub-section this user can see, as `Section › Sub`. */
export function pageItems(sections: Section[], subsOf: (s: Section) => string[]): PaletteItem[] {
  const out: PaletteItem[] = []
  for (const s of sections) {
    const subs = subsOf(s)
    const icon = ICONS[s.id] ?? 'about'
    if (subs.length === 0) {
      out.push({ id: `page:${s.id}`, group: 'Pages', label: s.label, hint: 'Page', icon, target: { kind: 'route', section: s.id, sub: null } })
      continue
    }
    for (const t of subs) {
      /* Logs' two screens are entries of their own in the sidebar: their names stand alone. */
      const label = s.id === 'logs' ? t : `${s.label} › ${t}`
      out.push({
        id: `page:${s.id}/${t}`,
        group: 'Pages',
        label,
        hint: 'Page',
        icon: s.id === 'logs' ? (t === 'Query Logs' ? 'search' : 'file') : icon,
        keywords: s.label,
        target: { kind: 'route', section: s.id, sub: t },
      })
    }
  }
  return out
}

/** The steps that take what was typed: shown only when it could be a name or an address. */
export function actionItems(query: string, can: (section: string) => boolean): PaletteItem[] {
  const q = query.trim()
  if (q === '') return []
  const out: PaletteItem[] = []
  const single = !/\s/.test(q)
  const ip = single && (/^[0-9]+(\.[0-9]+){3}$/.test(q) || (q.includes(':') && /^[0-9a-f:]+$/i.test(q)))
  /* A name only when it reads as one: a dot, no spaces. "recur" is a page, not a domain. */
  const name = single && !ip && /^[a-z0-9_*-]+(\.[a-z0-9_-]+)+\.?$/i.test(q)
  const add = (id: string, label: string, icon: IconName, target: Target, section: string) => {
    if (can(section)) out.push({ id: `action:${id}`, group: 'Actions', label, icon, target })
  }
  if (name) {
    add('check', `Check ${q} in Blocking`, 'shield', { kind: 'route', section: 'blocking', sub: 'Overview', params: { check: q } }, 'blocking')
    add('dnsclient', `Resolve ${q} in DNS Client`, 'dnsclient', { kind: 'dnsclient', domain: q }, 'dnsclient')
    add('logs', `Search Query Logs for ${q}`, 'search', { kind: 'logs', domain: q, clientIp: null }, 'logs')
    add('cache', `Find ${q} in Cache`, 'cache', { kind: 'route', section: 'cache', sub: null, params: { domain: q } }, 'cache')
    add('rules', `Search your rules for ${q}`, 'blocked', { kind: 'route', section: 'blocking', sub: 'Rules', params: { q } }, 'blocking')
  } else if (ip) {
    add('logs-client', `Search Query Logs for client ${q}`, 'search', { kind: 'logs', domain: null, clientIp: q }, 'logs')
  }
  add('settings', `Search settings for ${q}`, 'settings', { kind: 'route', section: 'settings', sub: 'General', params: { q } }, 'settings')
  return out
}

/** The account menu's entries, and the theme picked in one step. */
export function accountItems(opts: { canChangePassword: boolean; canConfigure2fa: boolean }): PaletteItem[] {
  const out: PaletteItem[] = [
    { id: 'account:profile', group: 'Account', label: 'My Profile', hint: 'Page', icon: 'admin', target: { kind: 'route', section: 'profile', sub: null } },
  ]
  if (opts.canChangePassword) out.push({ id: 'account:password', group: 'Account', label: 'Change Password', icon: 'key', target: { kind: 'modal', id: 'password' } })
  if (opts.canConfigure2fa) out.push({ id: 'account:2fa', group: 'Account', label: 'Configure 2FA', icon: 'lock', target: { kind: 'modal', id: 'twofa' } })
  out.push(
    { id: 'account:token', group: 'Account', label: 'Create API Token', icon: 'key', target: { kind: 'modal', id: 'token' } },
    { id: 'account:light', group: 'Account', label: 'Use the light theme', icon: 'eye', keywords: 'theme appearance', target: { kind: 'theme', choice: 'light' } },
    { id: 'account:dark', group: 'Account', label: 'Use the dark theme', icon: 'eye', keywords: 'theme appearance', target: { kind: 'theme', choice: 'dark' } },
    { id: 'account:system', group: 'Account', label: 'Use the system theme', icon: 'eye', keywords: 'theme appearance', target: { kind: 'theme', choice: 'system' } },
    { id: 'account:logout', group: 'Account', label: 'Logout', icon: 'power', keywords: 'sign out', target: { kind: 'logout' } },
  )
  return out
}

/** A zone, opened as the zone list opens it (`?zone=`). */
export function zoneItem(name: string, type: string): PaletteItem {
  return {
    id: `zone:${name}`,
    group: 'Zones',
    label: name === '' ? '.' : name,
    hint: type,
    icon: 'zones',
    target: { kind: 'route', section: 'zones', sub: null, params: { zone: name === '' ? '.' : name } },
  }
}

/*
How well an entry answers what was typed: every word must be in its label or its
keywords, and a label that starts with the words, or has one of its words start
with them, comes first. `null` when it does not answer.
*/
export function score(item: PaletteItem, query: string): number | null {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  const label = item.label.toLowerCase()
  const haystack = `${label} ${(item.keywords ?? '').toLowerCase()} ${(item.hint ?? '').toLowerCase()}`
  let total = 0
  for (const w of words) {
    const at = haystack.indexOf(w)
    if (at < 0) return null
    if (label.startsWith(w)) total += 3
    else if (new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) total += 2
    else if (label.includes(w)) total += 1
  }
  return total
}

/** The entries that answer, best first, at most `max` per group, in group order. */
export function rank(items: PaletteItem[], query: string, max = 6): PaletteItem[] {
  /* A zone or a page that answers comes before the steps on the typed text: typing a
     zone's name opens the zone first, and a name nothing else answers checks it. */
  const order: Group[] = ['Recent', 'Zones', 'Pages', 'Actions', 'Account']
  const scored = items
    .map((item, i) => ({ item, i, s: item.group === 'Actions' ? 0 : score(item, query) }))
    .filter((x): x is { item: PaletteItem; i: number; s: number } => x.s != null)
  const out: PaletteItem[] = []
  for (const g of order) {
    out.push(
      ...scored
        .filter((x) => x.item.group === g)
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .slice(0, g === 'Actions' ? 8 : max)
        .map((x) => x.item),
    )
  }
  return out
}

const RECENT_KEY = 'paletteRecent'

/** The last entries run from the palette, newest first, kept in this browser. */
export function readRecent(): PaletteItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as PaletteItem[]
    return Array.isArray(v) ? v.slice(0, 5).map((x) => ({ ...x, group: 'Recent' as const })) : []
  } catch {
    return []
  }
}

export function remember(item: PaletteItem): void {
  try {
    const kept = readRecent().filter((x) => x.id !== item.id)
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ ...item, group: 'Recent' }, ...kept].slice(0, 5)))
  } catch {
    /* A browser that keeps nothing simply has no recent entries. */
  }
}
