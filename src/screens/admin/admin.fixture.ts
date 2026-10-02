import type {
  AdminGroup,
  AdminSession,
  AdminUser,
  AdminUserDetails,
  LdapConfig,
  SectionPermission,
  SsoConfig,
} from '../../api/admin'
import type { ClusterState } from '../../api/admin-cluster'

/*
Real responses copied from a v15.4 instance (the `ref` one in `dev/`), not
invented. The odd shapes they bring are the subject of several tests:
`tokenName: null`, `0001-01-01T00:00:00` as "never", `0.0.0.0` as the address of
a session that never existed, and a `clusterState` WITHOUT `clusterNodes` because
the cluster is not initialised.

The users and the LDAP config were re-read from a v15.5.1 instance on 2026-09-30:
`type` arrived with that release, `remotelyManagedGroups` replaced
`ssoManagedGroups`, and a `RemoteSSO` user carries no `totpEnabled` at all
(WebServiceAuthApi.cs:140-146) — which is why `SSO_USER` below does not either.
*/

export const ADMIN_SESSION: AdminSession = {
  username: 'admin',
  isCurrentSession: true,
  partialToken: '5fc1a6bc90cc1d9a',
  type: 'Standard',
  tokenName: null,
  lastSeen: '2026-08-26T05:29:17.1433348Z',
  lastSeenRemoteAddress: '172.23.0.1',
  lastSeenUserAgent: 'curl/8.18.0',
}

export const TOKEN_SESSION: AdminSession = {
  username: 'testuser',
  isCurrentSession: false,
  partialToken: '799a4919af7636e2',
  type: 'ApiToken',
  tokenName: 'tok1',
  lastSeen: '2026-08-26T05:29:41.6606519Z',
  lastSeenRemoteAddress: '172.23.0.1',
  lastSeenUserAgent: 'curl/8.18.0',
}

export const ADMIN_USER: AdminUser = {
  displayName: 'Administrator',
  username: 'admin',
  type: 'Local',
  isSsoUser: false,
  totpEnabled: false,
  disabled: false,
  previousSessionLoggedOn: '2026-08-26T05:29:16.3059242Z',
  previousSessionRemoteAddress: '172.23.0.1',
  recentSessionLoggedOn: '2026-08-26T05:29:17.122235Z',
  recentSessionRemoteAddress: '172.23.0.1',
}

/** A freshly created user: they have never logged in. */
export const NEW_USER: AdminUser = {
  displayName: 'Test User',
  username: 'testuser',
  type: 'Local',
  isSsoUser: false,
  totpEnabled: false,
  disabled: false,
  previousSessionLoggedOn: '0001-01-01T00:00:00',
  previousSessionRemoteAddress: '0.0.0.0',
  recentSessionLoggedOn: '0001-01-01T00:00:00',
  recentSessionRemoteAddress: '0.0.0.0',
}

/* Built from the contract, not observed: the harness has no identity provider.
   `totpEnabled` is left out because the server leaves it out for this type. */
const { totpEnabled: _noTotp, ...NEW_USER_WITHOUT_TOTP } = NEW_USER
export const SSO_USER: AdminUser = {
  ...NEW_USER_WITHOUT_TOTP,
  displayName: 'Adrián',
  username: 'adrian@example.com',
  type: 'RemoteSSO',
  isSsoUser: true,
}

/* Same: the harness has no directory, so this one is built from the contract. */
export const LDAP_USER: AdminUser = {
  ...NEW_USER,
  displayName: 'Ana Directory',
  username: 'ana',
  type: 'RemoteLDAP',
  isSsoUser: false,
  totpEnabled: false,
}

export const USER_DETAIL: AdminUserDetails = {
  ...NEW_USER,
  sessionTimeoutSeconds: 1800,
  remotelyManagedGroups: false,
  memberOfGroups: [],
  sessions: [],
  groups: ['Administrators', 'DHCP Administrators', 'DNS Administrators'],
}

export const GROUPS: AdminGroup[] = [
  { name: 'Administrators', description: 'Super administrators' },
  { name: 'DHCP Administrators', description: 'DHCP service administrators' },
  { name: 'DNS Administrators', description: 'DNS service administrators' },
]

export const PERMISSIONS: SectionPermission[] = [
  {
    section: 'Dashboard',
    userPermissions: [],
    groupPermissions: [
      { name: 'Administrators', canView: true, canModify: true, canDelete: true },
      { name: 'Everyone', canView: true, canModify: false, canDelete: false },
    ],
  },
  {
    section: 'Zones',
    userPermissions: [{ username: 'testuser', canView: true, canModify: false, canDelete: false }],
    groupPermissions: [
      { name: 'Administrators', canView: true, canModify: true, canDelete: true },
    ],
  },
]

export const SSO: SsoConfig = {
  ssoEnabled: false,
  ssoAuthority: null,
  ssoClientId: null,
  ssoClientSecret: null,
  ssoMetadataAddress: null,
  ssoScopes: ['openid', 'profile', 'email'],
  ssoAllowSignup: false,
  ssoAllowSignupOnlyForMappedUsers: true,
  ssoGroupMap: [],
  localGroups: ['Administrators', 'DHCP Administrators', 'DNS Administrators'],
}

/** `admin/ldap/get?includeGroups=true` on a fresh v15.5.1, literally: five
 *  strings `null`, and sign-up off while "only for mapped users" is ON. */
export const LDAP: LdapConfig = {
  ldapEnabled: false,
  ldapServer: null,
  ldapPort: 389,
  ldapSslOption: 'None',
  ldapIgnoreSslErrors: false,
  ldapBindUsername: null,
  ldapBindPassword: null,
  ldapSearchBase: null,
  ldapUserSearchFilter: null,
  ldapGroupAttribute: null,
  ldapAllowSignup: false,
  ldapAllowSignupOnlyForMappedUsers: true,
  ldapGroupMap: [],
  localGroups: ['Administrators', 'DHCP Administrators', 'DNS Administrators'],
}

/** A standalone server: `clusterDomain`, the intervals and `clusterNodes` do NOT
 *  come. It is the literal response of the reference instance. */
export const CLUSTER_NOT_INITIALISED: ClusterState = {
  version: '15.4',
  dnsServerDomain: 'ref.technitium-ui.test',
  clusterInitialized: false,
}

/** A two-node cluster, built from the contract in `WebServiceClusterApi.cs`: it
 *  could NOT be observed live. */
export const CLUSTER_PRIMARY: ClusterState = {
  version: '15.4',
  dnsServerDomain: 'ns1.mycluster.test',
  clusterInitialized: true,
  clusterDomain: 'mycluster.test',
  heartbeatRefreshIntervalSeconds: 30,
  heartbeatRetryIntervalSeconds: 10,
  configRefreshIntervalSeconds: 900,
  configRetryIntervalSeconds: 60,
  clusterNodes: [
    {
      id: 1,
      name: 'ns1.mycluster.test',
      url: 'https://ns1.mycluster.test:53443',
      ipAddresses: ['10.0.0.1'],
      type: 'Primary',
      state: 'Self',
      upSince: '2026-08-25T10:00:00Z',
    },
    {
      id: 2,
      name: 'ns2.mycluster.test',
      url: 'https://ns2.mycluster.test:53443',
      ipAddresses: ['10.0.0.2'],
      type: 'Secondary',
      state: 'Connected',
      upSince: '2026-08-25T10:05:00Z',
      lastSeen: '2026-08-26T05:00:00Z',
    },
  ],
}

/** The same cluster seen FROM the secondary. */
export const CLUSTER_SECONDARY: ClusterState = {
  ...CLUSTER_PRIMARY,
  dnsServerDomain: 'ns2.mycluster.test',
  clusterNodes: [
    {
      ...CLUSTER_PRIMARY.clusterNodes![0],
      state: 'Connected',
      lastSeen: '2026-08-26T05:00:00Z',
    },
    {
      ...CLUSTER_PRIMARY.clusterNodes![1],
      state: 'Self',
      configLastSynced: '2026-08-26T04:00:00Z',
    },
  ],
}
