import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell, type ShellSession } from './Shell'
import * as client from '../api/client'
import { forgetRoot } from './route'

/* The command palette in the Shell (deviation 26): its shortcut, its door and a jump. */

const SESSION: ShellSession = {
  token: 't',
  displayName: 'Administrator',
  username: 'admin',
  type: 'Local',
  info: { version: '15.6.1', uptimestamp: '2026-11-06T00:00:00Z', dnsServerDomain: 'ns1.test' },
}

function served(path: string, route: string) {
  window.history.replaceState(null, '', path)
  document.head.querySelector('meta[name="route"]')?.remove()
  const meta = document.createElement('meta')
  meta.name = 'route'
  meta.content = route
  document.head.append(meta)
  forgetRoot()
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.head.querySelector('meta[name="route"]')?.remove()
  forgetRoot()
})

function api() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'zones/list') {
      return { kind: 'ok', data: { status: 'ok', response: { zones: [{ name: 'example.net', type: 'Primary', disabled: false, lastModified: '', soaSerial: 1 }] } } } as never
    }
    /* Blocking's figures have nothing to draw from here: they fail, and say so. */
    if (path.startsWith('dashboard/')) return { kind: 'error', message: 'none' } as never
    return { kind: 'ok', data: { status: 'ok', response: {} } } as never
  })
}

describe('the command palette', () => {
  it('opens with Ctrl+K and with the field under the brand', async () => {
    served('/about/', 'about')
    api()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(await screen.findByRole('combobox', { name: 'Search' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Search' })).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Search or jump to/ }))
    expect(await screen.findByRole('combobox', { name: 'Search' })).toBeInTheDocument()
  })

  it('reads the zones when it opens, and opens one as the zone list does', async () => {
    served('/about/', 'about')
    const spy = api()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await userEvent.type(await screen.findByRole('combobox', { name: 'Search' }), 'example.net')
    await waitFor(() => expect(screen.getAllByRole('option')[0]).toHaveTextContent('example.net'))
    expect(spy.mock.calls.some((c) => c[0] === 'zones/list')).toBe(true)
    /* The mock has no zone to show, so the screen then closes it: what is checked is
       the address the jump went to, which is the zone list's own. */
    const push = vi.spyOn(window.history, 'pushState')
    await userEvent.keyboard('{Enter}')
    expect(push).toHaveBeenCalledWith(null, '', '/zones/?zone=example.net')
    expect(screen.queryByRole('combobox', { name: 'Search' })).not.toBeInTheDocument()
  })

  it('shows a kept recent entry only where this session may go', async () => {
    served('/about/', 'about')
    api()
    localStorage.setItem(
      'paletteRecent',
      JSON.stringify([
        { id: 'account:password', group: 'Recent', label: 'Change Password', icon: 'key', target: { kind: 'modal', id: 'password' } },
        { id: 'account:token', group: 'Recent', label: 'Create API Token', icon: 'key', target: { kind: 'modal', id: 'token' } },
      ]),
    )
    render(<Shell session={{ ...SESSION, type: 'RemoteLDAP' }} onLogout={() => {}} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await screen.findByRole('combobox', { name: 'Search' })
    const labels = screen.getAllByRole('option').map((o) => o.textContent)
    expect(labels.some((l) => l?.includes('Create API Token'))).toBe(true)
    expect(labels.some((l) => l?.includes('Change Password'))).toBe(false)
  })

  it('does not write back the check it handed to Blocking', async () => {
    served('/about/', 'about')
    api()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await userEvent.type(await screen.findByRole('combobox', { name: 'Search' }), 'doubleclick.net{Enter}')
    await waitFor(() => expect(window.location.pathname).toBe('/blocking/overview/'))
    await new Promise((r) => setTimeout(r, 30))
    expect(window.location.search).not.toContain('check=')
  })
})
