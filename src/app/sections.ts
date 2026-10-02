/*
The console's 11 sections, in upstream's order, with one that is OURS: Blocking
takes the place of upstream's Allowed and Blocked, and gathers them with the block
lists into three tabs (CONVENTIONS.md, "Deliberate deviations from upstream
behaviour", item 2). Their old addresses still land: see `LEGACY_ROUTES` in
`static-routes.ts`.

`permission` is the key inside `sessionData.info.permissions`, and it does NOT
always match the label: the "DNS Client" tab is governed by `DnsClient` and "DHCP"
by `DhcpServer`. `About` has no permission: it is always visible.

Each section is hidden if its `canView` is false (main.js:119-250).
*/
export interface Section {
  id: string
  label: string
  /** The key inside `permissions`, or a LIST meaning "any of these" (Blocking:
   *  visible with Blocked OR Allowed). */
  permission: string | readonly string[] | null
  /** Sub-sections, with upstream's literal labels. They are only shown when their
   *  section is active, exactly as the sub-tabs are today. */
  subs?: string[]
}

export const SECTIONS: Section[] = [
  { id: 'dashboard', label: 'Dashboard', permission: 'Dashboard' },
  { id: 'zones', label: 'Zones', permission: 'Zones' },
  { id: 'cache', label: 'Cache', permission: 'Cache' },
  { id: 'blocking', label: 'Blocking', permission: ['Blocked', 'Allowed'],
    subs: ['Overview', 'Rules', 'Lists'] },
  { id: 'apps', label: 'Apps', permission: 'Apps' },
  { id: 'dnsclient', label: 'DNS Client', permission: 'DnsClient' },
  { id: 'settings', label: 'Settings', permission: 'Settings',
    subs: ['General','Web Service','Optional Protocols','TSIG','Recursion','Cache','Blocking','Proxy & Forwarders','Logging'] },
  { id: 'dhcp', label: 'DHCP', permission: 'DhcpServer', subs: ['Leases','Scopes'] },
  { id: 'admin', label: 'Administration', permission: 'Administration',
    subs: ['Sessions','Users','Groups','Permissions','SSO','LDAP','Cluster'] },
  { id: 'logs', label: 'Logs', permission: 'Logs', subs: ['View Logs','Query Logs'] },
  { id: 'about', label: 'About', permission: null },
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
