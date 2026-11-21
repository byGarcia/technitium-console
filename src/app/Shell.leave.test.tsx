import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell, type ShellSession } from './Shell'
import { ThemeProvider } from '../theme/ThemeProvider'
import * as client from '../api/client'
import { SETTINGS } from '../screens/settings/settings.fixture'
import { forgetRoot } from './route'
import { choose } from '../test/dropdown'

/*
Leaving a form with unsaved changes asks first (deviation 51, `leave-guard.ts`):
Settings, Blocking › Lists and the DHCP scope form, from the sidebar, Back, a link
inside a screen, and a reload or closing the tab.
*/

const all = ['Dashboard', 'Zones', 'Cache', 'Allowed', 'Blocked', 'Apps', 'DnsClient', 'Settings', 'DhcpServer', 'Administration', 'Logs']
const session: ShellSession = {
  token: 'tok',
  displayName: 'Administrator',
  username: 'admin',
  info: {
    version: '15.6',
    uptimestamp: '2026-10-15T08:00:00Z',
    dnsServerDomain: 'dns.example.net',
    permissions: Object.fromEntries(all.map((s) => [s, { canView: true, canModify: true, canDelete: true }])),
  },
}

const ok = (response: unknown) => ({ kind: 'ok', data: { status: 'ok', response } }) as never

function serve() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    const base = path.split('?')[0]
    if (base === 'settings/get') return ok({ ...SETTINGS, blockListUrls: ['https://lists.example/a.txt'] })
    if (base === 'zones/list') return ok({ zones: [], pageNumber: 1, totalPages: 1, totalZones: 0 })
    if (base === 'dashboard/stats/get') {
      return ok({ stats: { totalQueries: 0, blockListZones: 0, allowListZones: 0, blockedZones: 0, allowedZones: 0 } })
    }
    if (base === 'dhcp/scopes/list') return ok({ scopes: [] })
    if (base === 'dhcp/leases/list') return ok({ leases: [] })
    return ok({})
  })
}

function mount(at: string) {
  window.history.replaceState(null, '', at)
  document.head.querySelector('meta[name="route"]')?.remove()
  const meta = document.createElement('meta')
  meta.name = 'route'
  meta.content = at.split('/').filter(Boolean).join('/')
  document.head.append(meta)
  forgetRoot()
  return render(
    <ThemeProvider>
      <Shell session={session} onLogout={() => {}} />
    </ThemeProvider>,
  )
}

const nav = () => within(screen.getByRole('navigation', { name: 'Sections' }))
const question = () => screen.queryByRole('dialog', { name: 'Discard Changes' })

async function editSettings() {
  const user = userEvent.setup()
  mount('/settings/general/')
  const field = await screen.findByLabelText('DNS Server Domain')
  await user.clear(field)
  await user.type(field, 'edited.example')
  expect(screen.getByText(/^Unsaved changes:/)).toBeInTheDocument()
  return { user, field }
}

beforeEach(() => {
  localStorage.clear()
  forgetRoot()
  serve()
})
afterEach(() => {
  vi.restoreAllMocks()
  document.head.querySelector('meta[name="route"]')?.remove()
})

describe('Shell: leaving a form with unsaved changes', () => {
  it('Settings: the sidebar asks; Cancel stays with the edit, Discard goes', async () => {
    const { user, field } = await editSettings()

    await user.click(nav().getByRole('link', { name: 'Zones' }))
    const dialog = await screen.findByRole('dialog', { name: 'Discard Changes' })
    expect(within(dialog).getByText('Are you sure you want to discard the unsaved changes?')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/settings/general/')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(question()).toBeNull())
    expect(field).toHaveValue('edited.example')
    expect(window.location.pathname).toBe('/settings/general/')

    await user.click(nav().getByRole('link', { name: 'Zones' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Discard Changes' })).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByRole('heading', { name: 'Zones', level: 1 })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/zones/')
  })

  it('Settings: moving between its sub-sections keeps the one form and does not ask', async () => {
    const { user } = await editSettings()
    /* Settings' own menu: its Cache, under the form's other eight panes. */
    const menu = screen.getByRole('navigation', { name: 'Settings sections' })
    await user.click(within(menu).getByRole('link', { name: /^Cache/ }))
    await waitFor(() => expect(window.location.pathname).toBe('/settings/cache/'))
    expect(question()).toBeNull()
    expect(screen.getByText(/^Unsaved changes: General/)).toBeInTheDocument()
  })

  it('Settings: Back asks, and puts the address back while it does', async () => {
    const user = userEvent.setup()
    mount('/about/')
    await user.click(nav().getByRole('link', { name: 'Settings' }))
    const field = await screen.findByLabelText('DNS Server Domain')
    await user.type(field, 'x')

    await act(async () => {
      window.history.back()
      await new Promise((r) => setTimeout(r, 50))
    })
    const dialog = await screen.findByRole('dialog', { name: 'Discard Changes' })
    expect(window.location.pathname).toBe('/settings/general/')
    expect(screen.getByLabelText('DNS Server Domain')).toHaveValue(`${SETTINGS.dnsServerDomain}x`)

    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(window.location.pathname).toBe('/about/'))
    expect(screen.queryByLabelText('DNS Server Domain')).toBeNull()
  })

  it('Settings: a reload or closing the tab gets the browser prompt only while there are changes', async () => {
    const user = userEvent.setup()
    mount('/settings/general/')
    const field = await screen.findByLabelText('DNS Server Domain')
    const unload = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(unload()).toBe(false)
    await user.type(field, 'x')
    expect(unload()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(unload()).toBe(false)
  })

  it('Blocking › Lists: leaving for another tab asks', async () => {
    const user = userEvent.setup()
    mount('/blocking/lists/')
    await user.click(await screen.findByRole('button', { name: 'Remove https://lists.example/a.txt' }))
    expect(await screen.findByText(/^Unsaved changes to the block list URLs:/)).toBeInTheDocument()

    await user.click(nav().getByRole('link', { name: 'Overview' }))
    expect(await screen.findByRole('dialog', { name: 'Discard Changes' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/blocking/lists/')
  })

  it('DHCP: leaving a scope form with something typed asks', async () => {
    const user = userEvent.setup()
    mount('/dhcp/scopes/')
    await user.click(await screen.findByRole('button', { name: 'Add Scope' }))
    await user.type(screen.getByPlaceholderText('Scope Name'), 'office')

    await user.click(nav().getByRole('link', { name: 'Zones' }))
    expect(await screen.findByRole('dialog', { name: 'Discard Changes' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Scope Name')).toHaveValue('office')
  })

  it('Settings: Discard in the bar puts the form back as the server answered it', async () => {
    const { user, field } = await editSettings()
    await user.click(within(screen.getByRole('region', { name: 'Save' })).getByRole('button', { name: 'Discard' }))
    expect(field).toHaveValue(SETTINGS.dnsServerDomain)
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Save' })).queryByRole('button', { name: 'Discard' })).toBeNull()
  })

  it('Settings: changing the cluster node asks, and Cancel keeps node and edit', async () => {
    const user = userEvent.setup()
    const spy = vi.mocked(client.apiRequest)
    const nodes = [
      { name: 'node1.cluster.test', type: 'Primary' },
      { name: 'node2.cluster.test', type: 'Secondary' },
    ]
    /* On one node, where the server's domain is a field the save sends. */
    localStorage.setItem('settingsClusterNode', 'node1.cluster.test')
    window.history.replaceState(null, '', '/settings/general/')
    document.head.querySelector('meta[name="route"]')?.remove()
    const meta = document.createElement('meta')
    meta.name = 'route'
    meta.content = 'settings/general'
    document.head.append(meta)
    forgetRoot()
    render(
      <ThemeProvider>
        <Shell session={{ ...session, info: { ...session.info!, clusterInitialized: true, clusterNodes: nodes } }} onLogout={() => {}} />
      </ThemeProvider>,
    )
    const field = await screen.findByLabelText('DNS Server Domain')
    await user.type(field, 'x')
    const reads = () => spy.mock.calls.filter((c) => c[0] === 'settings/get').length
    const before = reads()

    const select = screen.getByRole('combobox', { name: 'Cluster Node' })
    await choose(user, select, /^node2\.cluster\.test/)
    const dialog = await screen.findByRole('dialog', { name: 'Discard Changes' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(question()).toBeNull())
    expect(reads()).toBe(before)
    expect(screen.getByLabelText('DNS Server Domain')).toHaveValue(`${SETTINGS.dnsServerDomain}x`)

    await choose(user, screen.getByRole('combobox', { name: 'Cluster Node' }), /^node2\.cluster\.test/)
    await user.click(within(await screen.findByRole('dialog', { name: 'Discard Changes' })).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(reads()).toBe(before + 1))
    expect(spy.mock.calls.filter((c) => c[0] === 'settings/get').at(-1)?.[1]?.body).toEqual({ node: 'node2.cluster.test' })
  })

  it('a link inside a screen asks too (Lists\' Settings › Blocking)', async () => {
    const user = userEvent.setup()
    mount('/blocking/lists/')
    await user.click(await screen.findByRole('button', { name: 'Remove https://lists.example/a.txt' }))
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/blocking/settings/')
    const inScreen = links.find((a) => !nav().queryAllByRole('link').includes(a))!
    await user.click(inScreen)
    expect(await screen.findByRole('dialog', { name: 'Discard Changes' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/blocking/lists/')
  })

  it('nothing typed, nothing asked', async () => {
    const user = userEvent.setup()
    mount('/settings/general/')
    await screen.findByLabelText('DNS Server Domain')
    await user.click(nav().getByRole('link', { name: 'Zones' }))
    expect(await screen.findByRole('heading', { name: 'Zones', level: 1 })).toBeInTheDocument()
    expect(question()).toBeNull()
  })
})
