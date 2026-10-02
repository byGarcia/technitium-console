import type { DomainList } from '../../api/zonelists'

/*
The flat table of the Rules tab: the administrator's own blocked and allowed domains
in one list. OURS: upstream only has the tree.

The server does not bound the size: `allowed/export` and `blocked/export` return
`GetAllZones()` whole (WebServiceOtherZonesApi.cs:289, 494), and an import can be as
long as the administrator likes. So the table filters the WHOLE set and only then
cuts a page.
*/

export interface Rule {
  domain: string
  list: DomainList
}

export type RuleFilter = 'all' | DomainList

export const RULES_PER_PAGE = 50

export function mergeRules(
  blocked: readonly string[] | null,
  allowed: readonly string[] | null,
): Rule[] {
  const rows: Rule[] = [
    ...(blocked ?? []).map((domain) => ({ domain, list: 'blocked' as const })),
    ...(allowed ?? []).map((domain) => ({ domain, list: 'allowed' as const })),
  ]
  return rows.sort((a, b) => (a.domain === b.domain ? 0 : a.domain < b.domain ? -1 : 1))
}

export function filterRules(rules: readonly Rule[], filter: RuleFilter, query: string): Rule[] {
  const q = query.trim().toLowerCase()
  return rules.filter(
    (r) => (filter === 'all' || r.list === filter) && (q === '' || r.domain.toLowerCase().includes(q)),
  )
}

export function countRules(rules: readonly Rule[]): { all: number; blocked: number; allowed: number } {
  let blocked = 0
  for (const r of rules) if (r.list === 'blocked') blocked++
  return { all: rules.length, blocked, allowed: rules.length - blocked }
}

export function pageOf<T>(
  rows: readonly T[],
  page: number,
  size = RULES_PER_PAGE,
): { rows: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(Math.max(1, page), totalPages)
  return { rows: rows.slice((current - 1) * size, current * size), page: current, totalPages }
}

/*
The filter travels in the address bar (`?rule=allowed|blocked`) so it survives a
reload and a copied link, and so `/allowed/` and `/blocked/` can land on it.
*/
export function readRuleParam(search: string): RuleFilter {
  const v = new URLSearchParams(search).get('rule')
  return v === 'allowed' || v === 'blocked' ? v : 'all'
}

export function ruleSearch(search: string, filter: RuleFilter): string {
  const params = new URLSearchParams(search)
  if (filter === 'all') params.delete('rule')
  else params.set('rule', filter)
  const out = params.toString()
  return out === '' ? '' : `?${out}`
}
