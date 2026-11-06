import type { LdapConfig, SsoConfig } from '../../api/admin'

/* Whether what the login needs is set: SSO's authority and client ID, LDAP's server
   (`ConfigState` in `ListParts.tsx`, deviation 23). */
export function ssoConfigured(c: Pick<SsoConfig, 'ssoAuthority' | 'ssoClientId'>): boolean {
  return (c.ssoAuthority ?? '') !== '' && (c.ssoClientId ?? '') !== ''
}

export function ldapConfigured(c: Pick<LdapConfig, 'ldapServer'>): boolean {
  return (c.ldapServer ?? '') !== ''
}
