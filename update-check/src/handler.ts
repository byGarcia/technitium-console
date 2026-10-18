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
const LAST_TTL = 30 * 24 * 3600

export interface Store {
  get(key: string): Promise<Release | null>
  put(key: string, value: Release, ttlSeconds: number): Promise<void>
}

/*
GitHub and GHCR are read at most once an hour. When they fail, the last good
record keeps being served for up to a month, so an outage on their side does not
silence every console; with nothing kept, the failure reaches the caller.
*/
export async function lookup(fetchFn: typeof fetch, store: Store): Promise<Release | null> {
  const fresh = await store.get('fresh')
  if (fresh) return fresh

  const last = await store.get('last')
  let release: Release | null
  try {
    release = await readRelease(fetchFn, last)
  } catch (error) {
    if (last) return last
    throw error
  }
  if (release) {
    await store.put('fresh', release, FRESH_TTL)
    await store.put('last', release, LAST_TTL)
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
  if (request.method === 'POST') body = new Uint8Array(await request.arrayBuffer())
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
