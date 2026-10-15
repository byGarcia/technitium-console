import type { ApiOutcome } from '../../api/client'
import { readRuleExport } from '../../api/blocking'
import { resolve } from '../../api/dnsclient'
import { readSettings } from '../../api/settings'
import type { QuickEntry } from '../../lib/quick-lists'
import { listName } from './list-lines'

/*
"Check a domain": whether this server blocks a name, and why. This module and every
sentence the verdict draws are OURS (upstream has no such check); the server's own
words appear only where they are quoted (an unknown blocking reason, its labels
`Allow TXT Blocking Report` and `Blocking Bypass List`).

HOW THE SERVER SAYS IT. The check is the DNS Client's own call, `dnsClient/resolve`
against `this-server` (dnsclient.js:166), type A over UDP, no DNSSEC validation and
no import. A query this server blocks comes back carrying an Extended DNS Error with
`InfoCode: "Blocked"` and the reason in `ExtraText`, in `result.EDNS.Options` (and
again in the OPT record of `Additional`). Its grammar is the server's, read from
v15.6.1 and measured against a live v15.6.1 on 2026-10-15
(`check-domain.real.json`):

  source=blocked-zone; domain=<rule>                                (DnsServer.cs:4672)
  source=block-list-zone; blockListUrl=<url>; domain=<entry>        (BlockListZoneManager.cs:893)

One option per list that carries the name, in the lists' order. `domain` is the
entry that matched, which is a PARENT of the name asked when a rule or a list
blocks a whole zone (`sub.telemetry.example-iot.net` comes back with
`domain=telemetry.example-iot.net`). The same text is written for every blocking
type (NX Domain, Any Address, Custom Address): only the answer around it changes.

WHAT THE ANSWER CANNOT SAY, and how each gap is handled:

- The report is written ONLY with `allowTxtBlockingReport` on (on by default;
  DnsServer.cs:4669, BlockListZoneManager.cs:888). With it off a blocked answer
  carries nothing, so a clean answer proves nothing: the verdict is "cannot tell"
  and names the setting.
- Nothing marks an answer as ALLOWED. An allow rule wins before any blocking is
  looked at (`IsAllowedAsync`, DnsServer.cs:4577-4605), so the verdict reads the
  rules themselves (`allowed/export`): the name or one of its parents on the list.
  Like a blocked rule, an allowed one covers its subdomains (the same zone tree,
  AllowedZoneManager.cs:291-297).
- With blocking disabled or paused nothing is blocked and no rule applies.
- The `Blocking Bypass List` is matched against the CLIENT address, and the check's
  client is this server talking to itself: the address in `Metadata.NameServer`
  (127.0.0.1 when it listens on every address, DnsServer.cs:6220-6238). If the list
  covers it, the check is never blocked and says so.
- Allow lists inside the block list URLs (`!url`) and DNS apps that block without
  reporting leave no trace: such a name reads as not blocked. An app that does
  report with `InfoCode: "Blocked"` is drawn with its own text.

The settings and the allow rules need permissions the check itself does not
(`Settings: View`, `Allowed: View`). Without them the verdicts that depend on them
cannot be reached, and a "Not blocked" says which reads were missing.
*/

export type BlockReason =
  | { source: 'rule'; domain: string }
  | { source: 'list'; url: string; domain: string }
  | { source: 'other'; text: string }

export interface Answer {
  /** The name the server asked, as it wrote it in `Question` (IDN, if it gave one). */
  name: string
  /** The same name in ASCII, lower case: what rules are compared with. */
  ascii: string
  reasons: BlockReason[]
  /** The address the server queried itself on: the check's client address. */
  clientIp: string | null
}

/** A read the verdict needed and did not have: its permission, or a failure. */
export type Missing = { need: string } | { failed: true }

export interface BlockingSettings {
  enableBlocking?: boolean
  temporaryDisableBlockingTill?: string | null
  allowTxtBlockingReport?: boolean
  blockingBypassList?: string[] | null
}

export interface CheckInputs {
  answer: Answer
  settings: BlockingSettings | Missing
  /** The allow rules, one domain per line, as `allowed/export` sends them. */
  allowed: string[] | Missing
}

export type Verdict =
  | { kind: 'lists'; name: string; domain: string; lists: string[] }
  | { kind: 'rule'; name: string; domain: string }
  | { kind: 'other'; name: string; texts: string[] }
  | { kind: 'allowed'; name: string; domain: string }
  | { kind: 'off'; name: string; paused: boolean }
  | { kind: 'bypassed'; name: string; ip: string }
  | { kind: 'unreported'; name: string }
  | { kind: 'clear'; name: string; unread: { settings?: Missing; allowed?: Missing } }

function record(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** The `Data` of every option, from `EDNS.Options`, or from the OPT record when an
    answer has no `EDNS` summary. */
function ednsData(result: Record<string, unknown>): Record<string, unknown>[] {
  let options = record(result.EDNS)?.Options
  if (!Array.isArray(options)) {
    const additional = Array.isArray(result.Additional) ? result.Additional : []
    const opt = additional.map(record).find((r) => r?.Type === 'OPT')
    options = record(opt?.RDATA)?.Options
  }
  if (!Array.isArray(options)) return []
  return options
    .map((o) => record(record(o)?.Data))
    .filter((d): d is Record<string, unknown> => d != null)
}

const LIST_TEXT = /^source=block-list-zone; blockListUrl=(.*); domain=([^;]*)$/
const RULE_TEXT = /^source=blocked-zone; domain=([^;]*)$/

export function parseReason(text: string): BlockReason {
  const list = LIST_TEXT.exec(text)
  if (list != null) return { source: 'list', url: list[1], domain: list[2] }
  const rule = RULE_TEXT.exec(text)
  if (rule != null) return { source: 'rule', domain: rule[1] }
  return { source: 'other', text }
}

/** `ns1.example.net (127.0.0.1)`, `([::1]:53)`, `(10.0.0.5:5353)`: the address alone. */
export function addressOf(nameServer: string | null): string | null {
  if (nameServer == null) return null
  const m = /\(([^()]*)\)\s*$/.exec(nameServer)
  let a = (m != null ? m[1] : nameServer).trim()
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(a)
  if (bracket != null) a = bracket[1]
  else if (/^[\d.]+:\d+$/.test(a)) a = a.slice(0, a.lastIndexOf(':'))
  return a === '' ? null : a
}

/** The `result` of `dnsClient/resolve`, read without trusting its shape. */
export function parseAnswer(result: unknown): Answer {
  const r = record(result) ?? {}
  const q = record(Array.isArray(r.Question) ? r.Question[0] : null)
  const ascii = (str(q?.Name) ?? '').toLowerCase()
  const name = str(q?.NameIDN) ?? str(q?.Name) ?? ''
  const reasons = ednsData(r)
    .filter((d) => d.InfoCode === 'Blocked')
    .map((d) => parseReason(str(d.ExtraText) ?? ''))
  return {
    name: name === '' ? '.' : name,
    ascii,
    reasons,
    clientIp: addressOf(str(record(r.Metadata)?.NameServer)),
  }
}

/* ── Addresses, for the Blocking Bypass List ─────────────────────────────────── */

function ipv4(text: string): bigint | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  let n = 0n
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null
    n = (n << 8n) | BigInt(Number(p))
  }
  return n
}

function ipv6(text: string): bigint | null {
  let t = text.split('%')[0]
  /* A dotted tail (`::ffff:1.2.3.4`) is two groups. */
  const tail = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(t)
  if (tail != null) {
    const v4 = ipv4(tail[2])
    if (v4 == null) return null
    t = `${tail[1]}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`
  }
  const halves = t.split('::')
  if (halves.length > 2) return null
  const head = halves[0] === '' ? [] : halves[0].split(':')
  const rest = halves.length === 2 ? (halves[1] === '' ? [] : halves[1].split(':')) : []
  const fill = 8 - head.length - rest.length
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill('0'), ...rest]
  let n = 0n
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
    n = (n << 16n) | BigInt(parseInt(g, 16))
  }
  return n
}

function parseIp(text: string): { v: 4 | 6; n: bigint } | null {
  const a = ipv4(text)
  if (a != null) return { v: 4, n: a }
  const b = text.includes(':') ? ipv6(text) : null
  return b != null ? { v: 6, n: b } : null
}

/** Whether `ip` is in `network`, written as the server takes it: an address, or an
    address with a prefix length (`NetworkAddress.Parse`). */
export function networkContains(network: string, ip: string): boolean {
  const [base, prefixText] = network.trim().split('/')
  const net = parseIp(base)
  const addr = parseIp(ip)
  if (net == null || addr == null || net.v !== addr.v) return false
  const bits = net.v === 4 ? 32 : 128
  const prefix = prefixText == null ? bits : Number(prefixText)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false
  const shift = BigInt(bits - prefix)
  return net.n >> shift === addr.n >> shift
}

/* ── The verdict ─────────────────────────────────────────────────────────────── */

function isMissing(v: unknown): v is Missing {
  const r = record(v)
  return r != null && ('need' in r || 'failed' in r)
}

/** The most specific allow rule that covers `ascii`: the name itself or a parent. */
export function allowRuleFor(ascii: string, rules: readonly string[]): string | null {
  let best: string | null = null
  for (const raw of rules) {
    const rule = raw.trim().toLowerCase().replace(/\.$/, '')
    if (rule === '') continue
    if (ascii === rule || ascii.endsWith(`.${rule}`)) {
      if (best == null || rule.length > best.length) best = rule
    }
  }
  return best
}

export function verdictOf({ answer, settings, allowed }: CheckInputs, now: number = Date.now()): Verdict {
  const name = answer.name

  /* A reported block is proof on its own, whatever else could be read. */
  if (answer.reasons.length > 0) {
    const lists = answer.reasons.filter((r) => r.source === 'list')
    if (lists.length > 0) {
      return { kind: 'lists', name, domain: lists[0].domain, lists: lists.map((l) => l.url) }
    }
    const rule = answer.reasons.find((r) => r.source === 'rule')
    if (rule != null) return { kind: 'rule', name, domain: rule.domain }
    return {
      kind: 'other',
      name,
      texts: answer.reasons.map((r) => (r.source === 'other' ? r.text : '')),
    }
  }

  const s = isMissing(settings) ? null : settings
  if (s?.enableBlocking === false) {
    const till = s.temporaryDisableBlockingTill
    return { kind: 'off', name, paused: till != null && Date.parse(till) > now }
  }

  const rules = isMissing(allowed) ? null : allowed
  const rule = rules != null ? allowRuleFor(answer.ascii, rules) : null
  if (rule != null) return { kind: 'allowed', name, domain: rule }

  if (s != null && answer.clientIp != null) {
    const ip = answer.clientIp
    if ((s.blockingBypassList ?? []).some((n) => networkContains(n, ip))) return { kind: 'bypassed', name, ip }
  }
  if (s?.allowTxtBlockingReport === false) return { kind: 'unreported', name }

  const unread: { settings?: Missing; allowed?: Missing } = {}
  if (isMissing(settings)) unread.settings = settings
  if (isMissing(allowed)) unread.allowed = allowed
  return { kind: 'clear', name, unread }
}

/*
The readable name of a list, the one the Lists tab draws (`listName` over Technitium's
catalogue and then ours). The server reports the URL as .NET's `AbsoluteUri`, which
can differ from how the catalogue writes it, so both sides are also compared after
the browser's own normalisation.
*/
export function reportedListName(url: string, catalog: readonly QuickEntry[]): string | null {
  const exact = listName(url, catalog)
  if (exact != null) return exact
  const norm = (u: string) => {
    try {
      return new URL(u).href
    } catch {
      return u
    }
  }
  return listName(
    norm(url),
    catalog.map((e) => ({ ...e, urls: e.urls.map(norm) })),
  )
}

/** A read that may be skipped for its permission or fail, as the verdict takes it. */
function readOrMissing<T>(outcome: ApiOutcome<T> | { need: string }): T | Missing {
  if ('need' in outcome) return outcome
  return outcome.kind === 'ok' ? outcome.data : { failed: true }
}

/*
The check: the query and, beside it, the two reads the verdict needs, each skipped
when its permission is missing (`need`). All three go to the server the console is
on, with no `node`, as the Block and Allow beside the field do: rules and lists are
cluster-wide, and `Blocking Bypass List` is matched against this server's own address.

The query is a real one: like any DNS Client query to `this-server`, it is answered,
counted and logged by the server (a blocked one shows in Recently Blocked, from the
server's own address).

Only the query's failure fails the check, and its message is the server's
(`Invalid domain name [x y]: invalid character [32] was found.`, `Access was
denied.`); the other two only narrow the verdict.
*/
export async function checkDomain(
  token: string | null,
  domain: string,
  needs: { settings?: string; allowed?: string },
): Promise<ApiOutcome<CheckInputs>> {
  const [answer, settings, allowed] = await Promise.all([
    resolve(token, { server: 'this-server', domain, type: 'A', protocol: 'UDP', dnssec: false, eDnsClientSubnet: '' }),
    needs.settings != null ? { need: needs.settings } : readSettings(token),
    needs.allowed != null ? { need: needs.allowed } : readRuleExport('allowed', token),
  ])
  if (answer.kind !== 'ok') return answer
  return {
    kind: 'ok',
    data: {
      answer: parseAnswer(answer.data.response?.result),
      settings: readOrMissing<BlockingSettings>(settings),
      allowed: readOrMissing(allowed),
    },
  }
}
