/*
The console's 11 sections, in upstream's order — with one that is OURS: Blocking
takes the place of upstream's Allowed and Blocked, and gathers them with the block
lists into three tabs (docs/2026-10-01-blocking-section-spec.md, the section on the
exception, "La excepción"). Their old addresses still land: see `LEGACY_ROUTES` in
`static-routes.ts`.

`permission` is the key inside `sessionData.info.permissions`, and it does NOT
always match the label: the "DNS Client" tab is governed by `DnsClient` and "DHCP"
by `DhcpServer`. `About` has no permission: it is always visible.

Each section is hidden if its `canView` is false (main.js:119-250). `phase` records
which phase each one came out of; with phases 4, 8 and 9 closed there is none left
unimplemented.
*/
export interface Section {
  id: string
  label: string
  /** The key inside `permissions`, or a LIST meaning "any of these" (Blocking:
   *  visible with Blocked OR Allowed). */
  permission: string | readonly string[] | null
  phase: string
  /** Sub-sections, with upstream's literal labels. They are only shown when their
   *  section is active, exactly as the sub-tabs are today. */
  subs?: string[]
}

export const SECTIONS: Section[] = [
  { id: 'dashboard', label: 'Dashboard', permission: 'Dashboard', phase: 'phase 3' },
  { id: 'zones', label: 'Zones', permission: 'Zones', phase: 'phase 4' },
  { id: 'cache', label: 'Cache', permission: 'Cache', phase: 'phase 5' },
  { id: 'blocking', label: 'Blocking', permission: ['Blocked', 'Allowed'], phase: 'blocking section',
    subs: ['Overview', 'Rules', 'Lists'] },
  { id: 'apps', label: 'Apps', permission: 'Apps', phase: 'phase 7' },
  { id: 'dnsclient', label: 'DNS Client', permission: 'DnsClient', phase: 'phase 3' },
  { id: 'settings', label: 'Settings', permission: 'Settings', phase: 'phase 6',
    subs: ['General','Web Service','Optional Protocols','TSIG','Recursion','Cache','Blocking','Proxy & Forwarders','Logging'] },
  { id: 'dhcp', label: 'DHCP', permission: 'DhcpServer', phase: 'phase 8', subs: ['Leases','Scopes'] },
  { id: 'admin', label: 'Administration', permission: 'Administration', phase: 'phase 9',
    subs: ['Sessions','Users','Groups','Permissions','SSO','LDAP','Cluster'] },
  { id: 'logs', label: 'Logs', permission: 'Logs', phase: 'phase 8', subs: ['View Logs','Query Logs'] },
  { id: 'about', label: 'About', permission: null, phase: 'phase 3' },
]

export interface Permission { canView: boolean; canModify: boolean; canDelete: boolean }

export function visibleSections(
  permissions: Record<string, Permission> | undefined,
  list: Section[] = SECTIONS,
): Section[] {
  if (!permissions) return list
  return list.filter((s) => {
    if (s.permission == null) return true
    const keys = typeof s.permission === 'string' ? [s.permission] : s.permission
    return keys.some((k) => permissions[k]?.canView !== false)
  })
}
