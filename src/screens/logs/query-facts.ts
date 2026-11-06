import { RCODES, RESPONSE_TYPES, type QueryLogEntry } from '../../api/logs'
import { BLOCKED_TYPES } from '../../api/blocking'

/*
What the page of Query Logs on screen holds (deviation 20 in CONVENTIONS.md,
2026-11-06), counted from the entries of the `logs/query` answer the screen already
has: no call is added, and the counts are of THIS page, never of the whole log,
which the server does not count by type, code or client.

The colours are the Dashboard's (`dashboard/palette.ts`), by the same names, so
`Cached` is the same pink here, on the Dashboard's doughnut and on the row pill
upstream's row colours paint (`rowClass`).
*/

const RESPONSE_COLOUR: Record<string, string> = {
  Authoritative: 'var(--ch-auth)',
  Recursive: 'var(--ch-rec)',
  Cached: 'var(--ch-cache)',
  Blocked: 'var(--ch-block)',
  UpstreamBlocked: 'var(--ch-block)',
  UpstreamBlockedCached: 'var(--ch-block)',
}

const RCODE_COLOUR: Record<string, string> = {
  NoError: 'var(--ch-ok)',
  ServerFailure: 'var(--ch-fail)',
  NxDomain: 'var(--ch-nx)',
  Refused: 'var(--ch-refuse)',
}

export function responseColour(type: string): string {
  return RESPONSE_COLOUR[type] ?? 'var(--ch-drop)'
}

export function rcodeColour(rcode: string): string {
  return RCODE_COLOUR[rcode] ?? 'var(--ch-drop)'
}

export interface Tally {
  /** The value as the server writes it and the filter sends it (`NxDomain`). */
  value: string
  /** The words the filter's dropdown shows for it (`NX Domain`), or the value. */
  label: string
  count: number
  /** Whether the form has a field option for it, so pressing it can set the filter. */
  known: boolean
}

function tally(
  entries: QueryLogEntry[],
  read: (e: QueryLogEntry) => string | null,
  options?: { value: string; label: string }[],
): Tally[] {
  const counts = new Map<string, number>()
  for (const e of entries) {
    const v = read(e)
    if (v == null) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const rows = [...counts].map(([value, count]) => {
    const option = options?.find((o) => o.value !== '' && o.value === value)
    return { value, label: option?.label ?? value, count, known: options == null || option != null }
  })
  /* A closed list keeps the dropdown's order, so a type never changes place between
     pages; an open one (clients, domains) goes most first. */
  if (options != null) {
    const at = (v: string) => {
      const i = options.findIndex((o) => o.value === v)
      return i < 0 ? options.length : i
    }
    return rows.sort((a, b) => at(a.value) - at(b.value) || a.value.localeCompare(b.value))
  }
  return rows.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export const byResponseType = (entries: QueryLogEntry[]) => tally(entries, (e) => e.responseType, RESPONSE_TYPES)
export const byRcode = (entries: QueryLogEntry[]) => tally(entries, (e) => e.rcode, RCODES)
export const byClient = (entries: QueryLogEntry[]) => tally(entries, (e) => e.clientIpAddress || null)
/* An entry with no question carries `qname: null` and is left out; the root (`''`)
   is a name like any other and counts, written as upstream writes it, a dot. */
export const byDomain = (entries: QueryLogEntry[]) => tally(entries, (e) => e.qname)

const BLOCKED = BLOCKED_TYPES.map((t) => t.toLowerCase())

/** The entries answered blocked: the three blocked response types, as Allow Domain
 *  reads them (`lib/allow-block`) and the Dashboard's Blocked adds them up. */
export function blockedCount(entries: QueryLogEntry[]): number {
  return entries.filter((e) => BLOCKED.includes(e.responseType.toLowerCase())).length
}

/** A share as a whole percentage, `<1%` for a small one that is not zero. */
export function percent(part: number, whole: number): string {
  if (whole === 0 || part === 0) return '0%'
  const p = Math.round((part / whole) * 100)
  return p === 0 ? '<1%' : `${p}%`
}
