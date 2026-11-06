/*
WHAT A DNS RESPONSE SAYS, read from `dnsClient/resolve` (deviation 18 in
CONVENTIONS.md). `response.result` is a whole `DnsDatagram` serialised by the
server (WebServiceApi.cs:438-439, `DnsDatagram.SerializeTo`), the same JSON
upstream prints in its "Response" panel. Everything here is read from that object
and nothing is computed that the datagram does not carry: the cards and the
tables only lay out its fields.

Every key is optional on purpose. Measured against v15.6.1 on 2026-11-06, an
answer carries `Metadata`, `EDNS` (when the response has an OPT record),
`DnsClientExtendedErrors` (only when the client library added some), the header
fields, and the four sections; but a zone transfer is a JOINED datagram
(`dnsResponse.Join()`, WebServiceApi.cs:271) and the library is not this
repository, so a missing key reads as missing, never as zero or false.
*/

import type { TagTone } from '../../ui/Tag'

/*
`domain` with a URL pasted in loses the scheme and whatever follows the host
(dnsclient.js:132-146): `https://example.com:8443/x` becomes `example.com`. The field
is rewritten with it, and that is what travels.
*/
export function stripUrl(domain: string): string {
  const i = domain.indexOf('://')
  if (i < 0) return domain
  let j = domain.indexOf(':', i + 3)
  if (j < 0) j = domain.indexOf('/', i + 3)
  return j > -1 ? domain.substring(i + 3, j) : domain.substring(i + 3)
}

/** A DNSSEC status as a state: `Secure` is the good one, `Bogus` the broken one. */
export function dnssecTone(status: string): TagTone {
  return status === 'Secure' ? 'ok' : status === 'Bogus' ? 'dan' : 'neutral'
}

export interface DnsRecord {
  Name?: string
  Type?: string
  Class?: string
  /** Already composed by the server: `"264 (4m24s)"`. */
  TTL?: string
  RDLENGTH?: string
  RDATA?: Record<string, unknown>
  DnssecStatus?: string
}

export interface ExtendedError {
  InfoCode?: string
  ExtraText?: string
}

export interface Datagram {
  Metadata?: { NameServer?: string; Protocol?: string; DatagramSize?: string; RoundTripTime?: string }
  EDNS?: {
    UdpPayloadSize?: number
    ExtendedRCODE?: string
    Version?: number
    Flags?: string
    Options?: { Code?: string; Length?: string; Data?: unknown }[]
  }
  DnsClientExtendedErrors?: ExtendedError[]
  Identifier?: number
  OPCODE?: string
  AuthoritativeAnswer?: boolean
  Truncation?: boolean
  RecursionDesired?: boolean
  RecursionAvailable?: boolean
  AuthenticData?: boolean
  CheckingDisabled?: boolean
  RCODE?: string
  Question?: { Name?: string; Type?: string; Class?: string }[]
  Answer?: DnsRecord[]
  Authority?: DnsRecord[]
  Additional?: DnsRecord[]
}

/** The object the server sent, as a datagram, or null if it is not one. */
export function asDatagram(result: unknown): Datagram | null {
  return result != null && typeof result === 'object' && !Array.isArray(result) ? (result as Datagram) : null
}

/*
The response code's colour: the Dashboard's own series for the four codes it
charts (`--ch-ok`, `--ch-nx`, `--ch-fail`, `--ch-refuse`), so NxDomain is the same
green-yellow here as in its Query Response chart. Any other code (FormatError,
NotImplemented, YXDomain…) takes the neutral series. The code is always written
beside it.
*/
const RCODE: Record<string, string> = {
  NoError: '--ch-ok',
  NxDomain: '--ch-nx',
  ServerFailure: '--ch-fail',
  Refused: '--ch-refuse',
}

export function rcodeColour(rcode: string | undefined): string {
  return `var(${(rcode != null && RCODE[rcode]) || '--ch-drop'})`
}

/*
The six header bits, by the abbreviation every DNS tool prints (dig's `flags:`
line) and, in the tooltip, the datagram's own key split into its words. That key
is the server's text; only the spaces are ours.
*/
export const FLAGS = [
  { key: 'AuthoritativeAnswer', short: 'AA', name: 'Authoritative Answer' },
  { key: 'Truncation', short: 'TC', name: 'Truncation' },
  { key: 'RecursionDesired', short: 'RD', name: 'Recursion Desired' },
  { key: 'RecursionAvailable', short: 'RA', name: 'Recursion Available' },
  { key: 'AuthenticData', short: 'AD', name: 'Authentic Data' },
  { key: 'CheckingDisabled', short: 'CD', name: 'Checking Disabled' },
] as const satisfies readonly { key: keyof Datagram; short: string; name: string }[]

/** How many records of each type, in the order they first appear. */
export function countByType(records: DnsRecord[]): [string, number][] {
  const by = new Map<string, number>()
  for (const r of records) {
    const t = r.Type ?? ''
    by.set(t, (by.get(t) ?? 0) + 1)
  }
  return [...by.entries()]
}

/** How many records carry each DNSSEC status, in the order they first appear. */
export function countByStatus(records: DnsRecord[]): [string, number][] {
  const by = new Map<string, number>()
  for (const r of records) {
    if (r.DnssecStatus == null) continue
    by.set(r.DnssecStatus, (by.get(r.DnssecStatus) ?? 0) + 1)
  }
  return [...by.entries()]
}

/*
The Extended DNS Errors of an answer (RFC 8914), from the two places the JSON
holds them: the EDNS options the server sent (`EXTENDED_DNS_ERROR`) and the ones
the client library added on its own (`DnsClientExtendedErrors`), each tagged with
where it came from. Upstream shows both only inside the JSON.
*/
export interface ExtendedErrorRow {
  source: 'EDNS' | 'DNS Client'
  infoCode: string
  extraText: string
}

export function extendedErrors(d: Datagram): ExtendedErrorRow[] {
  const rows: ExtendedErrorRow[] = []
  for (const o of d.EDNS?.Options ?? []) {
    if (o.Code !== 'EXTENDED_DNS_ERROR') continue
    const data = (o.Data ?? {}) as ExtendedError
    rows.push({ source: 'EDNS', infoCode: String(data.InfoCode ?? ''), extraText: String(data.ExtraText ?? '') })
  }
  for (const e of d.DnsClientExtendedErrors ?? []) {
    rows.push({ source: 'DNS Client', infoCode: String(e.InfoCode ?? ''), extraText: String(e.ExtraText ?? '') })
  }
  return rows
}

/*
A record's RDATA as the pairs the server wrote, in its order and with its key
names. One key alone is the value alone (an A's `IPAddress`, a CNAME's `Domain`):
its name says nothing the record type does not. A TXT's `CharacterStrings` is left
out when it only repeats `Text` as one string, which is what a single-string TXT
always sends. Arrays are joined with commas, objects written as JSON. Nothing is
lost: the JSON tab is the whole datagram.
*/
export function rdataPairs(rdata: Record<string, unknown> | undefined): [string, string][] {
  if (rdata == null) return []
  const pairs: [string, string][] = []
  for (const [k, v] of Object.entries(rdata)) {
    if (
      k === 'CharacterStrings' &&
      Array.isArray(v) &&
      v.length === 1 &&
      v[0] === rdata.Text
    )
      continue
    pairs.push([k, show(v)])
  }
  return pairs
}

function show(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x != null ? JSON.stringify(x) : String(x))).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** The owner name as DNS writes it: the root, which the JSON sends as `""`, is `.`. */
export function ownerName(name: string | undefined): string {
  return name == null || name === '' ? '.' : name
}
