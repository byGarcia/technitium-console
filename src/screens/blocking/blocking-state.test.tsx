import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import * as settings from '../../api/settings'
import * as client from '../../api/client'
import type { DnsSettings } from '../../api/settings'
import { settingsChanged } from '../../lib/settings-signal'
import { blockingMark, stateOf, useBlockingState } from './blocking-state'
import type { Permissions } from './permissions'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const S = (canView: boolean, canModify: boolean) => ({ Settings: { canView, canModify, canDelete: false } })

function Probe({ permissions, enabled }: { permissions?: Permissions; enabled?: boolean }) {
  const { state } = useBlockingState('T', permissions, enabled)
  return <output>{state == null ? 'none' : state === 'failed' ? 'failed' : state.kind}</output>
}

describe('blocking state', () => {
  it('reads on, paused and off as the Overview does', () => {
    expect(stateOf(true, null)).toEqual({ kind: 'on' })
    expect(stateOf(false, '2099-01-01T00:00:00Z')).toEqual({ kind: 'paused', till: '2099-01-01T00:00:00Z' })
    expect(stateOf(false, '2000-01-01T00:00:00Z')).toEqual({ kind: 'off' })
    expect(stateOf(false, undefined)).toEqual({ kind: 'off' })
  })

  it('marks disabled and paused, with the time it comes back in the label', () => {
    const now = new Date(2026, 9, 15, 14, 0)
    const till = new Date(2026, 9, 15, 14, 30).toISOString()
    expect(blockingMark({ kind: 'on' }, undefined)).toBeNull()
    expect(blockingMark(null, undefined)).toBeNull()
    expect(blockingMark('failed', undefined)).toBeNull()
    expect(blockingMark({ kind: 'off' }, undefined)).toEqual({ text: 'Off', label: 'Blocking, disabled', tone: 'neutral' })
    expect(blockingMark({ kind: 'paused', till }, undefined, now)).toEqual({
      text: 'Paused', label: 'Blocking, paused until 14:30', tone: 'acc',
    })
    // Tomorrow carries the date; without Modify the amber goes, as the padlock wins.
    const late = new Date(2026, 9, 16, 1, 30).toISOString()
    expect(blockingMark({ kind: 'paused', till: late }, S(true, false), now)).toEqual({
      text: 'Paused', label: 'Blocking, paused until 2026-10-16 01:30', tone: 'neutral',
    })
  })

  it('reads again when this console writes the settings', async () => {
    const read = vi.spyOn(settings, 'getSettings')
      .mockResolvedValueOnce({ enableBlocking: true } as DnsSettings)
      .mockResolvedValue({ enableBlocking: false } as DnsSettings)
    render(<Probe />)
    expect(await screen.findByText('on')).toBeInTheDocument()
    act(() => settingsChanged())
    expect(await screen.findByText('off')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('a successful settings/set or temporaryDisableBlocking is such a write; a failed one is not', async () => {
    const heard = vi.fn()
    const { onSettingsChanged } = await import('../../lib/settings-signal')
    const stop = onSettingsChanged(heard)
    const request = vi.spyOn(client, 'apiRequest')
    request.mockResolvedValueOnce({ kind: 'error', message: 'no' })
    await settings.setSettings('T', { enableBlocking: 'false' })
    expect(heard).not.toHaveBeenCalled()
    request.mockResolvedValueOnce({ kind: 'ok', data: { response: {}, server: 'x' } })
    await settings.setSettings('T', { enableBlocking: 'false' })
    request.mockResolvedValueOnce({ kind: 'ok', data: { response: { temporaryDisableBlockingTill: 'x' } } })
    await settings.temporaryDisableBlocking('T', '5')
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
  })

  it('reads again a second after a pause ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const read = vi.spyOn(settings, 'getSettings')
      .mockResolvedValueOnce({ enableBlocking: false, temporaryDisableBlockingTill: new Date(Date.now() + 60_000).toISOString() } as DnsSettings)
      .mockResolvedValue({ enableBlocking: true } as DnsSettings)
    render(<Probe />)
    expect(await screen.findByText('paused')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(60_500))
    expect(read).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(1_000))
    expect(await screen.findByText('on')).toBeInTheDocument()
  })

  it('an older answer arriving last does not win', async () => {
    let first: (s: DnsSettings) => void = () => {}
    vi.spyOn(settings, 'getSettings')
      .mockImplementationOnce(() => new Promise((r) => { first = r }))
      .mockResolvedValue({ enableBlocking: false } as DnsSettings)
    render(<Probe />)
    act(() => settingsChanged())
    expect(await screen.findByText('off')).toBeInTheDocument()
    await act(async () => first({ enableBlocking: true } as DnsSettings))
    expect(screen.getByText('off')).toBeInTheDocument()
  })

  it('without Settings.canView, or disabled, it reads nothing, even on a write', async () => {
    const read = vi.spyOn(settings, 'getSettings').mockResolvedValue({ enableBlocking: false } as DnsSettings)
    render(<><Probe permissions={S(false, false)} /><Probe enabled={false} /></>)
    act(() => settingsChanged())
    expect(screen.getAllByText('none')).toHaveLength(2)
    expect(read).not.toHaveBeenCalled()
  })
})
