import type { Permission } from '../../app/sections'

/*
What each control of the Blocking section asks for is what the SERVER asks of the
call it makes (WebServiceOtherZonesApi.cs, WebServiceSettingsApi.cs,
WebServiceDashboardApi.cs, WebServiceLogsApi.cs). A control whose permission is
missing is drawn disabled with `PermissionButton`, never hidden.
*/

export type Permissions = Record<string, Permission> | undefined
export type Need = `${string}.can${'View' | 'Modify' | 'Delete'}`

export function missing(perms: Permissions, ...needs: Need[]): Need | undefined {
  if (perms == null) return undefined
  for (const need of needs) {
    const [section, flag] = need.split('.') as [string, keyof Permission]
    if (perms[section]?.[flag] === false) return need
  }
  return undefined
}

/** The same sentence `PermissionButton` draws: `Requires Logs: View`. */
export function requiresText(need: string): string {
  const [section, action] = need.split('.')
  return `Requires ${section}: ${(action ?? '').replace(/^can/, '')}`
}
