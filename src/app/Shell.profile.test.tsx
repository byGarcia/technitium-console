import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell, type ShellSession } from './Shell'
import * as client from '../api/client'
import { forgetRoot } from './route'

/*
My Profile is a page (deviation 21): the account menu's entry navigates to
`/profile/` instead of opening a dialog, the page takes no sidebar entry, and what
it loads reaches the account menu.
*/

const SESSION: ShellSession = {
  token: 't',
  displayName: 'Administrator',
  username: 'admin',
  type: 'Local',
  totpEnabled: false,
  info: { version: '15.6.1', uptimestamp: '2026-11-06T00:00:00Z', dnsServerDomain: 'ns1.test' },
}

const PROFILE = {
  displayName: 'Admin Renamed',
  username: 'admin',
  type: 'Local',
  isSsoUser: false,
  totpEnabled: false,
  memberOfGroups: ['Administrators'],
  sessionTimeoutSeconds: 1800,
  sessions: [],
}

function mockApi() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'user/profile/get') return { kind: 'ok', data: { status: 'ok', response: PROFILE } } as never
    return { kind: 'ok', data: { status: 'ok', response: {} } } as never
  })
}

function servedAt(path: string, route: string | null) {
  document.head.querySelector('meta[name="route"]')?.remove()
  if (route != null) {
    const m = document.createElement('meta')
    m.setAttribute('name', 'route')
    m.setAttribute('content', route)
    document.head.appendChild(m)
  }
  window.history.replaceState(null, '', path)
  forgetRoot()
}

afterEach(() => {
  vi.restoreAllMocks()
  servedAt('/', null)
})

describe('My Profile in the Shell', () => {
  it('the account menu navigates to /profile/, and the page renames the menu', async () => {
    servedAt('/about/', 'about')
    const spy = mockApi()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Administrator' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'My Profile' }))
    await waitFor(() => expect(window.location.pathname).toBe('/profile/'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Admin Renamed' })).toBeInTheDocument()
    expect(spy.mock.calls.some((c) => c[0] === 'user/profile/get')).toBe(true)
    // auth.js:675-677: the load writes the name into the menu.
    expect(screen.getByRole('button', { name: 'Admin Renamed' })).toBeInTheDocument()
    // No dialog: it is the page.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('the page takes no sidebar entry, and loads straight from its folder', async () => {
    servedAt('/profile/', 'profile')
    mockApi()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Admin Renamed' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(nav).queryByText('My Profile')).not.toBeInTheDocument()
    /* Thirteen: Logs is two entries (Query Logs, View Logs) and Clients joined
       Monitoring on 2026-11-06, and no section is open to unfold its sub-sections. */
    expect(within(nav).getAllByRole('link')).toHaveLength(13)
  })

  it('its sessions table opens the account menu dialog that creates a token', async () => {
    servedAt('/profile/', 'profile')
    mockApi()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    await screen.findByRole('heading', { level: 1, name: 'Admin Renamed' })
    await userEvent.click(screen.getByRole('button', { name: 'Create API Token' }))
    expect(await screen.findByRole('dialog', { name: 'Create API Token' })).toBeInTheDocument()
  })
})
