/*
Cloudflare Pages serves this file at /dns-query. Everything it does is in
`src/handler.ts`; this only wires it to the live `fetch` and to the edge cache,
which works on *.pages.dev.
*/

import { handle, lookup, type Store } from '../src/handler.ts'

function edgeCache(): Store {
  const cache = (caches as unknown as { default: Cache }).default
  const key = (name: string) => `https://technitium-console.pages.dev/__cache/${name}`
  return {
    async get(name) {
      const hit = await cache.match(key(name))
      if (!hit) return null
      try {
        return await hit.json()
      } catch {
        return null
      }
    },
    async put(name, value, ttlSeconds) {
      const body = JSON.stringify(value)
      await cache.put(key(name), new Response(body, { headers: { 'cache-control': `max-age=${ttlSeconds}` } }))
    },
  }
}

export const onRequest = (context: { request: Request }): Promise<Response> =>
  handle(context.request, () => lookup(fetch, edgeCache()))
