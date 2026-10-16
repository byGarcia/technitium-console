import { serializeTable, type Cell } from '../../lib/table-serialise'
import { cleanList, nodeScope, type QpmRow, type SettingsForm, type TsigRow } from './model'
import type { SubTab } from './Settings'

/*
What a save would change, pane by pane, for the save bar and the sub-tabs' marks.
OURS (CONVENTIONS.md, deviation 3, approved on 2026-10-16): upstream's bar says
nothing, and "Save Settings" sends the fields of all nine panes wherever you are,
so a field edited two tabs ago is sent too without anything on screen saying so.

The question it answers is "what would the save send that the server does not
already have", and not "which inputs did the user type in". That is what keeps it
honest in the three cases where the two part company:

  · **A field touched and restored does not count**, and neither does an edit that
    only changes what the save cleans away: a blank line or a trailing newline in a
    list (`cleanTextList`, common.js:326) sends exactly the same parameter.
  · **A field the save does not send does not count.** With the aggregate chosen
    in the node selector the save drops the node's own blocks, and with a node
    chosen it drops the cluster's (`nodeScope`, main.js:1639-1644); the proxy's
    address, port, credentials and bypass list only travel when a proxy type is
    chosen (main.js:2123-2140). An edit there would be thrown away by the save, so
    saying it is pending would be false.
  · **`temporaryDisableBlockingMinutes` is not a setting.** It is the argument of
    the `Temporarily Disable Blocking` button, which acts at once through its own
    endpoint; the save never sends it.

Each field says how the save writes it, and those are `buildBody`'s own rules
(model.ts), field by field: the list cleaning and the `"false"` of an empty list,
the three lists and the port that fall back to a default when empty, the proxy
type lowercased, the tables serialised as upstream serialises them. `buildBody`
itself cannot be reused for this: it stops at the first invalid field, and an
emptied required field is exactly the kind of change the bar has to name.
`pending.test.ts` holds the two together: on random forms, what every field says
it sends is what `buildBody` puts in the body, for the three kinds of node.

A table that would not serialise (an empty cell, a `|`) has no body value; it is
compared by its cells instead, so it counts as changed exactly when its rows did.
*/

/** How the save writes one field, and whether it sends it at all. */
interface Field {
  pane: SubTab
  /** The block of `buildBody` that carries it: the node's own, or the cluster's. */
  scope: 'node' | 'cluster'
  /** The parameter as the save would write it. */
  sent: (f: SettingsForm) => string
  /** Sent only when this holds (the proxy's details). */
  when?: (f: SettingsForm) => boolean
  /** The body key, when it is not the field's name. */
  param?: string
}

type Key = Exclude<keyof SettingsForm, 'temporaryDisableBlockingMinutes'>

/* ── The ways `buildBody` writes a field ───────────────────────────────────── */

const asIs = (k: Key) => (f: SettingsForm) => f[k] as string
const flag = (k: Key) => (f: SettingsForm) => String(f[k])
/** A textarea list: cleaned, and `empty` when nothing is left. */
const list = (k: Key, empty = 'false') => (f: SettingsForm) => {
  const t = cleanList(f[k] as string)
  return t.length === 0 || t === ',' ? empty : t
}
const qpm = (k: 'qpmPrefixLimitsIPv4' | 'qpmPrefixLimitsIPv6') => (f: SettingsForm) =>
  tableParam(f[k].map((r: QpmRow) => [cell(r.prefix), cell(r.udpLimit), cell(r.tcpLimit)]))
const tsig = (f: SettingsForm) =>
  tableParam(f.tsigKeys.map((k: TsigRow) => [cell(k.keyName), cell(k.sharedSecret, true), cell(k.algorithmName)]))

function cell(value: string, optional = false): Cell {
  return { type: 'text', value, optional }
}

function tableParam(rows: Cell[][]): string {
  const r = serializeTable(rows)
  if (!r.ok) return `invalid:${JSON.stringify(rows)}`
  return r.value.length === 0 ? 'false' : r.value
}

const proxyChosen = (f: SettingsForm) => f.proxyType.toLowerCase() !== 'none'

function on(pane: SubTab, scope: Field['scope'], fields: Partial<Record<Key, Omit<Field, 'pane' | 'scope'>>>) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, { pane, scope, ...v }]),
  ) as Partial<Record<Key, Field>>
}

/*
Every field of the form but the minutes, in `buildBody`'s order. `pending.test.ts`
insists on all of them: a field added to `SettingsForm` and forgotten here fails it.
*/
export const FIELDS: Record<Key, Field> = {
  ...on('General', 'node', {
    dnsServerDomain: { sent: asIs('dnsServerDomain') },
    dnsServerLocalEndPoints: { sent: list('dnsServerLocalEndPoints', '0.0.0.0:53,[::]:53') },
    dnsServerIPv4SourceAddresses: { sent: list('dnsServerIPv4SourceAddresses') },
    dnsServerIPv6SourceAddresses: { sent: list('dnsServerIPv6SourceAddresses') },
  }),
  ...on('General', 'cluster', {
    defaultRecordTtl: { sent: asIs('defaultRecordTtl') },
    defaultNsRecordTtl: { sent: asIs('defaultNsRecordTtl') },
    defaultSoaRecordTtl: { sent: asIs('defaultSoaRecordTtl') },
    defaultResponsiblePerson: { sent: asIs('defaultResponsiblePerson') },
    useSoaSerialDateScheme: { sent: flag('useSoaSerialDateScheme') },
    minSoaRefresh: { sent: asIs('minSoaRefresh') },
    minSoaRetry: { sent: asIs('minSoaRetry') },
    zoneTransferAllowedNetworks: { sent: list('zoneTransferAllowedNetworks') },
    notifyAllowedNetworks: { sent: list('notifyAllowedNetworks') },
    dnsServerEnableCheckForUpdate: { sent: flag('dnsServerEnableCheckForUpdate') },
    dnsAppsEnableAutomaticUpdate: { sent: flag('dnsAppsEnableAutomaticUpdate') },
  }),
  ...on('General', 'node', {
    ipv6Mode: { sent: asIs('ipv6Mode') },
    enableUdpSocketPool: { sent: flag('enableUdpSocketPool') },
    socketPoolExcludedPorts: { sent: list('socketPoolExcludedPorts') },
  }),
  ...on('General', 'cluster', {
    udpPayloadSize: { sent: asIs('udpPayloadSize') },
    dnssecValidation: { sent: flag('dnssecValidation') },
    eDnsClientSubnet: { sent: flag('eDnsClientSubnet') },
    eDnsClientSubnetIPv4PrefixLength: { sent: asIs('eDnsClientSubnetIPv4PrefixLength') },
    eDnsClientSubnetIPv6PrefixLength: { sent: asIs('eDnsClientSubnetIPv6PrefixLength') },
    eDnsClientSubnetIpv4Override: { sent: asIs('eDnsClientSubnetIpv4Override') },
    eDnsClientSubnetIpv6Override: { sent: asIs('eDnsClientSubnetIpv6Override') },
    qpmPrefixLimitsIPv4: { sent: qpm('qpmPrefixLimitsIPv4') },
    qpmPrefixLimitsIPv6: { sent: qpm('qpmPrefixLimitsIPv6') },
    qpmLimitSampleMinutes: { sent: asIs('qpmLimitSampleMinutes') },
    qpmLimitUdpTruncationPercentage: { sent: asIs('qpmLimitUdpTruncationPercentage') },
    qpmLimitBypassList: { sent: list('qpmLimitBypassList') },
    clientTimeout: { sent: asIs('clientTimeout') },
    tcpSendTimeout: { sent: asIs('tcpSendTimeout') },
    tcpReceiveTimeout: { sent: asIs('tcpReceiveTimeout') },
    quicIdleTimeout: { sent: asIs('quicIdleTimeout') },
    quicMaxInboundStreams: { sent: asIs('quicMaxInboundStreams') },
    listenBacklog: { sent: asIs('listenBacklog') },
    udpSendBufferSizeKB: { sent: asIs('udpSendBufferSizeKB') },
    udpReceiveBufferSizeKB: { sent: asIs('udpReceiveBufferSizeKB') },
    maxConcurrentResolutionsPerCore: { sent: asIs('maxConcurrentResolutionsPerCore') },
  }),
  ...on('Web Service', 'node', {
    webServiceLocalAddresses: { sent: list('webServiceLocalAddresses', '0.0.0.0,[::]') },
    webServiceHttpPort: { sent: (f) => (f.webServiceHttpPort === '' ? '5380' : f.webServiceHttpPort) },
    webServiceEnableHttpUnixSocket: { sent: flag('webServiceEnableHttpUnixSocket') },
    webServiceHttpUnixSocket: { sent: asIs('webServiceHttpUnixSocket') },
    webServiceEnableTlsUnixSocket: { sent: flag('webServiceEnableTlsUnixSocket') },
    webServiceTlsUnixSocket: { sent: asIs('webServiceTlsUnixSocket') },
    webServiceEnableTls: { sent: flag('webServiceEnableTls') },
    webServiceEnableHttp3: { sent: flag('webServiceEnableHttp3') },
    webServiceHttpToTlsRedirect: { sent: flag('webServiceHttpToTlsRedirect') },
    webServiceUseSelfSignedTlsCertificate: { sent: flag('webServiceUseSelfSignedTlsCertificate') },
    webServiceTlsPort: { sent: asIs('webServiceTlsPort') },
    webServiceReverseProxyAddresses: { sent: list('webServiceReverseProxyAddresses') },
    webServiceRealIpHeader: { sent: asIs('webServiceRealIpHeader') },
    webServiceCspFrameAncestorsHeader: { sent: asIs('webServiceCspFrameAncestorsHeader') },
    webServiceTlsCertificatePath: { sent: asIs('webServiceTlsCertificatePath') },
    webServiceTlsCertificatePassword: { sent: asIs('webServiceTlsCertificatePassword') },
  }),
  ...on('Optional Protocols', 'node', {
    enableEDnsClientSubnetSourceAddress: { sent: flag('enableEDnsClientSubnetSourceAddress') },
    enableDnsOverUdpProxy: { sent: flag('enableDnsOverUdpProxy') },
    enableDnsOverTcpProxy: { sent: flag('enableDnsOverTcpProxy') },
    enableDnsOverHttp: { sent: flag('enableDnsOverHttp') },
    enableDnsOverHttpUnixSocket: { sent: flag('enableDnsOverHttpUnixSocket') },
    enableDnsOverHttpsUnixSocket: { sent: flag('enableDnsOverHttpsUnixSocket') },
    enableDnsOverTls: { sent: flag('enableDnsOverTls') },
    enableDnsOverHttps: { sent: flag('enableDnsOverHttps') },
    enableDnsOverHttp3: { sent: flag('enableDnsOverHttp3') },
    enableDnsOverQuic: { sent: flag('enableDnsOverQuic') },
    enableDnsOverHttpHelpRedirect: { sent: flag('enableDnsOverHttpHelpRedirect') },
    dnsOverUdpProxyPort: { sent: asIs('dnsOverUdpProxyPort') },
    dnsOverTcpProxyPort: { sent: asIs('dnsOverTcpProxyPort') },
    dnsOverHttpPort: { sent: asIs('dnsOverHttpPort') },
    dnsOverHttpUnixSocket: { sent: asIs('dnsOverHttpUnixSocket') },
    dnsOverHttpsUnixSocket: { sent: asIs('dnsOverHttpsUnixSocket') },
    dnsOverTlsPort: { sent: asIs('dnsOverTlsPort') },
    dnsOverHttpsPort: { sent: asIs('dnsOverHttpsPort') },
    dnsOverQuicPort: { sent: asIs('dnsOverQuicPort') },
    dnsReverseProxyNetworkACL: { sent: list('dnsReverseProxyNetworkACL') },
    dnsOverHttpRealIpHeader: { sent: asIs('dnsOverHttpRealIpHeader') },
    dnsTlsCertificatePath: { sent: asIs('dnsTlsCertificatePath') },
    dnsTlsCertificatePassword: { sent: asIs('dnsTlsCertificatePassword') },
  }),
  ...on('TSIG', 'cluster', {
    tsigKeys: { sent: tsig },
  }),
  ...on('Recursion', 'cluster', {
    recursion: { sent: asIs('recursion') },
    recursionNetworkACL: { sent: list('recursionNetworkACL') },
    randomizeName: { sent: flag('randomizeName') },
    qnameMinimization: { sent: flag('qnameMinimization') },
    locallyServedDnsZones: { sent: flag('locallyServedDnsZones') },
    resolverRetries: { sent: asIs('resolverRetries') },
    resolverTimeout: { sent: asIs('resolverTimeout') },
    resolverConcurrency: { sent: asIs('resolverConcurrency') },
    resolverMaxStackCount: { sent: asIs('resolverMaxStackCount') },
  }),
  ...on('Cache', 'node', {
    saveCache: { sent: flag('saveCache') },
    serveStale: { sent: flag('serveStale') },
    serveStaleTtl: { sent: asIs('serveStaleTtl') },
    serveStaleAnswerTtl: { sent: asIs('serveStaleAnswerTtl') },
    serveStaleResetTtl: { sent: asIs('serveStaleResetTtl') },
    serveStaleMaxWaitTime: { sent: asIs('serveStaleMaxWaitTime') },
    cacheMaximumEntries: { sent: asIs('cacheMaximumEntries') },
    cacheMinimumRecordTtl: { sent: asIs('cacheMinimumRecordTtl') },
    cacheMaximumRecordTtl: { sent: asIs('cacheMaximumRecordTtl') },
    cacheNegativeRecordTtl: { sent: asIs('cacheNegativeRecordTtl') },
    cacheFailureRecordTtl: { sent: asIs('cacheFailureRecordTtl') },
    enableCachePrefetch: { sent: flag('enableCachePrefetch') },
    cachePrefetchEligibility: { sent: asIs('cachePrefetchEligibility') },
    cachePrefetchTrigger: { sent: asIs('cachePrefetchTrigger') },
  }),
  ...on('Blocking', 'cluster', {
    enableBlocking: { sent: flag('enableBlocking') },
    allowTxtBlockingReport: { sent: flag('allowTxtBlockingReport') },
    blockingBypassList: { sent: list('blockingBypassList') },
    blockingType: { sent: asIs('blockingType') },
    customBlockingAddresses: { sent: list('customBlockingAddresses') },
    blockingAnswerTtl: { sent: asIs('blockingAnswerTtl') },
    blockListUrls: { sent: list('blockListUrls') },
    blockListUpdateIntervalHours: { sent: asIs('blockListUpdateIntervalHours') },
  }),
  ...on('Proxy & Forwarders', 'cluster', {
    proxyType: { sent: (f) => f.proxyType.toLowerCase() },
    proxyAddress: { sent: asIs('proxyAddress'), when: proxyChosen },
    proxyPort: { sent: asIs('proxyPort'), when: proxyChosen },
    proxyUsername: { sent: asIs('proxyUsername'), when: proxyChosen },
    proxyPassword: { sent: asIs('proxyPassword'), when: proxyChosen },
    // main.js:2137. Empty is an empty string here, not "false".
    proxyBypassList: { sent: list('proxyBypassList', ''), when: proxyChosen, param: 'proxyBypass' },
    forwarders: { sent: list('forwarders') },
    forwarderProtocol: { sent: asIs('forwarderProtocol') },
    concurrentForwarding: { sent: flag('concurrentForwarding') },
    forwarderRetries: { sent: asIs('forwarderRetries') },
    forwarderTimeout: { sent: asIs('forwarderTimeout') },
    forwarderConcurrency: { sent: asIs('forwarderConcurrency') },
  }),
  ...on('Logging', 'node', {
    loggingType: { sent: asIs('loggingType') },
    ignoreResolverLogs: { sent: flag('ignoreResolverLogs') },
    noStackTrace: { sent: flag('noStackTrace') },
    logQueries: { sent: flag('logQueries') },
    useLocalTime: { sent: flag('useLocalTime') },
    logFolder: { sent: asIs('logFolder') },
    maxLogFileDays: { sent: asIs('maxLogFileDays') },
    enableInMemoryStats: { sent: flag('enableInMemoryStats') },
    maxStatFileDays: { sent: asIs('maxStatFileDays') },
  }),
} as Record<Key, Field>

/** Whether a save with this form, to this node, would send the field. */
export function sends(field: Field, f: SettingsForm, node: string): boolean {
  return nodeScope(node)[field.scope] && (field.when == null || field.when(f))
}

/** The panes with something a save would change, in their tab order, and how many fields each. */
export function pendingByPane(
  saved: SettingsForm,
  form: SettingsForm,
  node: string,
  panes: readonly SubTab[],
): { pane: SubTab; fields: number }[] {
  const count = new Map<SubTab, number>()
  for (const field of Object.values(FIELDS)) {
    if (!sends(field, form, node)) continue
    if (field.sent(form) === field.sent(saved)) continue
    count.set(field.pane, (count.get(field.pane) ?? 0) + 1)
  }
  return panes.filter((p) => count.has(p)).map((pane) => ({ pane, fields: count.get(pane)! }))
}

/** The bar's words: `General (2), Cache (1)`. Empty when nothing is pending. */
export function pendingText(pending: readonly { pane: SubTab; fields: number }[]): string {
  return pending.map((p) => `${p.pane} (${p.fields})`).join(', ')
}
