/*
The endpoint: a DNS-over-HTTPS server (RFC 8484) that knows one name.

The console cannot ask GitHub itself: the DNS server serves it with
`default-src 'self'` and no `connect-src`. What it can do is ask its own server
to resolve a name with DNS Client (`dnsClient/resolve`), and DNS Client accepts
a DoH URL as the server. So this answers `latest.technitium-console.pages.dev`
TXT with the latest release, and everything else with NXDOMAIN or nothing.
*/

import { buildResponse, parseQuery, TYPE_TXT } from './dns-message.ts'
import { formatRecord, readRelease, type Release } from './source.ts'

export const RECORD_NAME = 'latest.technitium-console.pages.dev'
const RECORD_TTL = 3600
const FRESH_TTL = 3600
const NOTHING_TTL = 600
const FAILURE_TTL = 60
const LAST_TTL = 30 * 24 * 3600
const MAX_QUERY = 4096
const VERSION = /^\d+\.\d+(\.\d+)?$/

/* What comes back from `get` is checked before use: the cache is storage this
   code does not own end to end, so it is read as untrusted. */
export interface Store {
  get(key: string): Promise<unknown>
  put(key: string, value: unknown, ttlSeconds: number): Promise<void>
}

function asRelease(value: unknown): Release | null {
  const r = value as Partial<Release> | null
  if (!r || typeof r.latest !== 'string' || typeof r.server !== 'string') return null
  if (!/^\d+\.\d+\.\d+$/.test(r.latest) || !VERSION.test(r.server)) return null
  return { latest: r.latest, server: r.server }
}

/*
GitHub and GHCR are read at most once an hour. When they fail, the last good
record keeps being served for up to a month, so an outage on their side does not
silence every console; with nothing kept, the failure reaches the caller.

"Nothing to announce" and a failure with nothing kept are cached too, for ten
minutes and one minute. Anyone can send queries, and without that each one
would cost GitHub two to four requests.
*/
export async function lookup(fetchFn: typeof fetch, store: Store): Promise<Release | null> {
  const fresh = (await store.get('fresh')) as { release?: unknown } | null
  if (fresh && typeof fresh === 'object' && 'release' in fresh) {
    if (fresh.release === null) return null
    const release = asRelease(fresh.release)
    if (release) return release
  }

  const last = asRelease(await store.get('last'))
  let release: Release | null
  try {
    release = await readRelease(fetchFn, last)
  } catch (error) {
    await store.put('fresh', { release: last }, FAILURE_TTL)
    if (last) return last
    throw error
  }
  if (release) {
    await store.put('fresh', { release }, FRESH_TTL)
    await store.put('last', release, LAST_TTL)
  } else {
    await store.put('fresh', { release: null }, NOTHING_TTL)
  }
  return release
}

function message(bytes: Uint8Array<ArrayBuffer>): Response {
  return new Response(bytes, {
    headers: { 'content-type': 'application/dns-message', 'cache-control': 'no-store' },
  })
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export async function handle(request: Request, find: () => Promise<Release | null>): Promise<Response> {
  let body: Uint8Array | null = null
  if (request.method === 'POST') {
    body = new Uint8Array(await request.arrayBuffer())
    // A query for one name is a few dozen bytes. Anything this large is not
    // one, and is not echoed back.
    if (body.length > MAX_QUERY) return new Response('Payload Too Large', { status: 413 })
  }
  else if (request.method === 'GET') body = fromBase64Url(new URL(request.url).searchParams.get('dns') ?? '')
  else return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, POST' } })

  // Without a readable question there is nothing to echo back: RFC 8484 lets a
  // DoH server answer such a request with a plain 400.
  const query = body ? parseQuery(body) : null
  if (!query) return new Response('Bad Request', { status: 400 })

  if (query.name !== RECORD_NAME) return message(buildResponse(query, 3))
  if (query.type !== TYPE_TXT) return message(buildResponse(query, 0))

  let release: Release | null
  try {
    release = await find()
  } catch {
    return message(buildResponse(query, 2))
  }
  if (!release) return message(buildResponse(query, 0))
  return message(buildResponse(query, 0, { text: formatRecord(release), ttl: RECORD_TTL }))
}
