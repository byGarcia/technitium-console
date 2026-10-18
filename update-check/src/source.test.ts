// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatRecord, readRelease, type Release } from './source.ts'

const RELEASES = 'https://github.com/byGarcia/technitium-console/releases/latest'
const TOKEN = 'https://ghcr.io/token?scope=repository:bygarcia/technitium-console:pull'

interface Fake {
  tag?: string
  pkg?: unknown
  image?: number
  releases?: number
}

function fakeFetch({ tag = 'v1.4.0', pkg = { technitiumServerMinimum: '15.5' }, image = 200, releases = 302 }: Fake) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url === RELEASES) {
      if (releases !== 302) return new Response('', { status: releases })
      return new Response(null, {
        status: 302,
        headers: { location: `https://github.com/byGarcia/technitium-console/releases/tag/${tag}` },
      })
    }
    if (url === `https://raw.githubusercontent.com/byGarcia/technitium-console/${tag}/package.json`) {
      return Response.json(pkg)
    }
    if (url === TOKEN) return Response.json({ token: 'anon' })
    if (url.startsWith('https://ghcr.io/v2/bygarcia/technitium-console/manifests/')) {
      return new Response(null, { status: image })
    }
    return new Response('', { status: 404 })
  }) as typeof fetch
  return { fn, calls }
}

const previous: Release = { latest: '1.3.2', server: '15.5' }

describe('readRelease', () => {
  it('reads the latest release and its server minimum', async () => {
    const { fn, calls } = fakeFetch({})
    const r = await readRelease(fn, null)
    expect(r).toEqual({ latest: '1.4.0', server: '15.5' })
    expect(formatRecord(r!)).toBe('v=1 latest=1.4.0 server=15.5')

    expect(calls.find((c) => c.url === RELEASES)?.init?.redirect).toBe('manual')
    const head = calls.find((c) => c.url.endsWith('/manifests/1.4.0'))
    expect(head?.init?.method).toBe('HEAD')
    expect(new Headers(head?.init?.headers).get('authorization')).toBe('Bearer anon')
    expect(calls.some((c) => c.url.includes('api.github.com'))).toBe(false)
  })

  it('announces the previous release while the image is missing', async () => {
    const { fn } = fakeFetch({ image: 404 })
    expect(await readRelease(fn, previous)).toEqual(previous)
  })

  it('announces nothing for a tag without the field', async () => {
    const { fn } = fakeFetch({ pkg: {} })
    expect(await readRelease(fn, previous)).toBeNull()
  })

  it('refuses a malformed tag or minimum', async () => {
    expect(await readRelease(fakeFetch({ tag: 'v1.4' }).fn, null)).toBeNull()
    expect(await readRelease(fakeFetch({ pkg: { technitiumServerMinimum: '15.5; rm' } }).fn, null)).toBeNull()
  })

  it('throws when GitHub fails', async () => {
    await expect(readRelease(fakeFetch({ releases: 503 }).fn, null)).rejects.toThrow()
  })
})
