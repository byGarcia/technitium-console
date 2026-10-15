import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { Shell, type ShellSession } from './Shell'
import { ThemeProvider } from '../theme/ThemeProvider'
import * as client from '../api/client'
import * as settings from '../api/settings'
import type { DnsSettings } from '../api/settings'
import { settingsChanged } from '../lib/settings-signal'
import { forgetRoot } from './route'

/*
The sidebar's mark on Blocking (`BlockingMark.tsx`, `blocking-state.ts`): drawn when
blocking is disabled or paused, with the time it comes back in the link's name and
title, and nothing when the session cannot read the setting.
*/

function session(settingsView = true, settingsModify = true): ShellSession {
  const all = ['Dashboard', 'Zones', 'Cache', 'Allowed', 'Blocked', 'Apps', 'DnsClient', 'Settings', 'DhcpServer', 'Administration', 'Logs']
  return {
    token: 'tok',
    displayName: 'Administrator',
    username: 'admin',
    info: {
      version: '15.6',
      uptimestamp: '2026-10-15T08:00:00Z',
      dnsServerDomain: 'dns.example.net',
      permissions: Object.fromEntries(all.map((s) => [
        s,
        s === 'Settings'
          ? { canView: settingsView, canModify: settingsModify, canDelete: false }
          : { canView: true, canModify: true, canDelete: true },
      ])),
    },
  }
}

function mount(s = session()) {
  return render(<ThemeProvider><Shell session={s} onLogout={() => {}} /></ThemeProvider>)
}

const entry = () => within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('link', { name: /^Blocking/ })

beforeEach(() => {
  localStorage.clear()
  forgetRoot()
  window.history.replaceState(null, '', '/about/')
  vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: {} } } as never)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Shell: the Blocking mark', () => {
  it('none while blocking is on', async () => {
    const read = vi.spyOn(settings, 'getSettings').mockResolvedValue({ enableBlocking: true } as DnsSettings)
    mount()
    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    expect(entry()).toHaveAccessibleName('Blocking')
    expect(entry()).not.toHaveAttribute('title')
  })

  it('disabled: Off, and the name says so', async () => {
    vi.spyOn(settings, 'getSettings').mockResolvedValue({ enableBlocking: false } as DnsSettings)
    mount()
    await vi.waitFor(() => expect(entry()).toHaveAccessibleName('Blocking, disabled'))
    expect(entry()).toHaveTextContent('Off')
    expect(entry()).toHaveAttribute('title', 'Blocking, disabled')
  })

  it('paused: the time it comes back in the name and the title, and it goes when the pause ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 15, 14, 0, 0))
    const till = new Date(2026, 9, 15, 14, 5, 0).toISOString()
    vi.spyOn(settings, 'getSettings')
      .mockResolvedValueOnce({ enableBlocking: false, temporaryDisableBlockingTill: till } as DnsSettings)
      .mockResolvedValue({ enableBlocking: true } as DnsSettings)
    mount()
    await vi.waitFor(() => expect(entry()).toHaveAccessibleName('Blocking, paused until 14:05'))
    expect(entry()).toHaveAttribute('title', 'Blocking, paused until 14:05')
    expect(entry()).toHaveTextContent('Paused')
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000))
    await vi.waitFor(() => expect(entry()).toHaveAccessibleName('Blocking'))
  })

  it('follows a change made elsewhere in the console', async () => {
    vi.spyOn(settings, 'getSettings')
      .mockResolvedValueOnce({ enableBlocking: true } as DnsSettings)
      .mockResolvedValue({ enableBlocking: false } as DnsSettings)
    mount()
    await vi.waitFor(() => expect(settings.getSettings).toHaveBeenCalledTimes(1))
    act(() => settingsChanged())
    await vi.waitFor(() => expect(entry()).toHaveAccessibleName('Blocking, disabled'))
  })

  it('without Settings.canView it reads nothing and marks nothing', async () => {
    const read = vi.spyOn(settings, 'getSettings').mockResolvedValue({ enableBlocking: false } as DnsSettings)
    mount(session(false, false))
    act(() => settingsChanged())
    expect(read).not.toHaveBeenCalled()
    expect(entry()).toHaveAccessibleName('Blocking')
  })
})
