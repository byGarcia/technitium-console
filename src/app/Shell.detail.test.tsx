import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell, type ShellSession } from './Shell'
import * as client from '../api/client'
import { forgetRoot } from './route'

/*
A detail page (`Section.detail`): it has its own address and its own screen, and
the sidebar does not know it exists, so the section it hangs from stays marked.
*/

const SESSION: ShellSession = {
  token: 't',
  displayName: 'Administrator',
  username: 'admin',
  type: 'Local',
  totpEnabled: false,
  info: { version: '15.6.1', uptimestamp: '2026-11-06T00:00:00Z', dnsServerDomain: 'ns1.test' },
}

const BLOCKER = {
  name: 'Advanced Blocking',
  description: 'Blocks by client.',
  version: '11.2.1',
  dnsApps: [{ classPath: 'AdvancedBlocking.App', description: 'Blocks.', recordDataTemplate: null }],
}

function mockApi() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'apps/list') return { kind: 'ok', data: { status: 'ok', response: { apps: [BLOCKER] } } } as never
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

const sidebar = () => within(screen.getByRole('navigation', { name: 'Sections' }))
const entries = () => sidebar().getAllByRole('link').map((a) => a.textContent)

describe('a detail page in the Shell', () => {
  it('survives an F5 behind a prefix: the bar is left alone and Apps stays marked', () => {
    servedAt('/dns/apps/advanced-blocking/?app=Blocker', 'apps/advanced-blocking')
    mockApi()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    expect(window.location.pathname + window.location.search).toBe('/dns/apps/advanced-blocking/?app=Blocker')
    expect(sidebar().getByRole('link', { name: 'Apps' })).toHaveAttribute('aria-current', 'page')
    expect(sidebar().getByRole('link', { name: 'Apps' })).toHaveAttribute('href', '/dns/apps/')
    expect(screen.queryByRole('heading', { level: 1, name: 'Apps' })).toBeNull()
  })

  it('the sidebar has the same entries as on the list', () => {
    servedAt('/apps/', 'apps')
    mockApi()
    const list = render(<Shell session={SESSION} onLogout={() => {}} />)
    const before = entries()
    list.unmount()

    servedAt('/apps/advanced-blocking/', 'apps/advanced-blocking')
    render(<Shell session={SESSION} onLogout={() => {}} />)
    expect(entries()).toEqual(before)
    expect(before.filter((t) => t === 'Advanced Blocking')).toEqual([])
  })

  it('apps/ still opens the list and is not completed to the detail', async () => {
    servedAt('/apps/', 'apps')
    mockApi()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    expect(await screen.findByRole('row', { name: 'Advanced Blocking' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/apps/')
  })

  it('the row link goes to the detail without a reload, and the sidebar comes back to the list', async () => {
    servedAt('/apps/', 'apps')
    mockApi()
    render(<Shell session={SESSION} onLogout={() => {}} />)
    const row = await screen.findByRole('row', { name: 'Advanced Blocking' })
    await userEvent.click(within(row).getByRole('link', { name: 'Visual Editor' }))

    await waitFor(() => expect(window.location.pathname).toBe('/apps/advanced-blocking/'))
    await waitFor(() => expect(screen.queryByRole('row', { name: 'Advanced Blocking' })).toBeNull())
    expect(sidebar().getByRole('link', { name: 'Apps' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(sidebar().getByRole('link', { name: 'Apps' }))
    await waitFor(() => expect(window.location.pathname).toBe('/apps/'))
    expect(await screen.findByRole('row', { name: 'Advanced Blocking' })).toBeInTheDocument()
  })
})
