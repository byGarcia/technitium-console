import { ENTRIES_PER_PAGE, PROTOCOLS, QCLASSES, RCODES, RESPONSE_TYPES } from '../../api/logs'
import { localInput } from '../dashboard/jump'
import { toIso } from './dates'
import type { Filters } from './QueryLogs'

/*
THE QUERY ON SCREEN, IN THE ADDRESS BAR (deviation 20 in CONVENTIONS.md,
2026-11-06), the way the zone list keeps its page and filters (`lib/url-state.ts`):
after a query lands, the filters it SENT and the page the server answered are
written to the search by replacing the entry, so a reload or a copied link asks for
the same page with the same filters. Upstream never touches the URL.

Each parameter is named as `logs/query` names it, so the bar reads like the call
it repeats. Only what differs from what `Reset` gives is written, and the page only
past the first. `From` and `To` travel as the instants the call sends
(`toIso`), not as the field's text, so a link opened in another time zone asks
for the same span; they come back as that zone's `datetime-local` value.

On arrival the filters are read once, checked and applied the way Query would
apply them: a value the form could not hold is dropped (an app that is not
installed, a class it does not have, an option the dropdown does not list, a page
that is not a number), and the rest is queried. Live Update stays off: a link
asks for one page, never for a mode.
*/

type Key = keyof Filters

/** The form's field and the parameter that carries it, in the call's order. */
const PARAMS: [Key, string][] = [
  ['appName', 'name'],
  ['classPath', 'classPath'],
  ['pageNumber', 'pageNumber'],
  ['entriesPerPage', 'entriesPerPage'],
  ['descendingOrder', 'descendingOrder'],
  ['start', 'start'],
  ['end', 'end'],
  ['clientIpAddress', 'clientIpAddress'],
  ['protocol', 'protocol'],
  ['responseType', 'responseType'],
  ['rcode', 'rcode'],
  ['qname', 'qname'],
  ['qtype', 'qtype'],
  ['qclass', 'qclass'],
]

/** Every parameter this screen writes, for dropping them when it goes. */
export const QUERY_PARAMS = PARAMS.map(([, p]) => p)

/** The bar's parameters for the filters a query sent and the page it landed on. */
export function queryParams(sent: Filters, reset: Filters, page: number): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const [key, param] of PARAMS) {
    if (key === 'pageNumber') {
      out[param] = page > 1 ? String(page) : null
      continue
    }
    const value = sent[key]
    if (value === reset[key]) {
      out[param] = null
      continue
    }
    out[param] = key === 'start' || key === 'end' ? toIso(value) || null : value
  }
  return out
}

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

/** One instant of the bar back to the browser's `datetime-local`, or `null`. */
function fromIso(value: string): string | null {
  const at = Date.parse(value)
  if (Number.isNaN(at)) return null
  const local = localInput(at)
  return LOCAL.test(local) ? local.replace(/:00$/, '') : null
}

const has = (list: readonly { value: string }[] | readonly string[], v: string) =>
  list.some((o) => (typeof o === 'string' ? o : o.value) === v)

/**
 * The form the bar asks for, over `base` (what Reset gives), or `null` when the bar
 * asks for nothing. `apps` are the apps that serve query logs, with their classes.
 */
export function filtersFromBar(
  search: string,
  base: Filters,
  apps: { name: string; classPaths: string[] }[],
): Filters | null {
  const bar = new URLSearchParams(search)
  if (!QUERY_PARAMS.some((p) => (bar.get(p) ?? '') !== '')) return null
  const get = (p: string) => {
    const v = bar.get(p)
    return v == null || v === '' ? null : v
  }
  const f: Filters = { ...base }

  const app = apps.find((a) => a.name === get('name'))
  if (app != null) {
    f.appName = app.name
    f.classPath = app.classPaths[0] ?? ''
  }
  const classPath = get('classPath')
  if (classPath != null && (apps.find((a) => a.name === f.appName)?.classPaths ?? []).includes(classPath)) {
    f.classPath = classPath
  }

  const page = get('pageNumber')
  if (page != null && /^[1-9]\d{0,8}$/.test(page)) f.pageNumber = page
  const per = get('entriesPerPage')
  if (per != null && has(ENTRIES_PER_PAGE, per)) f.entriesPerPage = per
  if (get('descendingOrder') === 'false') f.descendingOrder = 'false'

  const start = get('start')
  const end = get('end')
  if (start != null) f.start = fromIso(start) ?? ''
  if (end != null) f.end = fromIso(end) ?? ''

  for (const key of ['clientIpAddress', 'qname', 'qtype'] as const) {
    const v = get(key)
    if (v != null) f[key] = v
  }
  const protocol = get('protocol')
  if (protocol != null && has(PROTOCOLS, protocol)) f.protocol = protocol
  const responseType = get('responseType')
  if (responseType != null && has(RESPONSE_TYPES, responseType)) f.responseType = responseType
  const rcode = get('rcode')
  if (rcode != null && has(RCODES, rcode)) f.rcode = rcode
  const qclass = get('qclass')
  if (qclass != null && has(QCLASSES, qclass)) f.qclass = qclass
  return f
}
