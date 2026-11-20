import { queryLogs, type QueryLogEntry } from '../../api/logs'
import type { ApiOutcome } from '../../api/client'
import { listApps } from '../../api/apps'
import { resolve } from '../../api/dnsclient'
import type { QuickEntry } from '../../lib/quick-lists'
import { isAdvancedBlocking } from '../apps/app-kinds'
import {
  blockingReasons, reportSilence, reportedListName,
  type BlockReason, type BlockingSettings, type Missing, type ReportSilence,
} from './check-domain'
import { requiresText } from './permissions'

/*
Which block lists account for the blocked queries in the current log. OURS: the
server keeps no per-list counter. The count is taken once, when asked, from
`logs/query` with `responseType=Blocked` (the class a built-in list or the
Advanced Blocking app answers as). It is the log the server is keeping, often
about the last hour, and not the period chosen on Overview.

Queries from 127.0.0.1 and ::1 are left out before any lookup. The check and
this count ask Technitium about a name with a TXT query, and that query is
itself logged from the server's own address. Counting it would count the count.
A server that listens on one address only asks itself there, so that address
is left out too.

One press looks up at most `LOOKUP_CAP` names, the ones with the most hits
first. A later press continues with the next names. The Advanced Blocking app
chooses its group from the client address, and these lookups come from the
server, so the group in the answer is the server's own group.

A name on two built-in lists is counted on both. The Advanced Blocking app
names only the first matching list, so a name it blocked is credited to that
one list. A regex report is a list when it names `regexBlockListUrl`, and the
app itself when it names only a pattern.
*/

/** How many blocked queries one page of `logs/query` asks for. */
export const BLOCKED_PAGE_SIZE = 1000
/** Pages read per click. Past this, the count says it saw the newest only. */
export const BLOCKED_MAX_PAGES = 20
/**
 * Names resolved per press. Each one is logged as blocked from this server, so
 * the cap is what a press can add to the Blocked figures around the panel.
 */
export const LOOKUP_CAP = 100

export interface NameCount {
  name: string
  hits: number
}

export interface LoggedNames {
  /** Blocked queries whose client was not the server itself. */
  blockedQueries: number
  skippedLoopback: number
  /** Rows with no question name. They cannot be looked up. */
  unnamedHits: number
  names: NameCount[]
}

export interface CountedList {
  url: string
  group: string | null
  /** The Advanced Blocking app named no list URL. */
  app: boolean
  hits: number
  domains: number
}

export interface CountResult {
  lists: CountedList[]
  unmatched: { hits: number; domains: number }
  unresolved: { hits: number; domains: number }
}

/** 127.0.0.1 and ::1, including the forms the log writes around them. */
export function isLoopbackClient(ip: string | null | undefined): boolean {
  let value = String(ip ?? '').trim().toLowerCase()
  if (value.startsWith('[') && value.includes(']')) value = value.slice(1, value.indexOf(']'))
  const zone = value.indexOf('%')
  if (zone !== -1) value = value.slice(0, zone)
  if (value.startsWith('::ffff:')) value = value.slice('::ffff:'.length)
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(':'))
  return value === '127.0.0.1' || value === '::1' || value === '0:0:0:0:0:0:0:1'
}

function questionName(qname: string | null | undefined): string {
  return String(qname ?? '').trim().replace(/\.+$/, '').toLowerCase()
}

/** Distinct names in the blocked log, loopback clients already removed. */
export function namesToCount(
  entries: readonly Pick<QueryLogEntry, 'clientIpAddress' | 'qname'>[],
  ownAddress: string | null = null,
): LoggedNames {
  const counts = new Map<string, number>()
  let blockedQueries = 0
  let skippedLoopback = 0
  let unnamedHits = 0
  for (const entry of entries) {
    if (isLoopbackClient(entry.clientIpAddress) || (ownAddress != null && entry.clientIpAddress === ownAddress)) {
      skippedLoopback++
      continue
    }
    blockedQueries++
    const name = questionName(entry.qname)
    if (name === '') {
      unnamedHits++
      continue
    }
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return {
    blockedQueries,
    skippedLoopback,
    unnamedHits,
    names: [...counts.entries()].map(([name, hits]) => ({ name, hits })),
  }
}

export interface LookUpPlan {
  /** Names to resolve on this press, most-hit first, at most `cap` that are not cached. */
  fetch: NameCount[]
  /** Names whose report is already cached. */
  cached: NameCount[]
  omittedHits: number
  omittedDomains: number
}

/**
 * Which names this press resolves. Cached names are kept, and the rest are taken
 * most-hit first up to `cap`. What does not fit is left for a later press.
 */
export function planLookups(
  names: readonly NameCount[],
  cached: (name: string) => boolean,
  cap = LOOKUP_CAP,
): LookUpPlan {
  const ranked = [...names].sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name))
  const fetch: NameCount[] = []
  const known: NameCount[] = []
  let omittedHits = 0
  let omittedDomains = 0
  for (const row of ranked) {
    if (cached(row.name)) known.push(row)
    else if (fetch.length < cap) fetch.push(row)
    else {
      omittedHits += row.hits
      omittedDomains++
    }
  }
  return { fetch, cached: known, omittedHits, omittedDomains }
}

function listKey(reason: BlockReason): string | null {
  if (reason.source === 'list') return `list\n${reason.url}\n${reason.group ?? ''}`
  if (reason.source === 'app') return `app\n${reason.group ?? ''}`
  return null
}

/**
 * Credit each name's hits to every list its report named. A report that names
 * no list, and a lookup that failed, are counted apart from the lists.
 */
export function countLists(
  names: readonly NameCount[],
  found: ReadonlyMap<string, { ok: boolean; reasons: readonly BlockReason[] }>,
): CountResult {
  const totals = new Map<string, CountedList>()
  let unmatchedHits = 0
  let unmatchedDomains = 0
  let unresolvedHits = 0
  let unresolvedDomains = 0

  for (const row of names) {
    const report = found.get(row.name)
    if (report == null || !report.ok) {
      unresolvedHits += row.hits
      unresolvedDomains++
      continue
    }
    const seen = new Set<string>()
    const lists = report.reasons.filter((reason) => {
      const key = listKey(reason)
      if (key == null || seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (lists.length === 0) {
      unmatchedHits += row.hits
      unmatchedDomains++
      continue
    }
    for (const reason of lists) {
      if (reason.source !== 'list' && reason.source !== 'app') continue
      const key = listKey(reason)
      if (key == null) continue
      const current = totals.get(key) ?? {
        url: reason.source === 'list' ? reason.url : '',
        group: reason.group ?? null,
        app: reason.source === 'app',
        hits: 0,
        domains: 0,
      }
      current.hits += row.hits
      current.domains += 1
      totals.set(key, current)
    }
  }

  return {
    lists: [...totals.values()].sort((a, b) => b.hits - a.hits || a.url.localeCompare(b.url)),
    unmatched: { hits: unmatchedHits, domains: unmatchedDomains },
    unresolved: { hits: unresolvedHits, domains: unresolvedDomains },
  }
}

/** The blocked queries in the current log, newest first, at most `BLOCKED_MAX_PAGES` pages. */
export async function readBlockedLog(
  token: string | null,
  app: { name: string; classPath: string },
  node: string,
): Promise<ApiOutcome<{ entries: QueryLogEntry[]; truncated: boolean }>> {
  const entries: QueryLogEntry[] = []
  let truncated = false
  for (let page = 1; page <= BLOCKED_MAX_PAGES; page++) {
    const outcome = await queryLogs(token, {
      name: app.name,
      classPath: app.classPath,
      pageNumber: String(page),
      entriesPerPage: String(BLOCKED_PAGE_SIZE),
      descendingOrder: 'true',
      start: '',
      end: '',
      clientIpAddress: '',
      protocol: '',
      responseType: 'Blocked',
      rcode: '',
      qname: '',
      qtype: '',
      qclass: '',
      node,
    })
    if (outcome.kind !== 'ok') {
      if (entries.length === 0) return outcome
      truncated = true
      break
    }
    const batch = outcome.data.response?.entries ?? []
    entries.push(...batch)
    const totalPages = outcome.data.response?.totalPages ?? page
    if (batch.length === 0 || page >= totalPages) break
    if (page === BLOCKED_MAX_PAGES) truncated = true
  }
  return { kind: 'ok', data: { entries, truncated } }
}

interface CachedReport {
  ok: boolean
  reasons: BlockReason[]
  expires: number
}

/** Names remembered in this tab. Past this, the oldest report is dropped. */
const REPORT_CACHE_MAX = 2000

const reports = new Map<string, CachedReport>()

function cacheKey(node: string, domain: string): string {
  return `${node}\n${domain}`
}

/** A report this count already read. Expired entries are dropped. */
export function cachedReport(node: string, domain: string, now = Date.now()): CachedReport | null {
  const hit = reports.get(cacheKey(node, domain))
  if (hit == null || hit.expires <= now) {
    if (hit != null) reports.delete(cacheKey(node, domain))
    return null
  }
  return hit
}

export function storeReport(node: string, domain: string, report: { ok: boolean; reasons: BlockReason[] }, now = Date.now()): void {
  const key = cacheKey(node, domain)
  if (!reports.has(key) && reports.size >= REPORT_CACHE_MAX) {
    const oldest = reports.keys().next().value
    if (oldest != null) reports.delete(oldest)
  }
  const ttl = !report.ok ? 60_000 : report.reasons.length > 0 ? 30 * 60_000 : 10 * 60_000
  reports.set(key, { ...report, expires: now + ttl })
}

export function clearReportCache(): void {
  reports.clear()
}

/*
The two steps Count lists takes around its log read, shared with the Dashboard's
Top Blocked Domains (deviation 46): whether a lookup from this server can name a
list at all, and the lookups themselves.
*/

/**
 * Why a lookup would not name a list, from the settings already read, or `null`
 * when it can. Disabled or paused blocking and the report being off do not stop it
 * when the Advanced Blocking app is installed, which blocks and reports by itself:
 * `apps/list` is read only then.
 */
export async function silenceOf(
  token: string | null,
  settings: BlockingSettings,
  node: string,
): Promise<ReportSilence | null> {
  const silence = reportSilence(settings)
  if (silence == null || silence.kind === 'bypassed') return silence
  const apps = await listApps(token, node)
  if (apps.kind === 'ok' && (apps.data.response.apps ?? []).some(isAdvancedBlocking)) {
    return reportSilence(settings, Date.now(), true)
  }
  return silence
}

/** Lookups in flight at once. */
const LOOKUP_WIDTH = 4

async function mapPool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const workers = Math.min(limit, items.length)
  if (workers === 0) return
  let cursor = 0
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: workers }, () => run()))
}

export interface Report {
  ok: boolean
  reasons: BlockReason[]
}

/**
 * One TXT query per name through DNS Client (`dnsClient/resolve` against
 * `this-server`), four at a time, each answer read as a blocking report and
 * remembered (`storeReport`). Returns each name's report.
 */
export async function lookUpNames(
  token: string | null,
  names: readonly string[],
  node: string,
): Promise<Map<string, Report>> {
  const found = new Map<string, Report>()
  await mapPool(names, LOOKUP_WIDTH, async (name) => {
    const outcome = await resolve(token, {
      server: 'this-server',
      domain: name,
      type: 'TXT',
      protocol: 'UDP',
      dnssec: false,
      eDnsClientSubnet: '',
      node,
    })
    const report: Report = outcome.kind === 'ok'
      ? { ok: true, reasons: blockingReasons(outcome.data.response?.result) }
      : { ok: false, reasons: [] }
    storeReport(node, name, report)
    found.set(name, report)
  })
  return found
}

/** A list URL's last path segment, or its host, for a list the catalogue does not name. */
export function fileName(url: string): string {
  try {
    const parsed = new URL(url)
    const seg = parsed.pathname.split('/').filter((part) => part !== '').pop()
    return seg || parsed.hostname || 'Block list'
  } catch {
    const seg = url.split('/').filter((part) => part !== '').pop()
    return seg || 'Block list'
  }
}

/** The name a counted list is drawn with. */
export function listLabel(list: Pick<CountedList, 'app' | 'url' | 'group'>, catalog: readonly QuickEntry[]): string {
  if (list.app || list.url === '') {
    return list.group != null && list.group !== '' ? `Advanced Blocking · ${list.group}` : 'Advanced Blocking'
  }
  return reportedListName(list.url, catalog) ?? fileName(list.url)
}

/** Why nothing was looked up: what the settings say, or that they were not read. */
export type Held = ReportSilence | { kind: 'unread'; missing: Missing }

export function heldText(held: Held): string {
  switch (held.kind) {
    case 'off':
      return held.paused
        ? 'Blocking is paused, so nothing was looked up.'
        : 'Blocking is disabled, so nothing was looked up.'
    case 'unreported':
      return 'Allow TXT Blocking Report is off, so this server does not say which list matched. Nothing was looked up.'
    case 'bypassed':
      return `This server's own address, ${held.ip}, is on the Blocking Bypass List, so a lookup from here is never blocked. Nothing was looked up.`
    case 'unread':
      return 'need' in held.missing
        ? `The blocking settings were not checked. ${requiresText(held.missing.need)}`
        : 'Could not read the blocking settings. Nothing was looked up.'
  }
}
