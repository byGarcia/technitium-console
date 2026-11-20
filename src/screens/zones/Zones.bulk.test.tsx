/*
Acting on several of a zone's records at once (deviation 54): a checkbox on every
record a row can delete and disable, Delete Records, Disable Records and Enable
Records at the toolbar's end, each record sent on its own with the body its row
action sends, one after another, then one read of the zone and one notice.
*/
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { forgetRoot } from '../../app/route'
import { Zones } from './Zones'

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

const record = (name: string, type: string, rData: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  name, type, ttl: 3600, ttlString: '1h', disabled: false, rData, dnssecStatus: 'Unknown',
  lastUsedOn: '0001-01-01T00:00:00', lastModified: '2026-08-26T10:00:00Z', expiryTtl: 0, expiryTtlString: '0s',
  ...extra,
})

const SOA = record('casa.test', 'SOA', {
  primaryNameServer: 'ns1.casa.test', responsiblePerson: 'admin.casa.test', serial: 7,
  refresh: 900, retry: 300, expire: 604800, minimum: 900,
})
const NS = record('casa.test', 'NS', { nameServer: 'ns1.casa.test' })
const WWW = record('www.casa.test', 'A', { ipAddress: '10.0.0.5' }, { expiryTtl: 3600 })
const NAS = record('nas.casa.test', 'A', { ipAddress: '10.0.0.50' })
const OLD = record('old.casa.test', 'A', { ipAddress: '10.0.0.99' }, { disabled: true })
const RECORDS = [SOA, NS, WWW, NAS, OLD]

type Call = { route: string; body: Record<string, string> }

function server({ zone = ZONE, records = RECORDS, fail = [] as string[] } = {}) {
  const calls: Call[] = []
  const spy = vi.spyOn(client, 'apiRequest').mockImplementation(async (route, init) => {
    const base = route.split('?')[0]
    const body = (init?.body ?? {}) as Record<string, string>
    calls.push({ route: base, body })
    if (base === 'zones/list') {
      return { kind: 'ok', data: { status: 'ok', response: { zones: [zone], pageNumber: 1, totalPages: 1, totalZones: 1 } } } as never
    }
    if (base === 'zones/records/get') {
      return { kind: 'ok', data: { status: 'ok', response: { zone, records } } } as never
    }
    if ((base === 'zones/records/delete' || base === 'zones/records/update') && fail.includes(body.domain)) {
      return { kind: 'error', message: `Cannot change ${body.domain}.` } as never
    }
    return { kind: 'ok', data: { status: 'ok', response: {} } } as never
  })
  return { spy, calls }
}

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

const of = (calls: Call[], route: string) => calls.filter((c) => c.route === route)
const box = (name: string) => screen.getByRole('checkbox', { name: new RegExp(`^Select ${name} `) })

async function openZone(props: { canModify?: boolean; canDelete?: boolean } = {}) {
  render(<Zones token="t" canModify={props.canModify ?? true} canDelete={props.canDelete ?? true} />)
  await screen.findByRole('heading', { name: 'casa.test' })
}

beforeEach(() => servedAt('/zones/?zone=casa.test'))
afterEach(() => {
  vi.restoreAllMocks()
  servedAt('/', null)
})

describe('a zone records: what can be selected', () => {
  it('every record a row can delete and disable has a box; the SOA has none', async () => {
    server()
    await openZone()
    for (const n of ['@ NS', 'www A', 'nas A', 'old A']) expect(box(n)).toBeEnabled()
    expect(screen.queryByRole('checkbox', { name: /^Select @ SOA/ })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select all records' })).not.toBeChecked()
  })

  it('the three verbs are there and disabled until a record is ticked, and the status is as before', async () => {
    server()
    await openZone()
    for (const verb of ['Delete Records', 'Disable Records', 'Enable Records']) {
      expect(screen.getByRole('button', { name: verb })).toBeDisabled()
    }
    expect(screen.getAllByText('1-5 (5) of 5 records (page 1 of 1)').length).toBeGreaterThan(0)
  })

  it('ticked, the status counts them, and Disable or Enable is offered only for what it would change', async () => {
    server()
    const user = userEvent.setup()
    await openZone()
    await user.click(box('www A'))
    expect(screen.getByText('1 of 4 records selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Records' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Disable Records' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Enable Records' })).toBeDisabled()

    await user.click(box('old A'))
    expect(screen.getByRole('button', { name: 'Enable Records' })).toBeEnabled()
  })

  it('Select all ticks every selectable record on the page, and again clears them', async () => {
    server()
    const user = userEvent.setup()
    await openZone()
    await user.click(screen.getByRole('checkbox', { name: 'Select all records' }))
    expect(screen.getByText('4 of 4 records selected')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Select all records' }))
    expect(screen.queryByText(/records selected/)).toBeNull()
  })

  it.each([
    ['Secondary', { ...ZONE, type: 'Secondary' }],
    ['Stub', { ...ZONE, type: 'Stub' }],
  ])('a %s zone, whose rows offer no action, draws no box and no verb', async (_t, zone) => {
    server({ zone })
    await openZone()
    expect(screen.queryAllByRole('checkbox')).toEqual([])
    expect(screen.queryByRole('button', { name: 'Delete Records' })).toBeNull()
  })

  it('without Modify or Delete on the zone there is no box and no verb', async () => {
    server()
    await openZone({ canModify: false, canDelete: false })
    expect(screen.queryAllByRole('checkbox')).toEqual([])
    expect(screen.queryByRole('button', { name: 'Delete Records' })).toBeNull()
  })

  it('each verb follows its permission, as the row does', async () => {
    server()
    const user = userEvent.setup()
    await openZone({ canModify: true, canDelete: false })
    await user.click(box('www A'))
    expect(screen.getByRole('button', { name: 'Delete Records' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disable Records' })).toBeEnabled()
  })
})

describe('a zone records: Delete Records', () => {
  it('asks first, naming every record, and Cancel sends nothing', async () => {
    const { calls } = server()
    const user = userEvent.setup()
    await openZone()
    await user.click(box('www A'))
    await user.click(box('nas A'))
    await user.click(screen.getByRole('button', { name: 'Delete Records' }))

    const dialog = await screen.findByRole('dialog', { name: 'Delete Records' })
    expect(dialog.textContent).toContain('Are you sure you want to permanently delete the following 2 records?')
    expect(dialog.textContent).toContain('www.casa.test A 10.0.0.5')
    expect(dialog.textContent).toContain('nas.casa.test A 10.0.0.50')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(of(calls, 'zones/records/delete')).toEqual([])
  })

  it('sends each one with its row body, one after another, then reads the zone once', async () => {
    const { spy, calls } = server()
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    const base = spy.getMockImplementation()!
    spy.mockImplementation(async (route, init) => {
      const answer = base(route, init)
      if (route.startsWith('zones/records/delete') && (init?.body as Record<string, string>).domain === 'www.casa.test') await gate
      return answer
    })
    const user = userEvent.setup()
    await openZone()
    const reads = of(calls, 'zones/records/get').length
    await user.click(box('www A'))
    await user.click(box('nas A'))
    await user.click(screen.getByRole('button', { name: 'Delete Records' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete Records' })).getByRole('button', { name: 'Delete' }))

    /* The second waits for the first. */
    await waitFor(() => expect(of(calls, 'zones/records/delete')).toHaveLength(1))
    expect(of(calls, 'zones/records/delete')[0].body).toMatchObject({ zone: 'casa.test', domain: 'www.casa.test', type: 'A', ipAddress: '10.0.0.5', updateSvcbHints: 'false' })
    await act(async () => release())
    await waitFor(() => expect(of(calls, 'zones/records/delete')).toHaveLength(2))
    expect(of(calls, 'zones/records/delete')[1].body).toMatchObject({ domain: 'nas.casa.test', ipAddress: '10.0.0.50' })

    expect(await screen.findByText('All selected records were deleted successfully.')).toBeInTheDocument()
    expect(of(calls, 'zones/records/get')).toHaveLength(reads + 1)
    expect(screen.queryByText(/records selected/)).toBeNull()
  })

  it('says how many failed, with the first reason, and still reads the zone once', async () => {
    const { calls } = server({ fail: ['nas.casa.test'] })
    const user = userEvent.setup()
    await openZone()
    const reads = of(calls, 'zones/records/get').length
    await user.click(screen.getByRole('checkbox', { name: 'Select all records' }))
    await user.click(screen.getByRole('button', { name: 'Delete Records' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete Records' })).getByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByText('A total of 1 record(s) of the selected 4 record(s) failed to delete: Cannot change nas.casa.test.'),
    ).toBeInTheDocument()
    expect(of(calls, 'zones/records/delete')).toHaveLength(4)
    expect(of(calls, 'zones/records/get')).toHaveLength(reads + 1)
  })
})

describe('a zone records: Disable Records and Enable Records', () => {
  it('Disable asks, then sends only the enabled ones, each with its own TTL and expiry', async () => {
    const { calls } = server()
    const user = userEvent.setup()
    await openZone()
    await user.click(box('www A'))
    await user.click(box('old A'))
    await user.click(screen.getByRole('button', { name: 'Disable Records' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disable Records' })
    expect(dialog.textContent).toContain('Are you sure you want to disable the following record?')
    expect(dialog.textContent).not.toContain('old.casa.test')
    await user.click(within(dialog).getByRole('button', { name: 'Disable' }))

    expect(await screen.findByText('All selected records were disabled successfully.')).toBeInTheDocument()
    const updates = of(calls, 'zones/records/update')
    expect(updates).toHaveLength(1)
    expect(updates[0].body).toMatchObject({ domain: 'www.casa.test', type: 'A', disable: 'true', ttl: '3600', expiryTtl: '3600' })
  })

  it('Enable asks nothing, as the row does, and sends only the disabled ones', async () => {
    const { calls } = server()
    const user = userEvent.setup()
    await openZone()
    await user.click(box('www A'))
    await user.click(box('old A'))
    await user.click(screen.getByRole('button', { name: 'Enable Records' }))

    expect(await screen.findByText('All selected records were enabled successfully.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    const updates = of(calls, 'zones/records/update')
    expect(updates).toHaveLength(1)
    expect(updates[0].body).toMatchObject({ domain: 'old.casa.test', disable: 'false' })
  })

  it('a failure is counted in the same words, with its verb', async () => {
    server({ fail: ['old.casa.test'] })
    const user = userEvent.setup()
    await openZone()
    await user.click(box('old A'))
    await user.click(screen.getByRole('button', { name: 'Enable Records' }))
    expect(
      await screen.findByText('A total of 1 record(s) of the selected 1 record(s) failed to enable: Cannot change old.casa.test.'),
    ).toBeInTheDocument()
  })
})

describe('a zone records: the selection is the page on screen', () => {
  const many = Array.from({ length: 12 }, (_, i) => record(`h${i}.casa.test`, 'A', { ipAddress: `10.0.0.${i}` }))

  it('is cleared by another page', async () => {
    server({ records: many })
    const user = userEvent.setup()
    await openZone()
    await user.click(box('h0 A'))
    expect(screen.getByText('1 of 10 records selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(screen.queryByText(/records selected/)).toBeNull()
    await user.click(screen.getByRole('button', { name: '1' }))
    expect(box('h0 A')).not.toBeChecked()
  })

  it('is cleared when a filter is applied', async () => {
    server({ records: many })
    const user = userEvent.setup()
    await openZone()
    await user.click(box('h1 A'))
    await user.type(screen.getByLabelText('Data contains'), '10.0.0.1{Enter}')
    expect(screen.queryByText(/records selected/)).toBeNull()
    expect(box('h1 A')).not.toBeChecked()
  })
})
