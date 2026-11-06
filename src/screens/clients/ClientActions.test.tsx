import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import * as settings from '../../api/settings'
import * as dhcp from '../../api/dhcp'
import type { DnsSettings } from '../../api/settings'
import type { DhcpLease } from '../../api/dhcp'
import type { Notice } from '../../lib/notice'
import { ClientActions, type SettingsRead } from './ClientActions'
import { addBody, membership, removeBody, settingsNode } from './client-actions'

afterEach(() => vi.restoreAllMocks())

const IP = '10.0.0.7'

function asSettings(over: Partial<DnsSettings>): DnsSettings {
  return { blockingBypassList: [], qpmLimitBypassList: [], ...over } as DnsSettings
}

const LEASE: DhcpLease = {
  scope: 'Home', type: 'Dynamic', hardwareAddress: 'AA-BB-CC-DD-EE-FF', clientIdentifier: '1-aabbccddeeff',
  address: IP, hostName: 'tv', leaseObtained: '', leaseExpires: '',
}

/* The page's side of it: the settings it read, replaced by a save's answer. */
function Harness({
  start,
  lease = null,
  node = '',
  settingsNeed,
  dhcpNeed,
  onNotice,
  onLeaseChanged = () => {},
}: {
  start: SettingsRead
  lease?: DhcpLease | null
  node?: string
  settingsNeed?: 'Settings.canModify'
  dhcpNeed?: 'DhcpServer.canModify'
  onNotice: (n: Notice) => void
  onLeaseChanged?: () => void
}) {
  const [read, setRead] = useState<SettingsRead>(start)
  return (
    <ClientActions
      ip={IP}
      token="T"
      settings={read}
      onSettings={(data) => setRead({ kind: 'ok', data })}
      settingsNode={node}
      settingsNeed={settingsNeed}
      lease={lease}
      dhcpNode="dns1"
      dhcpNeed={dhcpNeed}
      onLeaseChanged={onLeaseChanged}
      onNotice={onNotice}
    />
  )
}

/** A line of the Actions: its list or lease name, its state and its button. */
function line(name: string) {
  const dt = within(screen.getByRole('region', { name: 'Actions' })).getByText(name)
  return { state: dt.nextElementSibling as HTMLElement, button: dt.nextElementSibling?.nextElementSibling as HTMLElement }
}

describe('the bodies the lists are saved with', () => {
  it('the one list and its node, through Settings cleaning, false when it empties', () => {
    expect(addBody('blockingBypassList', ['10.0.0.1'], IP, 'cluster')).toEqual({ node: 'cluster', blockingBypassList: `10.0.0.1,${IP}` })
    expect(addBody('qpmLimitBypassList', [], IP, '')).toEqual({ node: '', qpmLimitBypassList: IP })
    expect(removeBody('blockingBypassList', [IP], IP, '')).toEqual({ node: '', blockingBypassList: 'false' })
    expect(removeBody('blockingBypassList', ['10.0.0.1', IP, '192.168.0.0/16'], IP, '')).toEqual({
      node: '', blockingBypassList: '10.0.0.1,192.168.0.0/16',
    })
  })

  it('an address is in a list by itself or through a network that holds it', () => {
    expect(membership([IP], IP)).toEqual({ entry: IP, exact: true })
    expect(membership(['10.0.0.0/24'], IP)).toEqual({ entry: '10.0.0.0/24', exact: false })
    expect(membership(['10.0.1.0/24'], IP)).toEqual({ entry: null, exact: false })
    expect(membership(null, IP)).toEqual({ entry: null, exact: false })
  })

  it('the lists live where Blocking › Lists keeps its own', () => {
    expect(settingsNode(true)).toBe('cluster')
    expect(settingsNode(false)).toBe('')
  })
})

describe('ClientActions', () => {
  it('reads the state from the settings, and a network entry is said but not offered for removal', () => {
    render(<Harness start={{ kind: 'ok', data: asSettings({ blockingBypassList: ['10.0.0.0/24'] }) }} onNotice={() => {}} />)
    expect(line('Blocking Bypass List').state).toHaveTextContent('Bypassed Through 10.0.0.0/24')
    expect(line('Blocking Bypass List').button).toBeEmptyDOMElement()
    expect(line('QPM Limit Bypass List').state).toHaveTextContent('Applies')
    expect(within(line('QPM Limit Bypass List').button).getByRole('button', { name: 'Exempt from Rate Limiting' })).toBeEnabled()
  })

  it('adds after asking, sending exactly the one list and the node, and redraws from the answer', async () => {
    const set = vi.spyOn(settings, 'setSettings').mockResolvedValue({
      kind: 'ok', data: { response: asSettings({ blockingBypassList: [IP] }), server: 'dns1' },
    })
    const onNotice = vi.fn()
    render(<Harness start={{ kind: 'ok', data: asSettings({}) }} node="cluster" onNotice={onNotice} />)
    await userEvent.click(screen.getByRole('button', { name: 'Bypass Blocking' }))
    const dialog = screen.getByRole('dialog', { name: 'Bypass Blocking' })
    expect(dialog).toHaveTextContent(`Add ${IP} to the Blocking Bypass List? Blocking will no longer apply to its queries.`)
    expect(set).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(set).toHaveBeenCalledWith('T', { node: 'cluster', blockingBypassList: IP })
    expect(await screen.findByRole('button', { name: 'Apply Blocking' })).toBeInTheDocument()
    expect(line('Blocking Bypass List').state).toHaveTextContent('Bypassed')
    expect(onNotice).toHaveBeenCalledWith({ type: 'success', title: 'Settings Saved!', text: 'DNS Server settings were saved successfully.' })
  })

  it('removes the address alone from the QPM list', async () => {
    const set = vi.spyOn(settings, 'setSettings').mockResolvedValue({
      kind: 'ok', data: { response: asSettings({ qpmLimitBypassList: ['10.0.0.9'] }), server: 'dns1' },
    })
    render(<Harness start={{ kind: 'ok', data: asSettings({ qpmLimitBypassList: ['10.0.0.9', IP] }) }} onNotice={() => {}} />)
    expect(line('QPM Limit Bypass List').state).toHaveTextContent('Exempt')
    await userEvent.click(screen.getByRole('button', { name: 'Apply Rate Limiting' }))
    const dialog = screen.getByRole('dialog', { name: 'Apply Rate Limiting' })
    expect(dialog).toHaveTextContent(`Remove ${IP} from the QPM Limit Bypass List?`)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(set).toHaveBeenCalledWith('T', { node: '', qpmLimitBypassList: '10.0.0.9' })
    expect(await screen.findByRole('button', { name: 'Exempt from Rate Limiting' })).toBeInTheDocument()
  })

  it('a failed save says the server message and changes nothing', async () => {
    vi.spyOn(settings, 'setSettings').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    const onNotice = vi.fn()
    render(<Harness start={{ kind: 'ok', data: asSettings({}) }} onNotice={onNotice} />)
    await userEvent.click(screen.getByRole('button', { name: 'Bypass Blocking' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }))
    expect(onNotice).toHaveBeenCalledWith(expect.objectContaining({ type: 'danger', text: 'Access was denied.' }))
    expect(screen.getByRole('button', { name: 'Bypass Blocking' })).toBeInTheDocument()
  })

  it('without Settings: Modify the buttons stay, disabled; without Settings: View the state is locked', () => {
    const { unmount } = render(
      <Harness start={{ kind: 'ok', data: asSettings({}) }} settingsNeed="Settings.canModify" onNotice={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Bypass Blocking' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Exempt from Rate Limiting' })).toBeDisabled()
    unmount()
    render(<Harness start={{ kind: 'locked', need: 'Settings.canView' }} onNotice={() => {}} />)
    expect(line('Blocking Bypass List').state).toHaveTextContent('Requires Settings: View')
    expect(screen.queryByRole('button', { name: 'Bypass Blocking' })).not.toBeInTheDocument()
  })

  it('the QPM line only when the server sends its list, and a failed read says so', () => {
    const { unmount } = render(
      <Harness start={{ kind: 'ok', data: asSettings({ qpmLimitBypassList: undefined as never }) }} onNotice={() => {}} />,
    )
    expect(screen.queryByText('QPM Limit Bypass List')).not.toBeInTheDocument()
    unmount()
    render(<Harness start={{ kind: 'failed' }} onNotice={() => {}} />)
    expect(line('Blocking Bypass List').state).toHaveTextContent('Could not read the settings.')
  })

  it('a dynamic lease is reserved as DHCP › Leases does it, and the leases are read again', async () => {
    const reserve = vi.spyOn(dhcp, 'convertToReservedLease').mockResolvedValue({ kind: 'ok', data: {} })
    const onNotice = vi.fn()
    const onLeaseChanged = vi.fn()
    render(
      <Harness start={{ kind: 'ok', data: asSettings({}) }} lease={LEASE} onNotice={onNotice} onLeaseChanged={onLeaseChanged} />,
    )
    expect(line('DHCP Lease').state).toHaveTextContent('Dynamic')
    await userEvent.click(screen.getByRole('button', { name: 'Convert To Reserved Lease' }))
    const dialog = screen.getByRole('dialog', { name: 'Convert To Reserved Lease' })
    expect(dialog).toHaveTextContent('Are you sure you want to convert the dynamic lease to reserved lease?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Convert' }))
    expect(reserve).toHaveBeenCalledWith('T', 'Home', '1-aabbccddeeff', 'dns1')
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success', title: 'Reserved!', text: 'The dynamic lease was converted to reserved lease successfully.',
    })
    expect(onLeaseChanged).toHaveBeenCalledTimes(1)
  })

  it('a reserved lease offers the inverse; a failure says why and reads nothing again', async () => {
    const dynamic = vi.spyOn(dhcp, 'convertToDynamicLease').mockResolvedValue({ kind: 'error', message: 'No such lease.' })
    const onNotice = vi.fn()
    const onLeaseChanged = vi.fn()
    render(
      <Harness
        start={{ kind: 'ok', data: asSettings({}) }}
        lease={{ ...LEASE, type: 'Reserved' }}
        onNotice={onNotice}
        onLeaseChanged={onLeaseChanged}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Convert To Dynamic Lease' }))
    const dialog = screen.getByRole('dialog', { name: 'Convert To Dynamic Lease' })
    expect(dialog).toHaveTextContent('Are you sure you want to convert the reserved lease to dynamic lease?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Convert' }))
    expect(dynamic).toHaveBeenCalledWith('T', 'Home', '1-aabbccddeeff', 'dns1')
    expect(onNotice).toHaveBeenCalledWith(expect.objectContaining({ type: 'danger', text: 'No such lease.' }))
    expect(onLeaseChanged).not.toHaveBeenCalled()
  })

  it('without DhcpServer: Modify the conversion stays, disabled', () => {
    render(<Harness start={{ kind: 'ok', data: asSettings({}) }} lease={LEASE} dhcpNeed="DhcpServer.canModify" onNotice={() => {}} />)
    expect(screen.getByRole('button', { name: 'Convert To Reserved Lease' })).toBeDisabled()
  })
})
