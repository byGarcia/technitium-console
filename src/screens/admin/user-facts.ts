import type { AdminUser } from '../../api/admin'
import { neverUsed } from '../../api/zones'
import { dateTime, fromNow } from './dates'

/*
What the Users list reads from `admin/users/list`, worked out once so the strip,
the table and the filters say the same thing.
*/

/*
`getAdminUsersRowHtml` (auth.js:1148-1174): the user type label and the 2FA
status. `RemoteSSO` is "Remote/SSO" and "SSO Managed"; `RemoteLDAP` is
"Remote/LDAP" with its own 2FA status; `Local` and ANYTHING ELSE fall to the
`default:`, which writes `user.type` itself as the label: "Local" reads "Local"
because that is what the server sends.
*/
export function userType(u: Pick<AdminUser, 'type'>): string {
  switch (u.type) {
    case 'RemoteSSO':
      return 'Remote/SSO'
    case 'RemoteLDAP':
      return 'Remote/LDAP'
    default:
      return u.type
  }
}

export function totpStatus(u: Pick<AdminUser, 'type' | 'totpEnabled'>): string {
  if (u.type === 'RemoteSSO') return 'SSO Managed'
  return u.totpEnabled ? 'Enabled' : 'Disabled'
}

export function userStatus(u: Pick<AdminUser, 'disabled'>): 'Enabled' | 'Disabled' {
  return u.disabled ? 'Disabled' : 'Enabled'
}

/*
A login as upstream writes it, `date from address`, or `Never` for .NET's
sentinel. Upstream formats the sentinel too (auth.js:1141) and shows
"0000-12-31 23:45:16 from 0.0.0.0"; this console has said `Never` since before
2026-11-06.
*/
export function access(iso: string, address: string): string {
  return neverUsed(iso) ? 'Never' : `${dateTime(iso)} from ${address}`
}

/** The same login in its parts, for a row on one line and its Details. */
export function loginParts(iso: string, address: string): { never: boolean; date: string; ago: string; address: string } {
  if (neverUsed(iso)) return { never: true, date: 'Never', ago: '', address: '' }
  return { never: false, date: dateTime(iso), ago: fromNow(iso), address }
}

/* A type's series colour, by the label upstream writes. */
const TYPE_COLOURS: Record<string, string> = {
  Local: 'var(--ch-1)',
  'Remote/SSO': 'var(--ch-3)',
  'Remote/LDAP': 'var(--ch-5)',
}

export function typeColour(label: string): string {
  return TYPE_COLOURS[label] ?? 'var(--ch-drop)'
}

export const STATUS_COLOURS = { Enabled: 'var(--ch-ok)', Disabled: 'var(--ch-drop)' } as const

/** The labels present, Local first and then in the order the list brings them. */
export function typesOf(users: readonly AdminUser[]): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const u of users) counts.set(userType(u), (counts.get(userType(u)) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([a], [b]) => (a === 'Local' ? -1 : b === 'Local' ? 1 : 0))
    .map(([label, count]) => ({ label, count }))
}

/** The user who logged in last, or `null` when nobody ever has. */
export function lastLogin(users: readonly AdminUser[]): AdminUser | null {
  let best: AdminUser | null = null
  for (const u of users) {
    if (neverUsed(u.recentSessionLoggedOn)) continue
    if (best == null || Date.parse(u.recentSessionLoggedOn) > Date.parse(best.recentSessionLoggedOn)) best = u
  }
  return best
}
