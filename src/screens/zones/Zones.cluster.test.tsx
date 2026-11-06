/*
The zone list across cluster nodes (deviation 33) and the quick add of a host
record (deviation 34), on the screen: which calls, with which parameters, what
the bar keeps, what a failing node says, and that without a cluster nothing
changes.
*/
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { ZoneList } from './ZoneList'
import { Zones } from './Zones'
import type { Notice } from './types'

const z = (name: string, type: string, soaSerial: number | null, extra: Record<string, unknown> = {}) => ({
  name, type, soaSerial, lastModified: '2026-11-06T09:00:00Z', disabled: false,
  dnssecStatus: 'Unsigned', notifyFailed: false, notifyFailedFor: [], ...extra,
})

const NODE_ZONES: Record<string, ReturnType<typeof z>[]> = {
  'ns1.test': [z('casa.test', 'Primary', 5), z('lab.test', 'Primary', 7), z('rev.test', 'Primary', 11)],
  'ns2.test': [z('casa.test', 'Secondary', 5), z('rev.test', 'Secondary', 10)],
}
const NODES = [
  { name: 'ns1.test', type: 'Primary' },
  { name: 'ns2.test', type: 'Secondary' },
  { name: 'ns3.test', type: 'Secondary' },
]

type Body = Record<string, string> | undefined

function server(opts: { add?: 'ok' | 'error' } = {}) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (route, init) => {
    const base = route.split('?')[0]
    const body = init?.body as Body
    if (base === 'zones/list') {
      const node = body?.node ?? ''
      if (body?.pageNumber != null || node === '') {
        return { kind: 'ok', data: { response: { zones: NODE_ZONES['ns1.test'], pageNumber: 1, totalPages: 1, totalZones: 3 } } } as never
      }
      if (node === 'ns3.test') return { kind: 'error', message: 'ns3.test could not be reached.' } as never
      const f = (body?.filterName ?? '').replace(/\*/g, '')
      return { kind: 'ok', data: { response: { zones: NODE_ZONES[node].filter((x) => x.name.includes(f)) } } } as never
    }
    if (base === 'zones/records/add') {
      if (opts.add === 'error') return { kind: 'error', message: 'Cannot add record: record already exists.' } as never
      return { kind: 'ok', data: { response: {} } } as never
    }
    if (base === 'zones/records/get') {
      return { kind: 'ok', data: { response: { zone: { name: body?.zone, type: 'Primary', disabled: false }, records: [] } } } as never
    }
    return { kind: 'ok', data: { status: 'ok' } } as never
  })
}

const listCalls = (spy: ReturnType<typeof server>) =>
  spy.mock.calls.filter((c) => c[0] === 'zones/list').map((c) => (c[1]?.body ?? {}) as Record<string, string>)

const props = {
  token: 't', canModify: true, canDelete: true,
  onNotice: () => {}, onConfirm: () => {}, onAdd: () => {}, onOpen: () => {},
  onEditZoneFile: () => {}, onImport: () => {}, onConvert: () => {}, onClone: () => {}, onPermissions: () => {},
  onOptions: () => {}, refresh: 0,
} as Parameters<typeof ZoneList>[0]

const cluster = { nodes: NODES, clusterInitialised: true }

beforeEach(() => window.history.replaceState(null, '', '/zones/'))
afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('the zone list across nodes', () => {
  it('without a cluster draws no toggle and reads no other node, even with ?view=all', async () => {
    window.history.replaceState(null, '', '/zones/?view=all')
    const spy = server()
    render(<ZoneList {...props} />)
    await screen.findByRole('button', { name: 'casa.test' })
    expect(screen.queryByRole('button', { name: 'All nodes' })).toBeNull()
    expect(listCalls(spy).every((b) => (b.node ?? '') === '')).toBe(true)
    expect(screen.getByRole('columnheader', { name: /Type/ })).toBeInTheDocument()
  })

  it('reads zones/list once per node with its node, and lays them side by side', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<ZoneList {...props} {...cluster} />)
    await user.click(await screen.findByRole('button', { name: 'All nodes' }))
    await screen.findByText(/3 zones across 2 nodes/)

    const perNode = listCalls(spy).filter((b) => b.node !== '' && b.pageNumber == null)
    expect(perNode.map((b) => b.node).sort()).toEqual(['ns1.test', 'ns2.test', 'ns3.test'])
    expect(perNode.every((b) => b.filterName == null)).toBe(true)

    const lab = screen.getByRole('button', { name: 'lab.test' }).closest('tr')!
    expect(within(lab).getByText('not on this node')).toBeInTheDocument()
    expect(within(lab).getByText('Only on 1 node')).toBeInTheDocument()
    const rev = screen.getByRole('button', { name: 'rev.test' }).closest('tr')!
    expect(within(rev).getByText('Serial differs')).toBeInTheDocument()
    const casa = screen.getByRole('button', { name: 'casa.test' }).closest('tr')!
    expect(within(casa).getByText('Healthy')).toBeInTheDocument()
    expect(within(casa).getByText('Secondary')).toBeInTheDocument()
  })

  it('in the view across nodes reads no hidden one-node page, and reads it again on the way back', async () => {
    window.history.replaceState(null, '', '/zones/?view=all')
    const spy = server()
    const user = userEvent.setup()
    render(<ZoneList {...props} {...cluster} />)
    await screen.findByText(/3 zones across 2 nodes/)
    expect(listCalls(spy).filter((b) => b.pageNumber != null)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'This node' }))
    await screen.findByRole('columnheader', { name: /Type/ })
    expect(listCalls(spy).filter((b) => b.pageNumber != null)).toHaveLength(1)
  })

  it('says which node did not answer, with the server message, and leaves it out of the comparison', async () => {
    server()
    const user = userEvent.setup()
    render(<ZoneList {...props} {...cluster} />)
    await user.click(await screen.findByRole('button', { name: 'All nodes' }))
    expect(await screen.findByText(/did not answer: ns3\.test could not be reached\./)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /ns3\.test \(No answer\)/ })).toBeInTheDocument()
    const casa = screen.getByRole('button', { name: 'casa.test' }).closest('tr')!
    expect(within(casa).getByText('No answer')).toBeInTheDocument()
    expect(within(casa).getByText('Healthy')).toBeInTheDocument()
  })

  it('counts and applies the filters, and keeps view and filter in the bar', async () => {
    server()
    const user = userEvent.setup()
    render(<ZoneList {...props} {...cluster} />)
    await user.click(await screen.findByRole('button', { name: 'All nodes' }))
    await screen.findByText(/3 zones across 2 nodes/)
    expect(window.location.search).toBe('?view=all')

    const chips = within(screen.getByRole('group', { name: 'Filter' }))
    expect(chips.getByRole('button', { name: 'All 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(chips.getByRole('button', { name: 'On every node 2' })).toBeInTheDocument()
    expect(chips.getByRole('button', { name: 'Only on some nodes 1' })).toBeInTheDocument()
    await user.click(chips.getByRole('button', { name: 'Serial differs 1' }))
    expect(window.location.search).toBe('?view=all&across=serial')
    expect(screen.getByRole('button', { name: 'rev.test' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'casa.test' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'This node' }))
    expect(window.location.search).toBe('')
  })

  it('opens from the bar, sends the Name filter to every node, and opens a zone on the screen node', async () => {
    window.history.replaceState(null, '', '/zones/?view=all&across=some')
    const spy = server()
    const opened: string[] = []
    const user = userEvent.setup()
    render(<ZoneList {...props} {...cluster} onOpen={(zone) => opened.push(zone)} />)
    expect(await screen.findByRole('button', { name: 'lab.test' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'casa.test' })).toBeNull()

    await user.type(screen.getByLabelText('Name'), 'lab*')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() =>
      expect(listCalls(spy).filter((b) => b.filterName === 'lab*' && b.pageNumber == null).map((b) => b.node).sort()).toEqual([
        'ns1.test',
        'ns2.test',
        'ns3.test',
      ]),
    )
    await user.click(await screen.findByRole('button', { name: 'lab.test' }))
    expect(opened).toEqual(['lab.test'])
  })
})

describe('the quick add of a host record', () => {
  async function ready(extra: Partial<Parameters<typeof ZoneList>[0]> = {}, opts: { add?: 'ok' | 'error' } = {}) {
    const spy = server(opts)
    const notices: Notice[] = []
    const user = userEvent.setup()
    render(<ZoneList {...props} defaultRecordTtl={1800} onNotice={(n) => notices.push(n)} {...extra} />)
    await screen.findByRole('button', { name: 'casa.test' })
    /* The summary's unpaged read: the zones the quick add matches against. */
    await waitFor(() => expect(listCalls(spy).some((b) => b.pageNumber == null)).toBe(true))
    return { spy, notices, user }
  }

  it('adds the A record with the dialog parameters, PTR included, to the screen node', async () => {
    const { spy, notices, user } = await ready({ node: 'ns1.test' })
    await user.type(screen.getByLabelText('Domain'), 'nas.lab.test')
    await user.type(screen.getByLabelText('IP Address'), '172.30.0.50')
    expect(screen.getByLabelText('Create reverse zone if it does not exists')).toBeDisabled()
    await user.click(screen.getByLabelText('Add reverse (PTR) record'))
    await user.click(screen.getByLabelText('Create reverse zone if it does not exists'))
    const before = listCalls(spy).length
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(notices.at(-1)?.title).toBe('Record Added!'))
    const call = spy.mock.calls.find((c) => c[0].startsWith('zones/records/add'))!
    expect(call[0]).toBe('zones/records/add?node=ns1.test')
    expect(call[1]).toMatchObject({ method: 'POST' })
    expect(call[1]?.body).toEqual({
      zone: 'lab.test', domain: 'nas.lab.test', type: 'A', ttl: '1800', overwrite: 'false', comments: '',
      expiryTtl: '', ipAddress: '172.30.0.50', ptr: 'true', createPtrZone: 'true', updateSvcbHints: 'true',
    })
    expect(notices.at(-1)).toMatchObject({ type: 'success', text: 'Resource record was added successfully.' })
    expect(notices.at(-1)?.action?.label).toBe('Open lab.test')
    // The list and its summary are read again.
    await waitFor(() => expect(listCalls(spy).length).toBeGreaterThanOrEqual(before + 2))
    expect(screen.getByLabelText('Domain')).toHaveValue('')
  })

  it('sends AAAA for an IPv6 address', async () => {
    const { spy, user } = await ready()
    await user.type(screen.getByLabelText('Domain'), 'casa.test')
    await user.type(screen.getByLabelText('IP Address'), '2001:db8::1{Enter}')
    await waitFor(() => expect(spy.mock.calls.some((c) => c[0].startsWith('zones/records/add'))).toBe(true))
    const body = spy.mock.calls.find((c) => c[0].startsWith('zones/records/add'))![1]?.body
    expect(body).toMatchObject({ zone: 'casa.test', domain: 'casa.test', type: 'AAAA', ipAddress: '2001:db8::1', ptr: 'false' })
  })

  it('refuses a name no zone holds, sends nothing, and offers Add Zone', async () => {
    const onAdd = vi.fn()
    const { spy, notices, user } = await ready({ onAdd })
    await user.type(screen.getByLabelText('Domain'), 'nas.elsewhere.lan')
    await user.type(screen.getByLabelText('IP Address'), '10.0.0.5')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(notices.at(-1)).toMatchObject({ type: 'warning', title: 'Missing!' })
    expect(spy.mock.calls.some((c) => c[0].startsWith('zones/records/add'))).toBe(false)
    expect(screen.getByLabelText('Domain')).toHaveFocus()
    notices.at(-1)?.action?.run()
    expect(onAdd).toHaveBeenCalled()
  })

  it('says the server failure as upstream does', async () => {
    const { notices, user } = await ready({}, { add: 'error' })
    await user.type(screen.getByLabelText('Domain'), 'www.casa.test')
    await user.type(screen.getByLabelText('IP Address'), '10.0.0.5')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(notices.at(-1)).toEqual({ type: 'danger', title: 'Error!', text: 'Cannot add record: record already exists.' }),
    )
    expect(screen.getByLabelText('Domain')).toHaveValue('www.casa.test')
  })

  it('is locked without Zones: Modify', async () => {
    await ready({ canModify: false })
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()
    expect(add.querySelector('svg')).not.toBeNull()
  })

  it('opens the zone it went into from the notice, on the Zones screen', async () => {
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByRole('button', { name: 'casa.test' })
    await user.type(screen.getByLabelText('Domain'), 'nas.casa.test')
    await user.type(screen.getByLabelText('IP Address'), '10.0.0.5')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('button', { name: 'Open casa.test' }))
    expect(await screen.findByRole('heading', { name: 'casa.test' })).toBeInTheDocument()
    expect(window.location.search).toBe('?zone=casa.test')
  })
})
