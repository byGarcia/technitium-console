import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowDomain, blockDomain, mergeRecent, readRuleExport, recentBlocked } from './blocking'
import { onSessionExpired } from './client'
import * as logs from './logs'
import type { QueryLogEntry } from './logs'
import * as zonelists from './zonelists'

afterEach(() => vi.restoreAllMocks())

function serve(body: string) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body))
}

describe('readRuleExport', () => {
  it('asks for the export with the session token and splits the lines', async () => {
    const spy = serve('ads.example.com\r\ndoubleclick.net\n\n')
    const r = await readRuleExport('blocked', 'T')
    expect(r).toEqual({ kind: 'ok', data: ['ads.example.com', 'doubleclick.net'] })
    const [url, init] = spy.mock.calls[0]
    expect(String(url)).toMatch(/api\/blocked\/export$/)
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer T' })
  })

  it('an empty list is an empty array, not an error', async () => {
    serve('')
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'ok', data: [] })
  })

  it('a JSON error answer is an error with the server message', async () => {
    serve(JSON.stringify({ status: 'error', errorMessage: 'Access was denied.' }))
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'error', message: 'Access was denied.' })
  })

  it('an expired session is reported as such', async () => {
    serve(JSON.stringify({ status: 'invalid-token' }))
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'invalid-token' })
  })

  it('an expired session ends the session, like every other call', async () => {
    const ended = vi.fn()
    onSessionExpired(ended)
    try {
      serve(JSON.stringify({ status: 'invalid-token' }))
      await readRuleExport('blocked', 'T')
      expect(ended).toHaveBeenCalledOnce()
    } finally {
      onSessionExpired(null)
    }
  })

  it('an answer that is neither the list nor an envelope (a proxy page) is an error, as jQuery reports it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body>502 Bad Gateway</body></html>', { status: 502, statusText: 'Bad Gateway' }),
    )
    expect(await readRuleExport('blocked', 'T')).toEqual({ kind: 'error', message: 'error - Bad Gateway' })
  })

  it('a failing answer without a status text falls to upstream sentence, as jQuery does', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>…</html>', { status: 502 }))
    expect(await readRuleExport('blocked', 'T')).toEqual({
      kind: 'error',
      message: 'Unable to connect to the server. Please try again.',
    })
  })

  it('reads the envelope exactly as apiRequest does', async () => {
    serve(JSON.stringify({ status: 'error' }))
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'error', message: 'Unknown error.' })
    vi.restoreAllMocks()
    serve(JSON.stringify({ status: '2fa-required' }))
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'two-factor-required' })
  })

  /* I1: after a change the rules are read back from the PRIMARY node, as the tree
     does (other-zones.js:269, 434). The node travels as apiRequest sends it. */
  it('asks the node given, as apiRequest sends it', async () => {
    const spy = serve('ads.example.com')
    await readRuleExport('blocked', 'T', 'dev.cluster.test')
    expect(String(spy.mock.calls[0][0])).toMatch(/api\/blocked\/export\?node=dev\.cluster\.test$/)
  })

  it('sends no node for this server, nor for the aggregate', async () => {
    const spy = serve('')
    await readRuleExport('blocked', 'T', '')
    await readRuleExport('allowed', 'T', 'cluster')
    expect(String(spy.mock.calls[0][0])).toMatch(/api\/blocked\/export$/)
    expect(String(spy.mock.calls[1][0])).toMatch(/api\/allowed\/export$/)
  })

  /* M5: a reverse proxy's 200 page (an auth wall, a captive portal) is not a list
     of zones; apiRequest would have said parsererror, and so does this. */
  it('a 2xx page that is not plain zone lines is an error, not rules', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!doctype html><title>Sign in</title>', { headers: { 'Content-Type': 'text/html' } }),
    )
    const r = await readRuleExport('blocked', 'T')
    expect(r.kind).toBe('error')
    expect(r.kind === 'error' && r.message).toMatch(/^parsererror - /)
  })

  it('a body starting with < is refused even when it claims to be plain text', async () => {
    serve('<html><body>Login</body></html>')
    const r = await readRuleExport('blocked', 'T')
    expect(r.kind === 'error' && r.message).toMatch(/^parsererror - /)
  })

  it('a 2xx with another content type is refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ads.example.com', { headers: { 'Content-Type': 'application/octet-stream' } }),
    )
    expect((await readRuleExport('blocked', 'T')).kind).toBe('error')
  })

  it('the server answer, text/plain with no charset, is read as lines', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ads.example.com\n', { headers: { 'Content-Type': 'text/plain' } }),
    )
    expect(await readRuleExport('blocked', 'T')).toEqual({ kind: 'ok', data: ['ads.example.com'] })
  })

  it('a request that never arrives uses upstream sentence', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('down'))
    expect(await readRuleExport('allowed', 'T')).toEqual({
      kind: 'error',
      message: 'Unable to connect to the server. Please try again.',
    })
  })
})

function entry(timestamp: string, qname: string, responseType = 'Blocked'): QueryLogEntry {
  return {
    rowNumber: 1, timestamp, clientIpAddress: '192.168.1.2', protocol: 'Udp', responseType,
    rcode: 'NoError', qname, qtype: 'A', qclass: 'IN', answer: null,
  }
}

describe('mergeRecent', () => {
  it('joins the classes, newest first, and keeps the limit', () => {
    const a = [entry('2026-10-01T10:00:05Z', 'a'), entry('2026-10-01T10:00:01Z', 'b')]
    const b = [entry('2026-10-01T10:00:03Z', 'c', 'UpstreamBlocked')]
    expect(mergeRecent([a, b, null], 2).map((e) => e.qname)).toEqual(['a', 'c'])
  })
})

describe('recentBlocked', () => {
  const app = { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }
  const page = (entries: QueryLogEntry[]) =>
    ({ kind: 'ok' as const, data: { response: { pageNumber: 1, totalPages: 1, totalEntries: entries.length, entries } } })

  it('asks once per blocked class, newest first, ten per page, on the node given', async () => {
    const spy = vi.spyOn(logs, 'queryLogs').mockResolvedValue(page([]))
    await recentBlocked('T', app, 'node2')
    expect(spy.mock.calls.map(([, p]) => p.responseType)).toEqual(['Blocked', 'UpstreamBlocked', 'UpstreamBlockedCached'])
    expect(spy.mock.calls[0][1]).toMatchObject({
      name: app.name, classPath: app.classPath, pageNumber: '1', entriesPerPage: '10',
      descendingOrder: 'true', node: 'node2',
    })
  })

  it('says it is partial when one class fails, and keeps the others', async () => {
    vi.spyOn(logs, 'queryLogs')
      .mockResolvedValueOnce(page([entry('2026-10-01T10:00:00Z', 'x')]))
      .mockResolvedValueOnce({ kind: 'error', message: 'boom' })
      .mockResolvedValueOnce(page([]))
    const r = await recentBlocked('T', app, '')
    expect(r).toEqual({ kind: 'ok', data: { entries: [entry('2026-10-01T10:00:00Z', 'x')], partial: true } })
  })

  it('is an error when all three fail', async () => {
    vi.spyOn(logs, 'queryLogs').mockResolvedValue({ kind: 'error', message: 'boom' })
    expect(await recentBlocked('T', app, '')).toEqual({ kind: 'error', message: 'boom' })
  })
})

describe('allowDomain and blockDomain', () => {
  const OK = { kind: 'ok' as const, data: {} }

  it('Allow Domain deletes from Blocked and then adds to Allowed', async () => {
    const remove = vi.spyOn(zonelists, 'deleteDomain').mockResolvedValue(OK)
    const add = vi.spyOn(zonelists, 'addDomain').mockResolvedValue(OK)
    expect(await allowDomain('T', 'ads.test')).toEqual(OK)
    expect(remove).toHaveBeenCalledWith('blocked', 'T', 'ads.test')
    expect(add).toHaveBeenCalledWith('allowed', 'T', 'ads.test')
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(add.mock.invocationCallOrder[0])
  })

  it('Allow Domain stops if the delete fails', async () => {
    vi.spyOn(zonelists, 'deleteDomain').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    const add = vi.spyOn(zonelists, 'addDomain').mockResolvedValue(OK)
    expect(await allowDomain('T', 'ads.test')).toEqual({ kind: 'error', message: 'Access was denied.' })
    expect(add).not.toHaveBeenCalled()
  })

  it('when the delete goes through and the add fails, both return the add error', async () => {
    vi.spyOn(zonelists, 'deleteDomain').mockResolvedValue(OK)
    vi.spyOn(zonelists, 'addDomain').mockResolvedValue({ kind: 'error', message: 'Invalid domain name.' })
    expect(await allowDomain('T', 'x.test')).toEqual({ kind: 'error', message: 'Invalid domain name.' })
    expect(await blockDomain('T', 'x.test')).toEqual({ kind: 'error', message: 'Invalid domain name.' })
  })

  it('Block Domain deletes from Allowed and then adds to Blocked, and stops if the delete fails', async () => {
    vi.spyOn(zonelists, 'deleteDomain').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    const add = vi.spyOn(zonelists, 'addDomain').mockResolvedValue(OK)
    expect(await blockDomain('T', 'x.test')).toEqual({ kind: 'error', message: 'Access was denied.' })
    expect(add).not.toHaveBeenCalled()
  })
})
