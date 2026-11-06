import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dhcp } from './Dhcp'
import * as api from '../../api/dhcp'
import type { DhcpLease, DhcpScope, DhcpScopeRow } from '../../api/dhcp'

/*
Deviation 19: what the DHCP section says at a glance. The cards over both tables,
the lease table's search and filters, the scope table's Leases column, and the
scope form's index and range count.
*/

afterEach(() => vi.restoreAllMocks())

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString()

const DYNAMIC: DhcpLease = {
  scope: 'Default',
  type: 'Dynamic',
  hardwareAddress: 'A4-83-E7-2B-19-0C',
  clientIdentifier: '1-A4-83-E7-2B-19-0C',
  address: '192.168.1.42',
  hostName: 'blackview-tab',
  leaseObtained: inMinutes(-60),
  leaseExpires: inMinutes(20),
}

const RESERVED: DhcpLease = {
  ...DYNAMIC,
  type: 'Reserved',
  hardwareAddress: 'DC-A6-32-7F-44-81',
  clientIdentifier: '1-DC-A6-32-7F-44-81',
  address: '192.168.1.50',
  hostName: 'orbiter',
  leaseObtained: inMinutes(-5),
  leaseExpires: inMinutes(60 * 24),
}

const GUEST: DhcpLease = {
  ...DYNAMIC,
  scope: 'Guest',
  hardwareAddress: '8C-85-90-12-34-56',
  clientIdentifier: '1-8C8590123456',
  address: '192.168.50.10',
  hostName: 'guest-ipad',
  leaseObtained: inMinutes(-90),
  leaseExpires: inMinutes(120),
}

const SCOPE: DhcpScopeRow = {
  name: 'Default',
  enabled: true,
  startingAddress: '192.168.1.1',
  endingAddress: '192.168.1.254',
  subnetMask: '255.255.255.0',
  networkAddress: '192.168.1.0',
  broadcastAddress: '192.168.1.255',
}

const LAB: DhcpScopeRow = {
  ...SCOPE,
  name: 'Lab',
  enabled: false,
  startingAddress: '172.20.10.20',
  endingAddress: '172.20.10.60',
}

const DETAIL: DhcpScope = {
  name: 'Default',
  startingAddress: '192.168.1.1',
  endingAddress: '192.168.1.254',
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
  ignoreClientIdentifierOption: true,
}

const OK = { kind: 'ok' as const, data: {} }

function rowsShown(): string[] {
  return screen
    .getAllByRole('row')
    .map((r) => r.textContent ?? '')
    .filter((t) => /\d+\.\d+\.\d+\.\d+/.test(t))
}

function card(title: string) {
  return within(screen.getByText(title).closest('section') as HTMLElement)
}

describe('Leases at a glance', () => {
  it('the cards count the list: by type, per scope, expiring soon and the newest', async () => {
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED, GUEST] })
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByRole('cell', { name: '192.168.1.42' })

    const types = within(screen.getByRole('group', { name: 'Leases by type' }))
    expect(types.getByRole('button', { name: /Dynamic\s*2/ })).toBeInTheDocument()
    expect(types.getByRole('button', { name: /Reserved\s*1/ })).toBeInTheDocument()

    const scopes = within(screen.getByRole('group', { name: 'Leases per scope' }))
    expect(scopes.getByRole('button', { name: /Default\s*2/ })).toBeInTheDocument()
    expect(scopes.getByRole('button', { name: /Guest\s*1/ })).toBeInTheDocument()

    // Only DYNAMIC runs out within the hour.
    const soon = card('Expiring Soon')
    expect(soon.getByText('1')).toBeInTheDocument()
    expect(soon.getByText('blackview-tab')).toBeInTheDocument()
    expect(soon.getByText('in 20 minutes')).toBeInTheDocument()

    const newest = card('Newest Lease')
    expect(newest.getByText('orbiter')).toBeInTheDocument()
    expect(newest.getByText('192.168.1.50')).toBeInTheDocument()
    expect(newest.getByText(/obtained 5 minutes ago/)).toBeInTheDocument()
  })

  it('with no leases the cards draw zeros and only the table says "No Lease Found"', async () => {
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [] })
    render(<Dhcp token="t" sub="Leases" />)

    expect(await screen.findByText('No Lease Found')).toBeInTheDocument()
    const types = within(screen.getByRole('group', { name: 'Leases by type' }))
    expect(types.getByRole('button', { name: /Dynamic\s*0/ })).toBeInTheDocument()
    expect(types.getByRole('button', { name: /Reserved\s*0/ })).toBeInTheDocument()
    expect(card('Newest Lease').getByText('None')).toBeInTheDocument()
  })

  it('pressing a type filters the table as the Type field does, and pressing it again clears it', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED, GUEST] })
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByRole('cell', { name: '192.168.1.42' })

    const chip = within(screen.getByRole('group', { name: 'Leases by type' })).getByRole('button', { name: /Reserved/ })
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(rowsShown()).toHaveLength(1)
    expect(rowsShown()[0]).toContain('192.168.1.50')
    expect(screen.getByText('1 of 3 shown')).toBeInTheDocument()
    // The foot still counts the whole list, with upstream's words.
    expect(screen.getByText('Total Leases: 3')).toBeInTheDocument()

    await user.click(chip)
    expect(rowsShown()).toHaveLength(3)
    expect(screen.queryByText(/of 3 shown/)).not.toBeInTheDocument()
  })

  it('pressing a scope filters the table to it', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED, GUEST] })
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByRole('cell', { name: '192.168.1.42' })

    await user.click(within(screen.getByRole('group', { name: 'Leases per scope' })).getByRole('button', { name: /Guest/ }))
    expect(rowsShown()).toHaveLength(1)
    expect(rowsShown()[0]).toContain('192.168.50.10')
  })

  it('the search finds a MAC typed with colons, and an empty result says "No Lease Found"', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED, GUEST] })
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByRole('cell', { name: '192.168.1.42' })

    const search = screen.getByLabelText('Search')
    await user.type(search, 'dc:a6')
    expect(rowsShown()).toHaveLength(1)
    expect(rowsShown()[0]).toContain('orbiter')

    await user.clear(search)
    await user.type(search, 'nothing-here')
    expect(screen.getByText('No Lease Found')).toBeInTheDocument()
  })

  it('on a sorted table a conversion acts on the row that was clicked, not on its position', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED] })
    const spy = vi.spyOn(api, 'convertToReservedLease').mockResolvedValue(OK)
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByRole('cell', { name: '192.168.1.42' })

    // The list is drawn ascending, so one click sorts it descending: .50 first.
    await user.click(screen.getByRole('button', { name: /IP Address/ }))
    expect(rowsShown()[0]).toContain('192.168.1.50')

    await user.click(screen.getByRole('button', { name: 'Convert To Reserved Lease' }))
    await user.click(screen.getByRole('button', { name: 'Convert' }))
    expect(spy).toHaveBeenCalledWith('t', 'Default', '1-A4-83-E7-2B-19-0C', '')
  })

  it('the Remove Lease dialog keeps both warnings with their words', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC] })
    render(<Dhcp token="t" sub="Leases" />)
    await screen.findByRole('cell', { name: '192.168.1.42' })

    await user.click(screen.getByRole('button', { name: 'Actions for 192.168.1.42' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Remove Lease' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getAllByText('Warning!')).toHaveLength(2)
    expect(dialog.getByText(/will NOT remove the allocated IP address from the client side/)).toBeInTheDocument()
    expect(dialog.getByText(/may cause IP address conflict/)).toBeInTheDocument()
  })
})

describe('Scopes at a glance', () => {
  it('reads the leases beside the scopes, on the same node', async () => {
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [SCOPE] })
    const leases = vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED] })
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 1')
    expect(leases).toHaveBeenCalledWith('t', '')
  })

  it('each row says how many of its addresses are leased', async () => {
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [SCOPE, LAB] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED, GUEST] })
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 2')

    expect(screen.getByRole('img', { name: 'Default: 2 of 254 addresses in range leased' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Lab: 0 of 41 addresses in range leased' })).toBeInTheDocument()
  })

  it('the cards count scopes by state, and the pool of the enabled ones only', async () => {
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [SCOPE, LAB] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED, GUEST] })
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 2')

    expect(screen.getByRole('img', { name: 'Enabled 1, Disabled 1' })).toBeInTheDocument()
    // Default is enabled (254 addresses, 2 leases); Lab is disabled; Guest is no scope here.
    expect(screen.getByRole('img', { name: '2 of 254 addresses in range leased' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Dynamic 2, Reserved 1' })).toBeInTheDocument()
  })

  it('when the leases cannot be read, the scopes are drawn and the cards say so, with no notice', async () => {
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [SCOPE] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 1')

    expect(screen.getAllByText('The leases could not be read.')).toHaveLength(2)
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Default: / })).not.toBeInTheDocument()
  })
})

describe('the scope form at a glance', () => {
  it('reads in one glance: Scope open, the other twelve blocks one line each with what they hold', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [SCOPE] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [] })
    vi.spyOn(api, 'getScope').mockResolvedValue({ ...DETAIL, domainName: 'home', exclusions: [{ startingAddress: '192.168.1.1', endingAddress: '192.168.1.10' }] })
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 1')
    await user.click(screen.getByRole('button', { name: 'Default' }))
    await screen.findByRole('heading', { name: 'Edit Scope' })

    expect(screen.getByLabelText('Name')).toBeVisible()
    const lines = screen.getAllByRole('button', { expanded: false }).filter((b) => b.hasAttribute('aria-controls'))
    expect(lines.map((b) => b.getAttribute('aria-labelledby') && document.getElementById(b.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Ping Check',
      'DNS',
      'Network Options',
      'Static Routes',
      'Bootstrap',
      'Vendor Specific Information',
      'CAPWAP Access Controller Addresses',
      'TFTP Server Addresses',
      'Generic DHCP Options',
      'Exclusions',
      'Advanced Options',
      'Reserved Leases',
    ])
    const exclusions = screen.getByRole('button', { name: 'Exclusions' })
    expect(exclusions).toHaveAccessibleDescription('192.168.1.1 - 192.168.1.10')
    expect(screen.getByRole('button', { name: 'Static Routes' })).toHaveAccessibleDescription('None')
    expect(screen.getByRole('button', { name: 'DNS' })).toHaveAccessibleDescription(/^home · DNS Updates On · TTL 900$/)
    expect(screen.getByLabelText('Exclusions 1 Starting Address')).not.toBeVisible()

    // A line opens its block, and the summary follows what is typed.
    await user.click(exclusions)
    expect(exclusions).toHaveAttribute('aria-expanded', 'true')
    const start = screen.getByLabelText('Exclusions 1 Starting Address')
    expect(start).toBeVisible()
    await user.clear(start)
    await user.type(start, '192.168.1.5')
    expect(exclusions).toHaveAccessibleDescription('192.168.1.5 - 192.168.1.10')
  })

  it('the scope page says what the server holds: its header, pool, leases, reservations and options', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [{ ...SCOPE, interfaceAddress: '192.168.1.2' }] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [DYNAMIC, RESERVED] })
    vi.spyOn(api, 'getScope').mockResolvedValue({
      ...DETAIL,
      reservedLeases: [
        { hostName: 'orbiter', hardwareAddress: 'DC-A6-32-7F-44-81', address: '192.168.1.50', comments: null },
        { hostName: null, hardwareAddress: '02-00-00-00-00-01', address: '192.168.1.60', comments: 'spare' },
      ],
    })
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 1')
    await user.click(screen.getByRole('button', { name: 'Default' }))
    await screen.findByRole('heading', { name: 'Edit Scope' })

    expect(screen.getByRole('heading', { level: 1, name: 'Default' })).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2 of 254 addresses in range leased' })).toBeInTheDocument()
    expect(screen.getByText('192.168.1.255')).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByText('Leased')).toBeInTheDocument()
    expect(screen.getByText('Not leased')).toBeInTheDocument()
    expect(screen.getByText('1d')).toBeInTheDocument()
    expect(screen.getAllByText('This DNS Server').some((e) => e.closest('dd') != null)).toBe(true)
    expect(screen.getByRole('button', { name: 'Disable Scope' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Scope' })).toBeInTheDocument()
  })

  it('says how many addresses the range holds, and nothing for a range that is not one', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [SCOPE] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [] })
    vi.spyOn(api, 'getScope').mockResolvedValue(DETAIL)
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('Total Scopes: 1')
    await user.click(screen.getByRole('button', { name: 'Default' }))

    expect(await screen.findByText('254 addresses')).toBeInTheDocument()
    const end = screen.getByLabelText('Ending Address')
    await user.clear(end)
    await user.type(end, '192.168.1.1')
    expect(screen.getByText('1 address')).toBeInTheDocument()
    await user.type(end, 'x')
    expect(screen.queryByText(/\d+ address/)).not.toBeInTheDocument()
  })

  it('the Ping Check warning comes before the block controls', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [] })
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('No Scope Found')
    await user.click(screen.getByRole('button', { name: 'Add Scope' }))

    const warning = screen.getByText(/Ping check would work as expected only/)
    const toggle = screen.getByLabelText('Enable Ping Check')
    expect(warning.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the long hex samples keep their exact text', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listScopes').mockResolvedValue({ kind: 'ok', data: [] })
    vi.spyOn(api, 'listLeases').mockResolvedValue({ kind: 'ok', data: [] })
    render(<Dhcp token="t" sub="Scopes" />)
    await screen.findByText('No Scope Found')
    await user.click(screen.getByRole('button', { name: 'Add Scope' }))

    const codes = [...document.querySelectorAll('code')].map((c) => c.textContent)
    expect(codes).toContain('06:01:03:0A:04:00:50:58:45:09:14:00:00:11:52:61:73:70:62:65:72:72:79:20:50:69:20:42:6F:6F:74:FF')
    expect(codes).toContain('0601030A0400505845091400001152617370626572727920506920426F6F74FF')
  })
})
