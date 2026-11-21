/*
A zone's records filtered by what their data says (deviation 53): `Data contains`
beside Name and Type, applied with them by Go or Enter, kept in the bar as
`?rdata=` the way `?rname=` and `?rtype=` are, and left behind with the zone.
*/
import { render, screen, within } from '@testing-library/react'
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

const record = (name: string, type: string, rData: Record<string, unknown>) => ({
  name, type, ttl: 3600, ttlString: '1h', disabled: false, rData, dnssecStatus: 'Unknown',
  lastUsedOn: '0001-01-01T00:00:00', lastModified: '2026-08-26T10:00:00Z', expiryTtl: 0, expiryTtlString: '0s',
})

const RECORDS = [
  record('casa.test', 'NS', { nameServer: 'ns1.casa.test' }),
  record('www.casa.test', 'A', { ipAddress: '10.0.0.5' }),
  record('nas.casa.test', 'A', { ipAddress: '10.0.0.50' }),
  record('printer.casa.test', 'A', { ipAddress: '192.168.1.9' }),
  record('mail.casa.test', 'MX', { preference: 10, exchange: 'mx1.example.net' }),
]

function server() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (route) => {
    const base = route.split('?')[0]
    if (base === 'zones/list') {
      return { kind: 'ok', data: { status: 'ok', response: { zones: [ZONE], pageNumber: 1, totalPages: 1, totalZones: 1 } } } as never
    }
    if (base === 'zones/records/get') {
      return { kind: 'ok', data: { status: 'ok', response: { zone: ZONE, records: RECORDS } } } as never
    }
    return { kind: 'ok', data: { status: 'ok' } } as never
  })
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

const bar = () => window.location.pathname + window.location.search
/* The records table's names, in order: each body row's Name, the fifth cell from its end. */
const names = () =>
  within(screen.getAllByRole('table')[0])
    .getAllByRole('row')
    .slice(1)
    .map((r) => {
      const cells = within(r).getAllByRole('cell')
      return cells[cells.length - 5]?.textContent ?? ''
    })

beforeEach(() => servedAt('/zones/?zone=casa.test'))
afterEach(() => {
  vi.restoreAllMocks()
  servedAt('/', null)
})

describe('a zone records filtered by their data', () => {
  it('applies on Go with the name and type filters, and goes to the bar as rdata', async () => {
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByRole('heading', { name: 'casa.test' })
    expect(names()).toHaveLength(5)

    await user.type(screen.getByLabelText('Data contains'), '10.0.0.5')
    /* Typed is not applied: upstream's fields wait for Go, and so does this one. */
    expect(names()).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(names()).toEqual(['www', 'nas'])
    expect(bar()).toBe('/zones/?zone=casa.test&rdata=10.0.0.5')

    await user.type(screen.getByLabelText('Name'), 'n*')
    await user.keyboard('{Enter}')
    expect(names()).toEqual(['nas'])
  })

  it('Enter in the field applies it, and a type pressed in the summary keeps it', async () => {
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByRole('heading', { name: 'casa.test' })

    await user.type(screen.getByLabelText('Data contains'), 'example.net{Enter}')
    expect(names()).toEqual(['mail'])
    const types = within(screen.getByRole('group', { name: 'Records by type' })).getAllByRole('button')
    await user.click(types.find((b) => b.firstChild?.textContent === 'A')!)
    expect(screen.getByText('No Record Found')).toBeInTheDocument()
  })

  it('a reload with rdata in the bar lands filtered, and the field says it', async () => {
    servedAt('/zones/?zone=casa.test&rdata=192.168')
    server()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByRole('heading', { name: 'casa.test' })
    expect(screen.getByLabelText('Data contains')).toHaveValue('192.168')
    expect(names()).toEqual(['printer'])
  })

  it('going back to the list leaves it behind', async () => {
    servedAt('/zones/?zone=casa.test&rdata=10.0')
    server()
    const user = userEvent.setup()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByRole('heading', { name: 'casa.test' })
    await user.click(screen.getByRole('button', { name: 'Zones' }))
    await screen.findByRole('button', { name: 'casa.test' })
    expect(bar()).toBe('/zones/')
  })
})
