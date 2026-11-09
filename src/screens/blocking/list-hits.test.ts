import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as logs from '../../api/logs'
import {
  BLOCKED_MAX_PAGES, cachedReport, clearReportCache, countLists, isLoopbackClient,
  namesToCount, readBlockedLog, storeReport,
} from './list-hits'
import type { BlockReason } from './check-domain'

beforeEach(() => {
  clearReportCache()
  vi.restoreAllMocks()
})

const list = (url: string, domain: string, group?: string): BlockReason => ({
  source: 'list', url, domain, ...(group != null ? { group } : {}),
})

describe('isLoopbackClient', () => {
  it.each([
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    '[::1]',
    '[::1%eth0]',
    '127.0.0.1:53',
    ' 127.0.0.1 ',
    '0:0:0:0:0:0:0:1',
  ])('%s is the server itself', (ip) => {
    expect(isLoopbackClient(ip)).toBe(true)
  })

  it('a client address is counted', () => {
    expect(isLoopbackClient('10.0.0.5')).toBe(false)
    expect(isLoopbackClient('')).toBe(false)
    expect(isLoopbackClient(null)).toBe(false)
  })
})

describe('namesToCount', () => {
  it('drops loopback before counting, and folds one name written two ways', () => {
    const logged = namesToCount([
      { clientIpAddress: '127.0.0.1', qname: 'ads.example' },
      { clientIpAddress: '10.0.0.5', qname: 'Ads.Example.' },
      { clientIpAddress: '10.0.0.5', qname: 'ads.example' },
      { clientIpAddress: '::1', qname: 'other.test' },
      { clientIpAddress: '10.1.1.1', qname: '' },
    ])
    expect(logged).toEqual({
      blockedQueries: 3,
      skippedLoopback: 2,
      unnamedHits: 1,
      names: [{ name: 'ads.example', hits: 2 }],
    })
  })
})

describe('countLists', () => {
  it('counts a name on two built-in lists on both, and credits an app report to the one list it named', () => {
    const result = countLists(
      [
        { name: 'a.test', hits: 3 },
        { name: 'b.test', hits: 1 },
        { name: 'c.test', hits: 2 },
        { name: 'd.test', hits: 4 },
      ],
      new Map([
        ['a.test', { ok: true, reasons: [list('https://h/one', 'a.test'), list('https://h/two', 'a.test'), list('https://h/one', 'a.test')] }],
        ['b.test', { ok: true, reasons: [list('https://h/one', 'b.test', 'ads')] }],
        ['c.test', { ok: true, reasons: [{ source: 'rule', domain: 'c.test' }] }],
        ['d.test', { ok: false, reasons: [] }],
      ]),
    )
    expect(result.lists).toEqual([
      { url: 'https://h/one', group: null, app: false, hits: 3, domains: 1 },
      { url: 'https://h/two', group: null, app: false, hits: 3, domains: 1 },
      { url: 'https://h/one', group: 'ads', app: false, hits: 1, domains: 1 },
    ])
    expect(result.unmatched).toEqual({ hits: 2, domains: 1 })
    expect(result.unresolved).toEqual({ hits: 4, domains: 1 })
  })

  it('an app report with no URL is one row, named by its group', () => {
    const result = countLists(
      [{ name: 'z.test', hits: 5 }],
      new Map([['z.test', { ok: true, reasons: [{ source: 'app', domain: 'z.test', group: 'kids' }] }]]),
    )
    expect(result.lists).toEqual([{ url: '', group: 'kids', app: true, hits: 5, domains: 1 }])
  })
})

describe('the report cache', () => {
  const named: BlockReason[] = [list('https://h/one', 'a.test')]

  it('keeps a named report for 30 minutes, an empty one for 10, and a failure for a minute', () => {
    storeReport('', 'named.test', { ok: true, reasons: named }, 1_000)
    storeReport('', 'empty.test', { ok: true, reasons: [] }, 1_000)
    storeReport('', 'failed.test', { ok: false, reasons: [] }, 1_000)
    expect(cachedReport('', 'named.test', 1_000 + 30 * 60_000 - 1)?.reasons).toEqual(named)
    expect(cachedReport('', 'named.test', 1_000 + 30 * 60_000)).toBeNull()
    expect(cachedReport('', 'empty.test', 1_000 + 10 * 60_000 - 1)).not.toBeNull()
    expect(cachedReport('', 'empty.test', 1_000 + 10 * 60_000)).toBeNull()
    expect(cachedReport('', 'failed.test', 1_000 + 60_000 - 1)).not.toBeNull()
    expect(cachedReport('', 'failed.test', 1_000 + 60_000)).toBeNull()
  })

  it('keeps one node apart from another, and drops the oldest past 2000 names', () => {
    storeReport('n1', 'a.test', { ok: true, reasons: [] }, 1_000)
    expect(cachedReport('', 'a.test', 1_000)).toBeNull()
    for (let i = 0; i < 2000; i++) storeReport('', `n${i}.test`, { ok: true, reasons: [] }, 1_000)
    storeReport('', 'n1.test', { ok: false, reasons: [] }, 1_000)
    expect(cachedReport('', 'n0.test', 1_000)).not.toBeNull()
    expect(cachedReport('', 'n1.test', 1_000)?.ok).toBe(false)
    storeReport('', 'extra.test', { ok: true, reasons: [] }, 1_000)
    expect(cachedReport('', 'n0.test', 1_000)).toBeNull()
    expect(cachedReport('', 'extra.test', 1_000)).not.toBeNull()
    expect(cachedReport('', 'n1.test', 1_000)).not.toBeNull()
  })
})

describe('readBlockedLog', () => {
  const app = { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }
  const entry = {
    rowNumber: 1, timestamp: '2026-11-09T12:00:00Z', clientIpAddress: '10.0.0.5', protocol: 'Udp',
    responseType: 'Blocked', rcode: 'NxDomain', qname: 'ads.example', qtype: 'A', qclass: 'IN', answer: null,
  }

  it('reads Blocked, newest first, a thousand at a time', async () => {
    const query = vi.spyOn(logs, 'queryLogs').mockResolvedValue({
      kind: 'ok',
      data: { response: { pageNumber: 1, totalPages: 1, totalEntries: 1, entries: [entry] } },
    })
    const out = await readBlockedLog('T', app, 'node-a')
    expect(out).toEqual({ kind: 'ok', data: { entries: [entry], truncated: false } })
    expect(query).toHaveBeenCalledWith('T', expect.objectContaining({
      responseType: 'Blocked', entriesPerPage: '1000', descendingOrder: 'true', pageNumber: '1', node: 'node-a',
    }))
  })

  it('a failed first page is the failure, and a later failed page keeps what was read', async () => {
    const query = vi.spyOn(logs, 'queryLogs')
      .mockResolvedValueOnce({ kind: 'error', message: 'no log' })
    expect(await readBlockedLog('T', app, '')).toEqual({ kind: 'error', message: 'no log' })
    query.mockReset()
    query
      .mockResolvedValueOnce({ kind: 'ok', data: { response: { pageNumber: 1, totalPages: 2, totalEntries: 2, entries: [entry] } } })
      .mockResolvedValueOnce({ kind: 'error', message: 'later' })
    expect(await readBlockedLog('T', app, '')).toEqual({ kind: 'ok', data: { entries: [entry], truncated: true } })
  })

  it('stops after the page cap and says the newest queries are the ones counted', async () => {
    vi.spyOn(logs, 'queryLogs').mockImplementation(async (_token, params) => ({
      kind: 'ok',
      data: {
        response: {
          pageNumber: Number(params.pageNumber),
          totalPages: BLOCKED_MAX_PAGES + 1,
          totalEntries: BLOCKED_MAX_PAGES + 1,
          entries: [entry],
        },
      },
    }))
    const out = await readBlockedLog('T', app, '')
    expect(out.kind === 'ok' && out.data.truncated).toBe(true)
    expect(out.kind === 'ok' && out.data.entries).toHaveLength(BLOCKED_MAX_PAGES)
  })
})
