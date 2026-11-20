/*
The same thing in Zones, where the collection archetype was defined.

Zones had its own design round and this still got through: `zones`
starts as an empty array, so the wait drew "1-0 (0) of 0 zones" and an empty
table, which is what a server with no zones draws. A round that validated a
surface did not validate this state, which is the argument for the matrix.
*/
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { ZoneList } from './ZoneList'
import { ZoneRecords } from './ZoneRecords'
import * as recordsApi from '../../api/records'
import type { ZoneRecordsData } from '../../api/records'
import * as client from '../../api/client'
import * as zonesApi from '../../api/zones'
import type { Zone, ZoneList as ZonePage } from '../../api/zones'
import type { ApiOutcome } from '../../api/client'
import { deferred, type Deferred } from '../../test/deferred'

describe('a zone list that has not answered yet', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  const noop = () => {}
  const props: Parameters<typeof ZoneList>[0] = {
    token: 't',
    canModify: true,
    canDelete: true,
    onNotice: noop,
    onConfirm: noop,
    onAdd: noop,
    onOpen: noop,
    onEditZoneFile: noop,
    onImport: noop,
    onConvert: noop,
    onClone: noop,
    onPermissions: noop,
    onOptions: noop,
    refresh: 0,
  }

  it('says it is loading instead of showing an empty table', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(() => new Promise<never>(() => {}) as never)
    render(<ZoneList {...props} />)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('and a failed first load is not left saying it is loading', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'Nope' } as never)
    render(<ZoneList {...props} />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})

/*
A node change while a page is in flight launches another read: whichever answers
last, only the latest read is drawn, so a node's zones never show under another.
*/
describe('a zone list answered out of order', () => {
  afterEach(() => vi.restoreAllMocks())

  const noop = () => {}
  const props: Parameters<typeof ZoneList>[0] = {
    token: 't',
    canModify: true,
    canDelete: true,
    onNotice: noop,
    onConfirm: noop,
    onAdd: noop,
    onOpen: noop,
    onEditZoneFile: noop,
    onImport: noop,
    onConvert: noop,
    onClone: noop,
    onPermissions: noop,
    onOptions: noop,
    refresh: 0,
  }
  const zone = (name: string) => ({ name, type: 'Primary', lastModified: '', disabled: false, soaSerial: 1, notifyFailed: false, notifyFailedFor: [] }) as unknown as Zone
  const page = (name: string): ApiOutcome<ZonePage> => ({ kind: 'ok', data: { zones: [zone(name)], pageNumber: 1, totalPages: 1, totalZones: 1 } })

  it('draws only the page of the node asked last', async () => {
    const asked = new Map<string, Deferred<ApiOutcome<ZonePage>>>()
    vi.spyOn(zonesApi, 'listAllZones').mockResolvedValue(null)
    vi.spyOn(zonesApi, 'listZones').mockImplementation((_t, o = {}) => {
      const d = deferred<ApiOutcome<ZonePage>>()
      asked.set(o.node ?? '', d)
      return d.promise
    })
    const { rerender } = render(<ZoneList {...props} node="a.example" />)
    await waitFor(() => expect(asked.has('a.example')).toBe(true))
    rerender(<ZoneList {...props} node="b.example" refresh={1} />)
    await waitFor(() => expect(asked.has('b.example')).toBe(true))

    await act(async () => asked.get('b.example')!.resolve(page('b-zone.test')))
    await act(async () => asked.get('a.example')!.resolve(page('a-zone.test')))
    expect(screen.getByRole('button', { name: 'b-zone.test' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'a-zone.test' })).not.toBeInTheDocument()
  })
})

/* The same for a zone's records: a refresh while a read is in flight. */
describe('a zone answered out of order', () => {
  afterEach(() => vi.restoreAllMocks())

  const noop = () => {}
  const props = {
    zone: 'casa.test',
    token: 't',
    canModify: true,
    canDelete: true,
    onBack: noop,
    onNotice: noop,
    onConfirm: noop,
    onAddRecord: noop,
    onEditRecord: noop,
    onEditZoneFile: noop,
    onImport: noop,
    onConvert: noop,
    onClone: noop,
    onPermissions: noop,
    onOptions: noop,
    onSign: noop,
    onUnsign: noop,
    onViewDs: noop,
    onDnssecProperties: noop,
  }
  const read = (address: string): ApiOutcome<ZoneRecordsData> => ({
    kind: 'ok',
    data: {
      zone: { name: 'casa.test', type: 'Primary', disabled: false } as ZoneRecordsData['zone'],
      records: [{ name: 'www.casa.test', type: 'A', ttl: 3600, rData: { ipAddress: address }, disabled: false, dnssecStatus: 'Unknown' } as never],
    },
  })

  it('draws only the records of the read asked last', async () => {
    const reads: Deferred<ApiOutcome<ZoneRecordsData>>[] = []
    vi.spyOn(recordsApi, 'getRecords').mockImplementation(() => {
      const d = deferred<ApiOutcome<ZoneRecordsData>>()
      reads.push(d)
      return d.promise
    })
    const { rerender } = render(<ZoneRecords {...props} refresh={0} />)
    await waitFor(() => expect(reads).toHaveLength(1))
    rerender(<ZoneRecords {...props} refresh={1} />)
    await waitFor(() => expect(reads).toHaveLength(2))

    await act(async () => reads[1].resolve(read('10.0.0.2')))
    await act(async () => reads[0].resolve(read('10.0.0.1')))
    expect(screen.getByText('10.0.0.2')).toBeInTheDocument()
    expect(screen.queryByText('10.0.0.1')).not.toBeInTheDocument()
  })
})
