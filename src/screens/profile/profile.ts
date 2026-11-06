import type { Profile, SessionRow } from '../../api/user'
import { dateTime, fromNow } from '../../lib/dates'

/*
What the My Profile page reads from `user/profile/get`, worked out once so the
header, the panels and the table say the same thing.

Since v15.5 everything hangs off `type` (auth.js:684-703), not off the obsolete
`isSsoUser`:

  · `RemoteSSO`: name locked, "Remote/SSO", 2FA "SSO Managed".
  · `RemoteLDAP`: name locked, "Remote/LDAP", 2FA Enabled/Disabled; the
    directory checks the password, this server still checks the 2FA.
  · `Local` and anything else: name editable, and the label is `type` AS IT
    ARRIVES. Upstream's `default:` writes the raw value, so for a local user it
    reads "Local" because that is what the server sends.
*/

export function isRemote(p: Pick<Profile, 'type'>): boolean {
  return p.type === 'RemoteSSO' || p.type === 'RemoteLDAP'
}

export function userType(p: Pick<Profile, 'type'>): string {
  return p.type === 'RemoteSSO' ? 'Remote/SSO' : p.type === 'RemoteLDAP' ? 'Remote/LDAP' : (p.type ?? '')
}

export function totpStatus(p: Pick<Profile, 'type' | 'totpEnabled'>): 'SSO Managed' | 'Enabled' | 'Disabled' {
  return p.type === 'RemoteSSO' ? 'SSO Managed' : p.totpEnabled ? 'Enabled' : 'Disabled'
}

/* The account menu's own rules (main.js:71-87 in v15.5.1): `RemoteSSO` has
   neither entry, `RemoteLDAP` only loses the password, which its directory owns. */
export function canChangePassword(p: Pick<Profile, 'type'>): boolean {
  return !isRemote(p)
}

export function canConfigure2fa(p: Pick<Profile, 'type'>): boolean {
  return p.type !== 'RemoteSSO'
}

/*
A session's type, by the words of upstream's label (auth.js:723-739) and a series
colour of its own, so the filter and the table's rows draw the same type the
same way. An unknown type is upstream's amber `Unknown`.
*/
export interface SessionKind {
  key: string
  name: string
  colour: string
}

const KINDS: Record<string, SessionKind> = {
  Standard: { key: 'Standard', name: 'Standard', colour: 'var(--ch-total)' },
  ApiToken: { key: 'ApiToken', name: 'API Token', colour: 'var(--ch-cache)' },
  ClusterApiToken: { key: 'ClusterApiToken', name: 'Cluster API Token', colour: 'var(--ch-auth)' },
}

const UNKNOWN: SessionKind = { key: 'Unknown', name: 'Unknown', colour: 'var(--warn)' }

export function sessionKind(type: string): SessionKind {
  return KINDS[type] ?? UNKNOWN
}

/** The sessions by kind, in upstream's order of the labels, with their counts. */
export function byKind(sessions: readonly SessionRow[]): { kind: SessionKind; count: number }[] {
  const order = ['Standard', 'ApiToken', 'ClusterApiToken', 'Unknown']
  const counts = new Map<string, number>()
  for (const s of sessions) {
    const k = sessionKind(s.type).key
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return order
    .filter((k) => counts.has(k))
    .map((k) => ({ kind: k === 'Unknown' ? UNKNOWN : KINDS[k], count: counts.get(k) ?? 0 }))
}

/* `0001-01-01T00:00:00` is .NET's `default(DateTime)`: the login never happened. */
export function neverLogged(iso: string | undefined): boolean {
  return iso == null || iso.startsWith('0001-01-01')
}

/** A login as `admin/users/list` writes it: `date from address`, or `Never`. */
export function login(iso: string | undefined, address: string | undefined): {
  never: boolean
  date: string
  ago: string
  address: string
} {
  if (neverLogged(iso)) return { never: true, date: 'Never', ago: '', address: '' }
  return { never: false, date: dateTime(iso), ago: fromNow(iso), address: address ?? '' }
}

/** The initial the account menu draws in its circle (`ui/Menu`, `data-initial`). */
export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}
