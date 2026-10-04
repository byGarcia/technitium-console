import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from './client'
import { getMetrics, LIVE_KEYS } from './dashboard'

afterEach(() => vi.restoreAllMocks())

const RESPONSE = {
  uptimestamp: '2026-10-03T19:12:21.2010965Z',
  uptimeSeconds: 1609,
  lifetimeCounters: {
    totalQueries: 50, totalNoError: 16, totalServerFailure: 19, totalNxDomain: 15, totalRefused: 0,
    totalAuthoritative: 25, totalRecursive: 19, totalCached: 0, totalBlocked: 6, totalDropped: 0,
    totalClients: 2,
  },
}

describe('getMetrics', () => {
  it('asks dashboard/metrics/json of the given node and unwraps `response`', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { response: RESPONSE } } as never)
    const r = await getMetrics('tok', 'node2.example')
    expect(spy).toHaveBeenCalledWith('dashboard/metrics/json', { token: 'tok', node: 'node2.example' })
    expect(r).toEqual({ kind: 'ok', data: RESPONSE })
  })

  it('passes a failure through as it came', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' })
    expect(await getMetrics('tok')).toEqual({ kind: 'error', message: 'boom' })
  })

  it('a response of another shape is a failure, not a crash', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { response: { uptimestamp: 'x' } } } as never)
    expect((await getMetrics('tok')).kind).toBe('error')
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: {} } as never)
    expect((await getMetrics('tok')).kind).toBe('error')
  })

  it('the ten live keys are the summable counters, Clients excluded', () => {
    expect(LIVE_KEYS).toEqual([
      'totalQueries', 'totalNoError', 'totalServerFailure', 'totalNxDomain', 'totalRefused',
      'totalAuthoritative', 'totalRecursive', 'totalCached', 'totalBlocked', 'totalDropped',
    ])
  })

  it.each([undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, '50'])('rejects an invalid live counter: %s', async (counter) => {
    const malformed = { ...RESPONSE, lifetimeCounters: { ...RESPONSE.lifetimeCounters, totalQueries: counter } }
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { response: malformed } } as never)
    expect((await getMetrics('tok')).kind).toBe('error')
  })

  it('requires the restart marker to distinguish counter generations', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { response: { ...RESPONSE, uptimestamp: undefined } } } as never)
    expect((await getMetrics('tok')).kind).toBe('error')
  })
})
