import { urlApi } from '../app/base'
import { envelopeOutcome, type ApiOutcome } from './client'
import { queryLogs, type QueryLogEntry } from './logs'
import { addDomain, deleteDomain, type DomainList } from './zonelists'

/*
The Blocking section's own reads. Every endpoint here already exists in the server;
what is ours is only how their answers are combined.
*/

/*
`allowed/export` / `blocked/export` read as TEXT, for the Rules table. Upstream only
opens them as a download (other-zones.js:554, 623); here the same answer is read in
place. The good answer is `text/plain`, one zone per line
(WebServiceOtherZonesApi.cs:306, 511); a failure is the usual JSON envelope.
*/
export async function readRuleExport(
  list: DomainList,
  token: string | null,
): Promise<ApiOutcome<string[]>> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  let text: string
  try {
    res = await fetch(urlApi(`api/${list}/export`), { headers })
    text = await res.text()
  } catch {
    return { kind: 'error', message: 'Unable to connect to the server. Please try again.' }
  }

  /* A failure is the usual envelope, read where `apiRequest` reads it. */
  if (text.trimStart().startsWith('{')) {
    try {
      const env = JSON.parse(text) as { status?: string; errorMessage?: string }
      if (env.status != null && env.status !== 'ok') return envelopeOutcome<string[]>(env)
    } catch {
      /* Not JSON: a zone name cannot start with `{`, but the server owns the format. */
    }
  }

  /*
  Anything else that is not a 2xx —a reverse proxy's 502 page, a 404 page— is not
  a list. common.js:186-193 reports it as jQuery does: `textStatus - errorThrown`,
  i.e. `error - <status text>`, and upstream's own sentence when the status text
  is empty.
  */
  if (!res.ok) {
    return {
      kind: 'error',
      message: res.statusText === ''
        ? 'Unable to connect to the server. Please try again.'
        : `error - ${res.statusText}`,
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  return { kind: 'ok', data: lines }
}

/* The three response types `totalBlocked` adds up (StatsManager.cs:329-341). */
export const BLOCKED_TYPES = ['Blocked', 'UpstreamBlocked', 'UpstreamBlockedCached'] as const

export function mergeRecent(
  pages: readonly (readonly QueryLogEntry[] | null)[],
  limit: number,
): QueryLogEntry[] {
  return pages
    .flatMap((p) => p ?? [])
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit)
}

/*
The latest blocked queries, for the Overview panel. `logs/query` filters by ONE
response type (WebServiceLogsApi.cs:182) while the Blocked figure counts three, so
it asks three times and merges. Exact without paging: the newest N of the union are
always among the newest N of each class.
*/
export async function recentBlocked(
  token: string | null,
  app: { name: string; classPath: string },
  node: string,
  limit = 10,
): Promise<ApiOutcome<{ entries: QueryLogEntry[]; partial: boolean }>> {
  const outcomes = await Promise.all(
    BLOCKED_TYPES.map((responseType) =>
      queryLogs(token, {
        name: app.name,
        classPath: app.classPath,
        pageNumber: '1',
        entriesPerPage: String(limit),
        descendingOrder: 'true',
        start: '',
        end: '',
        clientIpAddress: '',
        protocol: '',
        responseType,
        rcode: '',
        qname: '',
        qtype: '',
        qclass: '',
        node,
      }),
    ),
  )
  const pages = outcomes.map((o) => (o.kind === 'ok' ? o.data.response.entries : null))
  const failed = outcomes.find((o) => o.kind !== 'ok')
  if (pages.every((p) => p == null) && failed != null) return failed as ApiOutcome<never>
  return { kind: 'ok', data: { entries: mergeRecent(pages, limit), partial: failed != null } }
}

/* `allowDomain` (other-zones.js:637): out of Blocked first, then into Allowed. */
export async function allowDomain(token: string | null, domain: string): Promise<ApiOutcome> {
  const removed = await deleteDomain('blocked', token, domain)
  if (removed.kind !== 'ok') return removed
  return addDomain('allowed', token, domain)
}

/* `blockDomain` (other-zones.js:686): out of Allowed first, then into Blocked. */
export async function blockDomain(token: string | null, domain: string): Promise<ApiOutcome> {
  const removed = await deleteDomain('allowed', token, domain)
  if (removed.kind !== 'ok') return removed
  return addDomain('blocked', token, domain)
}
