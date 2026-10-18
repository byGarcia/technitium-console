// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handle, lookup, RECORD_NAME, type Store } from './handler.ts'
import { parseQuery, TYPE_TXT } from './dns-message.ts'
import type { Release } from './source.ts'
import { encodeQuery } from './test-query.ts'

const RECORD: Release = { latest: '1.4.0', server: '15.5' }
const URL = 'https://technitium-console.pages.dev/dns-query'

function post(name: string, type: number): Request {
  return new Request(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/dns-message' },
    body: encodeQuery(name, type, 7, true, 1),
  })
}

async function answer(response: Response) {
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('application/dns-message')
  const bytes = new Uint8Array(await response.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const query = parseQuery(bytes)!
  const at = 12 + query.question.length
  return {
    id: view.getUint16(0),
    rcode: view.getUint16(2) & 0x000f,
    count: view.getUint16(6),
    text: view.getUint16(6) ? new TextDecoder().decode(bytes.slice(at + 13)) : null,
  }
}

describe('handle', () => {
  it('answers the record over POST', async () => {
    const a = await answer(await handle(post(RECORD_NAME, TYPE_TXT), async () => RECORD))
    expect(a).toEqual({ id: 7, rcode: 0, count: 1, text: 'v=1 latest=1.4.0 server=15.5' })
  })

  it('answers the record over GET', async () => {
    const bytes = encodeQuery(RECORD_NAME, TYPE_TXT, 9)
    const dns = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const a = await answer(await handle(new Request(`${URL}?dns=${dns}`), async () => RECORD))
    expect(a).toEqual({ id: 9, rcode: 0, count: 1, text: 'v=1 latest=1.4.0 server=15.5' })
  })

  it('answers NXDOMAIN for another name', async () => {
    const a = await answer(await handle(post('example.com', TYPE_TXT), async () => RECORD))
    expect(a.rcode).toBe(3)
    expect(a.count).toBe(0)
  })

  it('answers empty for another type', async () => {
    const a = await answer(await handle(post(RECORD_NAME, 1), async () => RECORD))
    expect(a).toMatchObject({ rcode: 0, count: 0 })
  })

  it('answers empty when there is nothing to announce', async () => {
    const a = await answer(await handle(post(RECORD_NAME, TYPE_TXT), async () => null))
    expect(a).toMatchObject({ rcode: 0, count: 0 })
  })

  it('answers SERVFAIL when the source fails', async () => {
    const failing = async () => {
      throw new Error('down')
    }
    const a = await answer(await handle(post(RECORD_NAME, TYPE_TXT), failing))
    expect(a).toMatchObject({ rcode: 2, count: 0 })
  })

  it('refuses other methods', async () => {
    expect((await handle(new Request(URL, { method: 'PUT', body: 'x' }), async () => RECORD)).status).toBe(405)
  })

  it('refuses a body it cannot read', async () => {
    const r = await handle(new Request(URL, { method: 'POST', body: new Uint8Array(3) }), async () => RECORD)
    expect(r.status).toBe(400)
  })
})

function memory(initial: Record<string, Release> = {}): Store & { puts: [string, number][] } {
  const data = new Map(Object.entries(initial))
  const puts: [string, number][] = []
  return {
    puts,
    async get(key) {
      return data.get(key) ?? null
    },
    async put(key, value, ttl) {
      puts.push([key, ttl])
      data.set(key, value)
    },
  }
}

/* A GitHub and GHCR that answer `tag`, or 503 when `down`. Counts the releases page. */
function source(tag: string | null, state = { reads: 0 }) {
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/releases/latest')) {
      state.reads++
      if (!tag) return new Response('', { status: 503 })
      return new Response(null, { status: 302, headers: { location: `https://github.com/x/releases/tag/${tag}` } })
    }
    if (url.endsWith('/package.json')) return Response.json({ technitiumServerMinimum: '15.5' })
    if (url.startsWith('https://ghcr.io/token')) return Response.json({ token: 't' })
    if (url.endsWith('/manifests/latest')) {
      return new Response(null, { headers: { 'docker-content-digest': 'sha256:latest' } })
    }
    if (tag === 'v1.5.0') return new Response(null, { status: 404 })
    return new Response(null, { headers: { 'docker-content-digest': 'sha256:latest' } })
  }) as typeof fetch
  return { fn, state }
}

describe('lookup', () => {
  it('reads once an hour', async () => {
    const store = memory()
    const { fn, state } = source('v1.4.0')
    expect(await lookup(fn, store)).toEqual(RECORD)
    expect(await lookup(fn, store)).toEqual(RECORD)
    expect(state.reads).toBe(1)
    expect(store.puts).toEqual([
      ['fresh', 3600],
      ['last', 30 * 24 * 3600],
    ])
  })

  it('serves the last good record when the source fails', async () => {
    const { fn } = source(null)
    expect(await lookup(fn, memory({ last: RECORD }))).toEqual(RECORD)
  })

  it('passes the last record on while the image is missing', async () => {
    const { fn } = source('v1.5.0')
    expect(await lookup(fn, memory({ last: RECORD }))).toEqual(RECORD)
  })
})
