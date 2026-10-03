import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import * as api from '../../api/dashboard'
import { LIVE_POLL_MS, useLive } from './useLive'
import { zero } from './live'

let hidden = false
beforeEach(() => {
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(Date.UTC(2026, 9, 3, 19, 42, 10))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const ok = (q: number, uptimestamp = 'u1') => ({
  kind: 'ok' as const,
  data: { uptimestamp, lifetimeCounters: { ...zero(), totalQueries: q, totalClients: 1 } },
})
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(LIVE_POLL_MS) })

describe('useLive', () => {
  it('reads at once and every 2 s; the first reading is the baseline', async () => {
    const spy = vi.spyOn(api, 'getMetrics')
      .mockResolvedValueOnce(ok(50)).mockResolvedValueOnce(ok(53)).mockResolvedValue(ok(54))
    const { result } = renderHook(() => useLive({ token: 't', targets: [''], epoch: 1, active: true }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(0)
    await tick()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(3)
    await tick()
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(4)
  })

  it('asks each target with its node and adds them up', async () => {
    const spy = vi.spyOn(api, 'getMetrics').mockImplementation(async (_t, node) =>
      node === 'a' ? ok(spy.mock.calls.filter((c) => c[1] === 'a').length * 10) : ok(spy.mock.calls.filter((c) => c[1] === 'b').length),
    )
    const { result } = renderHook(() => useLive({ token: 't', targets: ['a', 'b'], epoch: 1, active: true }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await tick()
    expect(spy.mock.calls.map((c) => c[1]).sort()).toEqual(['a', 'a', 'b', 'b'])
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(11)
  })

  it('the empty target goes without a node', async () => {
    const spy = vi.spyOn(api, 'getMetrics').mockResolvedValue(ok(1))
    renderHook(() => useLive({ token: 't', targets: [''], epoch: 1, active: true }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(spy.mock.calls[0][1]).toBeUndefined()
  })

  it('never overlaps: a slow reading delays the next one', async () => {
    let finish!: (v: ReturnType<typeof ok>) => void
    const spy = vi.spyOn(api, 'getMetrics')
      .mockReturnValueOnce(new Promise((r) => { finish = r }) as never)
      .mockResolvedValue(ok(1))
    renderHook(() => useLive({ token: 't', targets: [''], epoch: 1, active: true }))
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(spy).toHaveBeenCalledTimes(1)
    await act(async () => { finish(ok(1)); await vi.advanceTimersByTimeAsync(LIVE_POLL_MS) })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('three failures in a row stop it; a new epoch starts it again', async () => {
    const spy = vi.spyOn(api, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'Not found' })
    const { rerender } = renderHook((p: { epoch: number }) => useLive({ token: 't', targets: [''], epoch: p.epoch, active: true }), { initialProps: { epoch: 1 } })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await tick(); await tick(); await tick(); await tick()
    expect(spy).toHaveBeenCalledTimes(3)
    rerender({ epoch: 2 })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(spy).toHaveBeenCalledTimes(4)
  })

  it('a new epoch empties the minutes and takes a new baseline', async () => {
    vi.spyOn(api, 'getMetrics').mockResolvedValueOnce(ok(10)).mockResolvedValueOnce(ok(15)).mockResolvedValue(ok(20))
    const { result, rerender } = renderHook((p: { epoch: number }) => useLive({ token: 't', targets: [''], epoch: p.epoch, active: true }), { initialProps: { epoch: 1 } })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await tick()
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(5)
    rerender({ epoch: 2 })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    /* The new baseline opens the current minute with nothing in it. */
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(0)
    await tick()
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(0)
  })

  it('inactive, it reads nothing', async () => {
    const spy = vi.spyOn(api, 'getMetrics').mockResolvedValue(ok(1))
    renderHook(() => useLive({ token: 't', targets: [''], epoch: 1, active: false }))
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(spy).not.toHaveBeenCalled()
  })

  it('with the tab hidden it reads nothing, and the time away is not counted', async () => {
    const spy = vi.spyOn(api, 'getMetrics')
      .mockResolvedValueOnce(ok(10)).mockResolvedValueOnce(ok(500)).mockResolvedValue(ok(501))
    const { result } = renderHook(() => useLive({ token: 't', targets: [''], epoch: 1, active: true }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    hidden = true
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(spy).toHaveBeenCalledTimes(1)
    hidden = false
    await tick()
    await tick()
    expect(spy).toHaveBeenCalledTimes(3)
    /* 500 was a fresh baseline after the time away; only 501 - 500 counts. */
    expect(result.current.reduce((n, m) => n + m.counts.totalQueries, 0)).toBe(1)
  })
})
