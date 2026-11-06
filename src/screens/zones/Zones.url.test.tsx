/*
The open zone in the address bar (`zone-url.ts`): an addition, upstream never
touches the URL. Opening a zone pushes `/zones/?zone=…`, the breadcrumb and the
back button return to the list, the address opens the zone by itself, and a zone
that cannot be read falls back to the list as upstream's `showEditZone` does.
*/
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { forgetRoot } from '../../app/route'
import { Zones } from './Zones'
import { Shell, type ShellSession } from '../../app/Shell'
import { ThemeProvider } from '../../theme/ThemeProvider'

const ZONE = {
  name: 'casa.test',
  type: 'Primary',
  lastModified: '2026-08-26T10:00:00Z',
  disabled: false,
  soaSerial: 7,
  catalog: null,
  dnssecStatus: 'Unsigned',
  hasDnssecPrivateKeys: false,
  notifyFailed: false,
  notifyFailedFor: [],
}

/** A fake server: one zone, which `missing.test` is not. */
function server() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (route, init) => {
    const base = route.split('?')[0]
    if (base === 'zones/list') {
      return {
        kind: 'ok',
        data: { status: 'ok', response: { zones: [ZONE], pageNumber: 1, totalPages: 1, totalZones: 1 } },
      } as never
    }
    if (base === 'zones/records/get') {
      const zone = (init?.body as Record<string, string> | undefined)?.zone
      if (zone === 'missing.test') return { kind: 'error', message: 'No such zone was found: missing.test' } as never
      return {
        kind: 'ok',
        data: { status: 'ok', response: { zone: { ...ZONE, name: zone === '.' ? '' : zone }, records: [] } },
      } as never
    }
    return { kind: 'ok', data: { status: 'ok' } } as never
  })
}

/** Serves the document as the server would: in its folder and with its meta. */
function servedAt(trail: string, route: string | null = 'zones') {
  document.head.querySelector('meta[name="route"]')?.remove()
  if (route != null) {
    const m = document.createElement('meta')
    m.setAttribute('name', 'route')
    m.setAttribute('content', route)
    document.head.appendChild(m)
  }
  window.history.replaceState(null, '', trail)
  forgetRoot()
}

const bar = () => window.location.pathname + window.location.search

beforeEach(() => servedAt('/zones/'))
afterEach(() => {
  vi.restoreAllMocks()
  servedAt('/', null)
})

describe('the open zone in the address bar', () => {
  it('opening a zone pushes ?zone= onto the history', async () => {
    server()
    const push = vi.spyOn(window.history, 'pushState')
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)

    await user.click(await screen.findByRole('button', { name: 'casa.test' }))
    await screen.findByRole('heading', { name: 'casa.test' })
    expect(bar()).toBe('/zones/?zone=casa.test')
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('the breadcrumb returns to the list and pushes the list', async () => {
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)
    await user.click(await screen.findByRole('button', { name: 'casa.test' }))
    await screen.findByRole('heading', { name: 'casa.test' })

    const push = vi.spyOn(window.history, 'pushState')
    await user.click(screen.getByRole('button', { name: 'Zones' }))
    expect(await screen.findByRole('button', { name: 'casa.test' })).toBeInTheDocument()
    expect(bar()).toBe('/zones/')
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('deleting the open zone replaces its entry, so Back does not return to a zone that is gone', async () => {
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)
    await user.click(await screen.findByRole('button', { name: 'casa.test' }))
    await screen.findByRole('heading', { name: 'casa.test' })

    const push = vi.spyOn(window.history, 'pushState')
    await user.click(screen.getByRole('button', { name: 'Delete Zone' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('button', { name: 'casa.test' })).toBeInTheDocument()
    await waitFor(() => expect(bar()).toBe('/zones/'))
    expect(push).not.toHaveBeenCalled()
  })

  it('the back button returns to the list, and forward opens the zone again', async () => {
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)
    await user.click(await screen.findByRole('button', { name: 'casa.test' }))
    await screen.findByRole('heading', { name: 'casa.test' })

    act(() => window.history.back())
    expect(await screen.findByRole('button', { name: 'casa.test' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'casa.test' })).not.toBeInTheDocument()
    expect(bar()).toBe('/zones/')

    act(() => window.history.forward())
    expect(await screen.findByRole('heading', { name: 'casa.test' })).toBeInTheDocument()
    expect(bar()).toBe('/zones/?zone=casa.test')
  })

  it('the address opens the zone by itself, without a history entry', async () => {
    servedAt('/zones/?zone=casa.test')
    const spy = server()
    const push = vi.spyOn(window.history, 'pushState')
    render(<Zones token="t" canModify canDelete />)

    expect(await screen.findByRole('heading', { name: 'casa.test' })).toBeInTheDocument()
    const call = spy.mock.calls.find((c) => c[0] === 'zones/records/get')
    expect(call![1]?.body).toMatchObject({ zone: 'casa.test', domain: 'casa.test' })
    expect(push).not.toHaveBeenCalled()
    expect(bar()).toBe('/zones/?zone=casa.test')
  })

  it('the root zone travels as a dot', async () => {
    servedAt('/zones/?zone=.')
    const spy = server()
    render(<Zones token="t" canModify canDelete />)

    expect(await screen.findByRole('heading', { name: '<root>' })).toBeInTheDocument()
    const call = spy.mock.calls.find((c) => c[0] === 'zones/records/get')
    expect(call![1]?.body).toMatchObject({ zone: '.' })
  })

  it('a zone that cannot be read falls back to the list, replacing the entry', async () => {
    servedAt('/zones/?zone=missing.test')
    server()
    const push = vi.spyOn(window.history, 'pushState')
    render(<Zones token="t" canModify canDelete />)

    expect(await screen.findByRole('button', { name: 'casa.test' })).toBeInTheDocument()
    await waitFor(() => expect(bar()).toBe('/zones/'))
    expect(push).not.toHaveBeenCalled()
  })

  it('a zone that does not exist says what the server said, not that it is unreachable', async () => {
    servedAt('/zones/?zone=missing.test')
    server()
    render(<Zones token="t" canModify canDelete />)

    expect(await screen.findByText('No such zone was found: missing.test')).toBeInTheDocument()
    expect(screen.queryByText('Unable to connect to the server. Please try again.')).toBeNull()
  })

  it('behind a prefix the zone hangs from the real root', async () => {
    servedAt('/dns/zones/')
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)

    await user.click(await screen.findByRole('button', { name: 'casa.test' }))
    await screen.findByRole('heading', { name: 'casa.test' })
    expect(bar()).toBe('/dns/zones/?zone=casa.test')
  })

  it('leaving the section takes the zone out of the bar, so it does not follow the user', async () => {
    servedAt('/zones/?zone=casa.test&keep=1')
    server()
    const view = render(<Zones token="t" canModify canDelete />)
    await screen.findByRole('heading', { name: 'casa.test' })

    view.unmount()
    await waitFor(() => expect(bar()).toBe('/zones/?keep=1'))
  })
})

describe('the open zone inside the console', () => {
  const session: ShellSession = {
    token: 'tok',
    displayName: 'Administrator',
    username: 'admin',
    info: {
      version: '15.6',
      uptimestamp: '2026-10-15T08:00:00Z',
      dnsServerDomain: 'dns.example.net',
      permissions: { Zones: { canView: true, canModify: true, canDelete: true } },
    },
  }

  it('another section gets a clean bar, and back from it opens the zone again', async () => {
    servedAt('/zones/?zone=casa.test')
    server()
    const user = userEvent.setup()
    render(<ThemeProvider><Shell session={session} onLogout={() => {}} /></ThemeProvider>)
    await screen.findByRole('heading', { name: 'casa.test' })

    const nav = screen.getByRole('navigation', { name: 'Sections' })
    await user.click(within(nav).getByRole('link', { name: 'About' }))
    await waitFor(() => expect(bar()).toBe('/about/'))

    // The real back button: the zone's entry was left as it was.
    act(() => window.history.back())
    expect(await screen.findByRole('heading', { name: 'casa.test' })).toBeInTheDocument()
    expect(bar()).toBe('/zones/?zone=casa.test')
  })
})
