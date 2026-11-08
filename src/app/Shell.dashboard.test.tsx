import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Shell, type ShellSession } from './Shell'
import { ThemeProvider } from '../theme/ThemeProvider'
import * as client from '../api/client'
import * as dashboard from '../api/dashboard'
import { forgetRoot } from './route'

/* Refresh lives inside the Dashboard, so a session without `Dashboard: View`, which
   the Shell never takes there (main.js:119-250), has no such control and reads nothing. */
function session(canView: boolean): ShellSession {
  const all = ['Dashboard', 'Zones', 'Cache', 'Allowed', 'Blocked', 'Apps', 'DnsClient', 'Settings', 'DhcpServer', 'Administration', 'Logs']
  return {
    token: 'tok',
    displayName: 'Administrator',
    username: 'admin',
    info: {
      version: '15.6',
      uptimestamp: '2026-11-08T08:00:00Z',
      dnsServerDomain: 'dns.example.net',
      permissions: Object.fromEntries(all.map((s) => [
        s,
        { canView: s === 'Dashboard' ? canView : true, canModify: true, canDelete: true },
      ])),
    },
  }
}

const mount = (canView: boolean) =>
  render(<ThemeProvider><Shell session={session(canView)} onLogout={() => {}} /></ThemeProvider>)

let stats: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  localStorage.clear()
  forgetRoot()
  window.history.replaceState(null, '', '/')
  vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: {} } } as never)
  stats = vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'not stubbed' })
})
afterEach(() => vi.restoreAllMocks())

describe('Shell: Refresh on the Dashboard', () => {
  it('is there with Dashboard: View', async () => {
    mount(true)
    expect(await screen.findByRole('group', { name: 'Period' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('without Dashboard: View there is no Dashboard, so no Refresh and no read', async () => {
    mount(false)
    await screen.findByRole('heading', { name: 'Zones' })
    expect(screen.queryByRole('group', { name: 'Period' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    expect(stats).not.toHaveBeenCalled()
  })
})
