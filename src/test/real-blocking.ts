import sample from '../screens/blocking/real-sample.json'
import quickBuiltin from '../../public/json/quick-block-lists-builtin.json'

/*
A fake server for the Blocking section's `*.real.test.tsx`, answering with what the
`dev` harness REALLY answered (v15.5.1, captured 2026-10-01 from 127.0.0.1:5380 with
its T15 block lists and a day of seeded traffic). It answers at the `fetch` level, so
`apiRequest`, `readRuleExport`, `localiseLabels` and every parser between the wire
and the screen run as they do in production.

`real-sample.json` holds, as the server sent them:
- `statsLastHour`, `statsLastDay`: `dashboard/stats/get?type=…&utc=true`;
- `blockedExport`, `allowedExport`: `blocked/export`, `allowed/export` (text);
- `settings`: `settings/get?node=`, trimmed to the five blocking fields the section
  reads (`enableBlocking`, `blockListUrls`, `blockListUpdateIntervalHours`,
  `blockListNextUpdatedOn` and `temporaryDisableBlockingTill`, which is absent because
  the server omits it);
- `apps`: `apps/list`, without the long descriptions of each DNS app class;
- `logsBlocked`, `logsUpstreamBlocked`, `logsUpstreamBlockedCached`: `logs/query` of
  the Query Logs (Sqlite) app, one per blocked class, 10 per page, newest first.

Nothing personal is in it: the clients are the harness containers' addresses and
the domains are the harness's own test names and public ad/tracker domains.

To capture it again, log in as in CONVENTIONS.md and ask the same paths with
`token=$T`; trim `settings` and `apps` the same way.
*/

export const REAL = sample

type Handler = (path: string, params: URLSearchParams) => Response | undefined

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
const text = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/plain' } })

/** What the harness answered, by path. `extra` may answer first, to vary one call. */
export function realServer(extra?: Handler) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input instanceof Request ? input.url : input), window.location.href)
    const path = url.pathname.replace(/^.*?\/api\//, '')
    const params = url.searchParams
    const custom = extra?.(path, params)
    if (custom != null) return custom
    if (url.pathname.endsWith('/json/quick-block-lists-builtin.json')) return json(quickBuiltin)
    if (url.pathname.includes('/json/')) return new Response('', { status: 404, statusText: 'Not Found' })
    switch (path) {
      case 'dashboard/stats/get':
        return json(params.get('type') === 'LastDay' ? sample.statsLastDay : sample.statsLastHour)
      case 'blocked/export':
        return text(sample.blockedExport)
      case 'allowed/export':
        return text(sample.allowedExport)
      case 'settings/get':
        return json(sample.settings)
      case 'apps/list':
        return json(sample.apps)
      case 'logs/query': {
        const type = params.get('responseType')
        if (type === 'Blocked') return json(sample.logsBlocked)
        if (type === 'UpstreamBlocked') return json(sample.logsUpstreamBlocked)
        if (type === 'UpstreamBlockedCached') return json(sample.logsUpstreamBlockedCached)
        break
      }
    }
    throw new Error(`real-blocking: no captured answer for ${url.pathname}${url.search}`)
  }
}
