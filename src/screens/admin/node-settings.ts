import type { DnsSettings, QpmPrefixLimit } from '../../api/settings'
import { minuteStamp } from './dates'

/*
SETTINGS ACROSS NODES (deviation 31 in CONVENTIONS.md, 2026-11-06): what the
Cluster card compares, worked out from one `settings/get` per node and nothing
else. A cluster syncs its zones and most of its configuration from the primary,
but a node keeps its own local settings (its domain, its end points) and a
secondary that has not synced yet may hold old ones; this says which of a curated
set agree.

  · A row is a setting, read from the answer as the Settings form shows it: the
    field's label (upstream's), the value written with the option's label or the
    form's unit. A list is one entry per line, `None` when empty.
  · A row is COMPARED unless the value is the node's own by nature: its domain and
    when it started differ on every healthy cluster, so they are shown and never
    counted.
  · A compared row DIFFERS when the nodes that answered do not all write it the
    same. A node that did not answer takes no part: it is not a difference, it is
    a missing column, said once with the server's message.
  · Differing rows go first, each group's order kept inside both halves.

Its words, all OURS: the group labels `Identity`, `Resolution`, `Rate Limiting`,
`Zone Defaults`, `Blocking`, `Forwarders` and `Logging`; `Up Since` (the Cluster
table's header); `Enabled`, `Disabled`, `None`; the units `seconds`, `minutes`,
`bytes`, `UDP`, `TCP`. The setting labels and the option labels are upstream's,
from the Settings panes, with their `(default)` and `(recommended)` left out.
*/

export interface SettingRow {
  key: string
  group: string
  label: string
  /** False for a value that is each node's own (its domain, its start). */
  compared: boolean
  read: (s: DnsSettings) => string
}

const onOff = (v: boolean | undefined) => (v === true ? 'Enabled' : 'Disabled')
const lines = (list: readonly string[] | null | undefined) =>
  list == null || list.length === 0 ? 'None' : list.join('\n')
const unit = (n: number | undefined, word: string) => (n == null ? '' : `${n} ${word}`)
const labelled = (labels: Record<string, string>) => (v: string | undefined) => (v == null ? '' : (labels[v] ?? v))
const qpm = (limits: QpmPrefixLimit[] | null | undefined) =>
  lines((limits ?? []).map((l) => `/${l.prefix}: ${l.udpLimit} UDP, ${l.tcpLimit} TCP`))

/* The option labels of the Settings panes (Recursion, General, Blocking,
   ProxyForwarders, Logging). */
const RECURSION = labelled({
  Deny: 'Deny Recursion',
  Allow: 'Allow Recursion',
  AllowOnlyForPrivateNetworks: 'Allow Recursion Only For Private Networks',
  UseSpecifiedNetworkACL: 'Use Specified Network Access Control List (ACL)',
})
const IPV6 = labelled({ Disabled: 'Disable IPv6', Enabled: 'Enable IPv6', Preferred: 'Prefer IPv6' })
const BLOCKING_TYPE = labelled({ AnyAddress: 'ANY Address', NxDomain: 'NX Domain', CustomAddress: 'Custom Address' })
const PROTOCOL = labelled({
  Udp: 'DNS-over-UDP',
  Tcp: 'DNS-over-TCP',
  Tls: 'DNS-over-TLS',
  Https: 'DNS-over-HTTPS',
  Quic: 'DNS-over-QUIC',
})
const LOGGING = labelled({ None: 'None', File: 'File', Console: 'Console', FileAndConsole: 'Both File And Console' })

export const SETTING_ROWS: SettingRow[] = [
  { key: 'domain', group: 'Identity', label: 'DNS Server Domain', compared: false, read: (s) => s.dnsServerDomain ?? '' },
  { key: 'version', group: 'Identity', label: 'Version', compared: true, read: (s) => s.version ?? '' },
  { key: 'upSince', group: 'Identity', label: 'Up Since', compared: false, read: (s) => minuteStamp(s.uptimestamp) },

  { key: 'endPoints', group: 'Resolution', label: 'DNS Server Local End Points', compared: false, read: (s) => lines(s.dnsServerLocalEndPoints) },
  { key: 'recursion', group: 'Resolution', label: 'Recursion', compared: true, read: (s) => RECURSION(s.recursion) },
  { key: 'dnssec', group: 'Resolution', label: 'DNSSEC Validation', compared: true, read: (s) => onOff(s.dnssecValidation) },
  { key: 'ipv6', group: 'Resolution', label: 'IPv6 Support', compared: true, read: (s) => IPV6(s.ipv6Mode) },
  { key: 'ecs', group: 'Resolution', label: 'EDNS Client Subnet (ECS)', compared: true, read: (s) => onOff(s.eDnsClientSubnet) },
  { key: 'udpPayload', group: 'Resolution', label: 'EDNS UDP Payload Size', compared: true, read: (s) => unit(s.udpPayloadSize, 'bytes') },

  { key: 'qpmSample', group: 'Rate Limiting', label: 'QPM Sample Size', compared: true, read: (s) => unit(s.qpmLimitSampleMinutes, 'minutes') },
  { key: 'qpm4', group: 'Rate Limiting', label: 'Queries Per Minute (QPM) Limits (IPv4)', compared: true, read: (s) => qpm(s.qpmPrefixLimitsIPv4) },
  { key: 'qpm6', group: 'Rate Limiting', label: 'Queries Per Minute (QPM) Limits (IPv6)', compared: true, read: (s) => qpm(s.qpmPrefixLimitsIPv6) },

  { key: 'recordTtl', group: 'Zone Defaults', label: 'Default Record TTL', compared: true, read: (s) => unit(s.defaultRecordTtl, 'seconds') },
  { key: 'nsTtl', group: 'Zone Defaults', label: 'Default NS Record TTL', compared: true, read: (s) => unit(s.defaultNsRecordTtl, 'seconds') },
  { key: 'soaTtl', group: 'Zone Defaults', label: 'Default SOA Record TTL', compared: true, read: (s) => unit(s.defaultSoaRecordTtl, 'seconds') },

  { key: 'blocking', group: 'Blocking', label: 'Enable Blocking', compared: true, read: (s) => onOff(s.enableBlocking) },
  { key: 'blockingType', group: 'Blocking', label: 'Blocking Type', compared: true, read: (s) => BLOCKING_TYPE(s.blockingType) },

  { key: 'forwarders', group: 'Forwarders', label: 'Forwarders', compared: true, read: (s) => lines(s.forwarders) },
  { key: 'protocol', group: 'Forwarders', label: 'Forwarder Protocol', compared: true, read: (s) => PROTOCOL(s.forwarderProtocol) },

  { key: 'logging', group: 'Logging', label: 'Enable Logging To', compared: true, read: (s) => LOGGING(s.loggingType) },
]

/** One node's answer to `settings/get`. */
export type NodeAnswer =
  | { node: string; kind: 'ok'; settings: DnsSettings }
  | { node: string; kind: 'failed'; message: string }

export interface ComparedRow {
  key: string
  group: string
  label: string
  compared: boolean
  /** One per node, in the nodes' order; `null` for a node that did not answer. */
  values: (string | null)[]
  differs: boolean
}

export interface Comparison {
  /** Differing rows first, each half in `SETTING_ROWS` order. */
  rows: ComparedRow[]
  differing: number
  /** How many nodes answered. */
  answered: number
}

export function compareSettings(answers: NodeAnswer[], rows: SettingRow[] = SETTING_ROWS): Comparison {
  const answered = answers.filter((a) => a.kind === 'ok').length
  const all = rows.map((r): ComparedRow => {
    const values = answers.map((a) => (a.kind === 'ok' ? r.read(a.settings) : null))
    const seen = new Set(values.filter((v): v is string => v != null))
    return { key: r.key, group: r.group, label: r.label, compared: r.compared, values, differs: r.compared && seen.size > 1 }
  })
  const differing = all.filter((r) => r.differs)
  return { rows: [...differing, ...all.filter((r) => !r.differs)], differing: differing.length, answered }
}

/** The line over the table. */
export function summary(c: Comparison): string {
  if (c.answered === 0) return 'No node answered'
  if (c.answered === 1) return 'Only one node answered'
  if (c.differing === 0) return 'Every setting matches'
  return c.differing === 1 ? '1 setting differs' : `${c.differing} settings differ`
}
