/*
DHCP laid out as Cache and Zones (deviation 19): one line per row with its Details,
the view in the address bar (`dhcp-url.ts`), the scope list's own search and State
filter, and a scope opened as a page whose verbs are the list's.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Dhcp, type SubTab } from './Dhcp'
import * as api from '../../api/dhcp'
import type { DhcpLease, DhcpScope, DhcpScopeRow } from '../../api/dhcp'
import { forgetRoot } from '../../app/route'

const LEASE: DhcpLease = {
  scope: 'Office',
  type: 'Dynamic',
  hardwareAddress: '3C-22-FB-41-9A-07',
  clientIdentifier: '1-3C22FB419A07',
  address: '172.31.10.110',
  hostName: 'adrian-macbook.office.lan',
  leaseObtained: '2026-11-06T07:09:00Z',
  leaseExpires: '2026-11-07T07:09:00Z',
}
const LAB_LEASE: DhcpLease = {
  ...LEASE,
  scope: 'Lab',
  type: 'Reserved',
  hardwareAddress: '02-42-AC-1F-14-0A',
  clientIdentifier: '1-0242AC1F140A',
  address: '172.31.20.60',
  hostName: 'build-01.lab.lan',
}

const OFFICE: DhcpScopeRow = {
  name: 'Office',
  enabled: true,
  startingAddress: '172.31.10.100',
  endingAddress: '172.31.10.199',
  subnetMask: '255.255.255.0',
  networkAddress: '172.31.10.0',
  broadcastAddress: '172.31.10.255',
  interfaceAddress: '172.31.10.2',
}
const LAB: DhcpScopeRow = {
  ...OFFICE,
  name: 'Lab',
  startingAddress: '172.31.20.50',
  endingAddress: '172.31.20.99',
  networkAddress: '172.31.20.0',
  broadcastAddress: '172.31.20.255',
  interfaceAddress: '172.31.20.2',
}
const GUESTS: DhcpScopeRow = { ...OFFICE, name: 'Guests', enabled: false, startingAddress: '10.66.0.10', endingAddress: '10.66.0.250', interfaceAddress: undefined }

const DETAIL: DhcpScope = {
  name: 'Office',
  startingAddress: '172.31.10.100',
  endingAddress: '172.31.10.199',
  subnetMask: '255.255.255.0',
  leaseTimeDays: 1,
  leaseTimeHours: 0,
  leaseTimeMinutes: 0,
  offerDelayTime: 0,
  pingCheckEnabled: false,
  pingCheckTimeout: 1000,
  pingCheckRetries: 2,
  dnsUpdates: true,
  dnsOverwriteForDynamicLease: false,
  dnsTtl: 900,
  useThisDnsServer: true,
  reservedLeases: [],
  allowOnlyReservedLeases: false,
  blockLocallyAdministeredMacAddresses: false,
  ignoreClientIdentifierOption: false,
}

const OK = { kind: 'ok' as const, data: {} }

/** Serves the document as the server would: in its folder and with its meta. */
function servedAt(trail: string, route: string | null) {
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

function serve() {
  vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [LEASE, LAB_LEASE] })
  vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [OFFICE, LAB, GUESTS] })
  return vi.spyOn(api, 'getScope').mockImplementation(async (_t, name) => (name === 'Office' ? DETAIL : null))
}

/* The section as the Shell mounts it: the sub-tab is state, and choosing one
   writes its trail, keeping the search, as `writeRoute` does. */
function Section({ first }: { first: SubTab }) {
  const [sub, setSub] = useState<SubTab>(first)
  return (
    <Dhcp
      token="t"
      sub={sub}
      onSubChange={(t) => {
        setSub(t)
        window.history.pushState(null, '', `/dhcp/${t.toLowerCase()}/${window.location.search}`)
      }}
    />
  )
}

beforeEach(() => servedAt('/dhcp/leases/', 'dhcp/leases'))
afterEach(() => {
  vi.restoreAllMocks()
  servedAt('/', null)
})

describe('a lease on one line', () => {
  it('shows what identifies it, and its client identifier and dates under Details', async () => {
    const user = userEvent.setup()
    serve()
    render(<Dhcp token="t" sub="Leases" />)
    const line = within(await screen.findByRole('row', { name: /172\.31\.10\.110/ }))

    expect(line.getByText('adrian-macbook.office.lan')).toBeInTheDocument()
    expect(line.getByText('3C-22-FB-41-9A-07')).toBeInTheDocument()
    expect(screen.queryByText('1-3C22FB419A07')).not.toBeInTheDocument()
    expect(screen.queryByText('Client Identifier')).not.toBeInTheDocument()

    const details = line.getByRole('button', { name: 'Details' })
    expect(details).toHaveAttribute('aria-expanded', 'false')
    await user.click(details)
    expect(details).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Client Identifier')).toBeInTheDocument()
    expect(screen.getByText('1-3C22FB419A07')).toBeInTheDocument()
    expect(screen.getByText('Lease Obtained')).toBeInTheDocument()
  })
})

describe('the Leases view in the address bar', () => {
  it('reads the search, scope and type on arrival', async () => {
    servedAt('/dhcp/leases/?scope=Lab&type=Reserved', 'dhcp/leases')
    serve()
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByText('Total Leases: 2')

    expect(screen.getByRole('combobox', { name: 'Scope' })).toHaveTextContent('Lab')
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Reserved')
    expect(screen.getByRole('row', { name: /172\.31\.20\.60/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /172\.31\.10\.110/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2 shown')).toBeInTheDocument()
  })

  it('writes what is typed and chosen by replacing the entry, and drops it on leaving', async () => {
    const user = userEvent.setup()
    serve()
    const push = vi.spyOn(window.history, 'pushState')
    const { unmount } = render(<Dhcp token="t" sub="Leases" />)
    await screen.findByText('Total Leases: 2')

    await user.type(screen.getByLabelText('Search'), 'build')
    await user.click(screen.getByRole('combobox', { name: 'Type' }))
    await user.click(screen.getByRole('option', { name: 'Reserved' }))
    await waitFor(() => expect(bar()).toBe('/dhcp/leases/?q=build&type=Reserved'))
    expect(push).not.toHaveBeenCalled()

    unmount()
    expect(bar()).toBe('/dhcp/leases/')
  })

  it('a type the server does not write is not applied', async () => {
    servedAt('/dhcp/leases/?type=A', 'dhcp/leases')
    serve()
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByText('Total Leases: 2')
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('All')
  })

  it('does not read a search that belongs to another screen', async () => {
    servedAt('/cache/?type=Reserved', 'cache')
    serve()
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByText('Total Leases: 2')
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('All')
  })
})

describe('the scope list', () => {
  beforeEach(() => servedAt('/dhcp/scopes/', 'dhcp/scopes'))

  it('the search finds a scope by name or by an address its range holds', async () => {
    const user = userEvent.setup()
    serve()
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 3')

    await user.type(screen.getByLabelText('Search'), '172.31.20.77')
    expect(screen.getByRole('button', { name: 'Lab' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Office' })).not.toBeInTheDocument()
    expect(screen.getByText('1 of 3 shown')).toBeInTheDocument()
    await waitFor(() => expect(bar()).toBe('/dhcp/scopes/?q=172.31.20.77'))

    await user.clear(screen.getByLabelText('Search'))
    await user.type(screen.getByLabelText('Search'), 'nothing-here')
    expect(screen.getByText('No Scope Found')).toBeInTheDocument()
  })

  it('pressing a state on All Scopes filters as the State field does, and pressing it again clears it', async () => {
    const user = userEvent.setup()
    serve()
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 3')
    const states = within(screen.getByRole('group', { name: 'Scopes by state' }))

    await user.click(states.getByRole('button', { name: /Disabled/ }))
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveTextContent('Disabled')
    expect(screen.getByRole('button', { name: 'Guests' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Office' })).not.toBeInTheDocument()
    await waitFor(() => expect(bar()).toBe('/dhcp/scopes/?state=Disabled'))

    await user.click(states.getByRole('button', { name: /Disabled/ }))
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveTextContent('All')
    expect(screen.getByRole('button', { name: 'Office' })).toBeInTheDocument()
  })
})

describe('a scope as a page', () => {
  beforeEach(() => servedAt('/dhcp/scopes/', 'dhcp/scopes'))

  it('opening one pushes ?scope=, and the breadcrumb returns to the list and reads it again', async () => {
    const user = userEvent.setup()
    const get = serve()
    const push = vi.spyOn(window.history, 'pushState')
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 3')

    await user.click(screen.getByRole('button', { name: 'Office' }))
    await screen.findByRole('heading', { name: 'Edit Scope' })
    expect(get).toHaveBeenCalledWith('t', 'Office', '')
    expect(bar()).toBe('/dhcp/scopes/?scope=Office')
    expect(push).toHaveBeenCalledTimes(1)

    const reads = vi.mocked(api.listScopes).mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Scopes' }))
    expect(await screen.findByText('Total Scopes: 3')).toBeInTheDocument()
    expect(bar()).toBe('/dhcp/scopes/')
    expect(vi.mocked(api.listScopes).mock.calls.length).toBeGreaterThan(reads)
  })

  it('the address opens the scope by itself, and Back returns to the list', async () => {
    servedAt('/dhcp/scopes/?scope=Office', 'dhcp/scopes')
    serve()
    render(<Dhcp token="t" sub="Scopes" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Office' })).toBeInTheDocument()
    expect(bar()).toBe('/dhcp/scopes/?scope=Office')

    act(() => {
      window.history.replaceState(null, '', '/dhcp/scopes/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(await screen.findByText('Total Scopes: 3')).toBeInTheDocument()
  })

  it('a scope that cannot be read leaves the list, and the bar with it', async () => {
    servedAt('/dhcp/scopes/?scope=Missing', 'dhcp/scopes')
    serve()
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 3')
    await waitFor(() => expect(bar()).toBe('/dhcp/scopes/'))
  })

  it('its header disables with the same confirmation, and deletes back to the list without reloading it', async () => {
    const user = userEvent.setup()
    serve()
    const disable = vi.spyOn(api, 'disableScope').mockResolvedValue(OK)
    const remove = vi.spyOn(api, 'deleteScope').mockResolvedValue(OK)
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 3')
    await user.click(screen.getByRole('button', { name: 'Office' }))
    await screen.findByRole('heading', { name: 'Edit Scope' })

    await user.click(screen.getByRole('button', { name: 'Disable Scope' }))
    expect(screen.getByText("Are you sure you want to disable the DHCP scope 'Office'?")).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable' }))
    expect(disable).toHaveBeenCalledWith('t', 'Office', '')
    expect(await screen.findByText('Scope Disabled!')).toBeInTheDocument()
    // Still on the page, the form as it was.
    expect(screen.getByRole('heading', { name: 'Edit Scope' })).toBeInTheDocument()

    const reads = vi.mocked(api.listScopes).mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Delete Scope' }))
    expect(screen.getByText("Are you sure you want to delete the DHCP scope 'Office'?")).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(remove).toHaveBeenCalledWith('t', 'Office', '')
    expect(await screen.findByText('Scope Deleted!')).toBeInTheDocument()
    expect(await screen.findByText('Total Scopes: 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Office' })).not.toBeInTheDocument()
    expect(vi.mocked(api.listScopes).mock.calls.length).toBe(reads)
    expect(bar()).toBe('/dhcp/scopes/')
  })

  it('Open in Leases shows the Leases tab narrowed to the scope', async () => {
    const user = userEvent.setup()
    serve()
    render(<Section first="Scopes" />)
    await screen.findByText('Total Scopes: 3')
    await user.click(screen.getByRole('button', { name: 'Office' }))
    await screen.findByRole('heading', { name: 'Edit Scope' })

    await user.click(screen.getByRole('button', { name: 'Open in Leases' }))
    expect(await screen.findByText('Total Leases: 2')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Scope' })).toHaveTextContent('Office')
    expect(screen.queryByRole('row', { name: /172\.31\.20\.60/ })).not.toBeInTheDocument()
    await waitFor(() => expect(bar()).toBe('/dhcp/leases/?scope=Office'))
  })
})
