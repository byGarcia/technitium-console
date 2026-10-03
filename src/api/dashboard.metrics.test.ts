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

  it('the ten live keys are the summable counters, Clients excluded', () => {
    expect(LIVE_KEYS).toEqual([
      'totalQueries', 'totalNoError', 'totalServerFailure', 'totalNxDomain', 'totalRefused',
      'totalAuthoritative', 'totalRecursive', 'totalCached', 'totalBlocked', 'totalDropped',
    ])
  })
})
