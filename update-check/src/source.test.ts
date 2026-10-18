// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatRecord, readRelease, type Release } from './source.ts'

const RELEASES = 'https://github.com/byGarcia/technitium-console/releases/latest'
const TOKEN = 'https://ghcr.io/token?scope=repository:bygarcia/technitium-console:pull'

interface Fake {
  tag?: string
  pkg?: unknown
  pkgStatus?: number
  image?: number
  /** The digest `latest` points at; by default the same as the release's. */
  latestDigest?: string
  releases?: number
}

function fakeFetch({
  tag = 'v1.4.0',
  pkg = { technitiumServerMinimum: '15.5' },
  pkgStatus = 200,
  image = 200,
  latestDigest = 'sha256:new',
  releases = 302,
}: Fake) {
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
      return pkgStatus === 200 ? Response.json(pkg) : new Response('', { status: pkgStatus })
    }
    if (url === TOKEN) return Response.json({ token: 'anon' })
    if (url.endsWith('/manifests/latest')) {
      return new Response(null, { status: 200, headers: { 'docker-content-digest': latestDigest } })
    }
    if (url.startsWith('https://ghcr.io/v2/bygarcia/technitium-console/manifests/')) {
      return new Response(null, { status: image, headers: image === 200 ? { 'docker-content-digest': 'sha256:new' } : {} })
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

  /* The image job pushes X.Y.Z first and moves latest only after checking the
     bytes of every platform; the README's compose file pulls latest. */
  it('announces the previous release until latest points at its image', async () => {
    const { fn } = fakeFetch({ latestDigest: 'sha256:old' })
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

  /* A rate limit is a failure, not an answer: the caller must keep serving
     what it had. raw.githubusercontent.com limits per IP, and Cloudflare's
     outgoing addresses are shared. */
  it('throws when GitHub rate-limits the releases page', async () => {
    await expect(readRelease(fakeFetch({ releases: 429 }).fn, previous)).rejects.toThrow()
  })

  it('throws when GitHub rate-limits the raw file', async () => {
    await expect(readRelease(fakeFetch({ pkgStatus: 429 }).fn, previous)).rejects.toThrow()
  })

  it('announces nothing when the tag has no package.json', async () => {
    expect(await readRelease(fakeFetch({ pkgStatus: 404 }).fn, previous)).toBeNull()
  })
})
