import type { DnsRecord } from '../../api/zonelists'
import { splitTtl } from './record'

/*
WHAT A CACHE NODE HOLDS (deviation 16 in CONVENTIONS.md, 2026-11-06), counted
from the records of the `cache/list` answer already on screen. Nothing here asks
the server anything: every figure is a count or a pick over `records`, so the
cards change exactly when the table under them does.

Four facts the server writes and that these functions read, checked against
v15.6.1 on 2026-11-06:

  · A cache record's `ttl` is the string `"<seconds> (<human>)"`, the time LEFT,
    and a record past its TTL that the server still keeps for Serve Stale is
    written `"0 (0s)"` (`record.IsStale`, WebServiceZonesApi.cs:120-125).
  · A cached negative answer is a record whose `rData` is the server's special
    cache record: `dataType: "DnsSpecialCacheRecordData"`, and a `data` that
    starts with its kind, `NegativeCache: NxDomain; …` or `NegativeCache:
    NoError; …` (no such name, or no record of that type).
  · `dnssecStatus` is the record's validation state, one of the server's words
    (`Secure`, `Insecure`, `Bogus`, `Indeterminate`, `Unknown`, `Disabled`).
  · `responseMetadata.nameServer` is the server that gave the answer: a forwarder
    or an authoritative name server, as the table's grey line writes it after
    `via`. It can be `null`.
*/

/** The server's literal for a record kept past its TTL. */
export const STALE_TTL = '0 (0s)'

export function isStale(r: DnsRecord): boolean {
  return r.ttl === STALE_TTL
}

/** A cached negative answer (the server's special cache record). */
export function isNegative(r: DnsRecord): boolean {
  const d = r.rData ?? {}
  return d.dataType === 'DnsSpecialCacheRecordData' && typeof d.data === 'string' && d.data.startsWith('NegativeCache:')
}

/** How many of each value, in the order the server first writes each one. */
function tally(values: string[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
}

/** The node's records by type, in the server's order (it groups them by type). */
export function byType(records: DnsRecord[]): [string, number][] {
  return tally(records.map((r) => r.type))
}

/** The records by DNSSEC state; a record with none is not counted. */
export function byDnssec(records: DnsRecord[]): [string, number][] {
  return tally(records.flatMap((r) => (r.dnssecStatus != null ? [r.dnssecStatus] : [])))
}

/** Who answered: each server and how many of the node's records it gave, most first. */
export function byServer(records: DnsRecord[]): [string, number][] {
  const servers = records.flatMap((r) => (r.responseMetadata != null ? [r.responseMetadata.nameServer ?? '—'] : []))
  return tally(servers).sort((a, b) => b[1] - a[1])
}

export interface TtlLeft {
  /** The record that leaves the cache first, and its time left as the server wrote it. */
  next: { record: DnsRecord; human: string }
  /** The longest time left on any record of the node. */
  longest: string
}

/*
The time left on the node's records: the first to leave the cache and the longest
to stay. Stale records are out of it (their time ran out already), and so is any
TTL that does not read as a number, rather than being guessed. `null` when no
record has time left.
*/
export function ttlLeft(records: DnsRecord[]): TtlLeft | null {
  let next: { record: DnsRecord; seconds: number; human: string } | null = null
  let longest: { seconds: number; human: string } | null = null
  for (const r of records) {
    if (isStale(r)) continue
    const t = splitTtl(r)
    const seconds = Number(t.value)
    if (!Number.isFinite(seconds) || seconds <= 0 || t.value.trim() === '') continue
    const human = t.human !== '' ? t.human : t.value
    if (next == null || seconds < next.seconds) next = { record: r, seconds, human }
    if (longest == null || seconds > longest.seconds) longest = { seconds, human }
  }
  if (next == null || longest == null) return null
  return { next: { record: next.record, human: next.human }, longest: longest.human }
}

/*
A DNSSEC state's colour. The states that judge a record take the console's state
colours (the Zones Health card's precedent): `Secure` the ok green, `Bogus` the
error red, `Indeterminate` the warning amber. The ones that do not (`Insecure`,
`Disabled`) take the neutral series, and `Unknown`, which is what a negative
answer carries, a series of its own so it does not read as `Insecure`.
*/
const DNSSEC: Record<string, string> = {
  Secure: 'var(--ok)',
  Bogus: 'var(--dan)',
  Indeterminate: 'var(--warn)',
  Unknown: 'var(--ch-3)',
}

export function dnssecColour(status: string): string {
  return DNSSEC[status] ?? 'var(--ch-drop)'
}

/** The tag tone a DNSSEC state takes in the table, by the same rule as its colour. */
export function dnssecTone(status: string | undefined): 'ok' | 'dan' | 'warn' | 'neutral' {
  switch (status) {
    case 'Secure':
      return 'ok'
    case 'Bogus':
      return 'dan'
    case 'Indeterminate':
      return 'warn'
    default:
      return 'neutral'
  }
}
