import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import * as zonesApi from '../../../api/zones'
import * as dnssecApi from '../../../api/dnssec'
import type { ZoneOptions as ZoneOptionsResponse, ZonePermissions as PermissionsResponse } from '../../../api/zones'
import type { InfoDs } from '../../../api/dnssec'
import { deferred, type Deferred } from '../../../test/deferred'
import { valueShown } from '../../../test/dropdown'
import { ZoneOptions } from './ZoneOptions'
import { ZonePermissions } from './ZonePermissions'
import { ViewDs } from './ViewDs'

/*
Answers that arrive out of order. These dialogs stay mounted in Zones and read the
zone they are opened for. Closed and opened again for another zone while the first
read is in flight, they must draw only the zone opened last: an older answer would
fill Zone Options or Permissions with the other zone's values, and Save would send
them to this one.
*/

afterEach(() => vi.restoreAllMocks())

const noop = () => {}

type Ok<T> = { kind: 'ok'; data: T }

function asking<T>() {
  const asked = new Map<string, Deferred<Ok<T>>>()
  const fake = (_t: string | null, zone: string) => {
    const d = deferred<Ok<T>>()
    asked.set(zone, d)
    return d.promise as never
  }
  return { asked, fake }
}

/** Opens the dialog for a.test, closes it, and opens it for b.test, with a.test's read unanswered. */
async function reopen(draw: (zone: string, open: boolean) => ReactElement, asked: Map<string, unknown>) {
  const view = render(draw('a.test', true))
  await waitFor(() => expect(asked.has('a.test')).toBe(true))
  view.rerender(draw('a.test', false))
  view.rerender(draw('b.test', true))
  await waitFor(() => expect(asked.has('b.test')).toBe(true))
}

function options(catalog: string): ZoneOptionsResponse {
  return {
    name: 'x.test',
    type: 'Primary',
    dnssecStatus: 'Unsigned',
    disabled: false,
    catalog,
    queryAccess: 'Allow',
    queryAccessNetworkACL: [],
    zoneTransfer: 'AllowOnlyZoneNameServers',
    zoneTransferNetworkACL: [],
    zoneTransferTsigKeyNames: [],
    notify: 'ZoneNameServers',
    notifyNameServers: [],
    update: 'Deny',
    updateNetworkACL: [],
    updateSecurityPolicies: [],
    availableCatalogZoneNames: ['cat-a.test', 'cat-b.test'],
    availableTsigKeyNames: [],
  }
}

describe('zone dialogs opened again for another zone', () => {
  it('Zone Options fills its form only from the zone opened last', async () => {
    const { asked, fake } = asking<ZoneOptionsResponse>()
    vi.spyOn(zonesApi, 'getZoneOptions').mockImplementation(fake)
    await reopen(
      (zone, open) => <ZoneOptions zone={zone} open={open} token="t" onClose={noop} onDone={noop} />,
      asked,
    )
    await act(async () => asked.get('b.test')!.resolve({ kind: 'ok', data: options('cat-b.test') }))
    await act(async () => asked.get('a.test')!.resolve({ kind: 'ok', data: options('cat-a.test') }))
    expect(valueShown(screen.getByLabelText('Catalog Zone'))).toBe('cat-b.test')
  })

  it('Zone Permissions draws only the zone opened last', async () => {
    const { asked, fake } = asking<PermissionsResponse>()
    vi.spyOn(zonesApi, 'getZonePermissions').mockImplementation(fake)
    await reopen(
      (zone, open) => (
        <ZonePermissions zone={zone} open={open} token="t" canModify onClose={noop} onDone={noop} />
      ),
      asked,
    )
    const answer = (subItem: string): Ok<PermissionsResponse> => ({
      kind: 'ok',
      data: { section: 'Zones', subItem, userPermissions: [], groupPermissions: [] },
    })
    await act(async () => asked.get('b.test')!.resolve(answer('b.test')))
    await act(async () => asked.get('a.test')!.resolve(answer('a.test')))
    expect(screen.getByRole('heading', { name: 'Edit Permissions - Zones / b.test' })).toBeInTheDocument()
  })

  it('View DS Info draws only the keys of the zone opened last', async () => {
    const { asked, fake } = asking<InfoDs>()
    vi.spyOn(dnssecApi, 'viewDs').mockImplementation(fake)
    await reopen((zone, open) => <ViewDs zone={zone} open={open} token="t" onClose={noop} />, asked)
    const answer = (keyTag: number): Ok<InfoDs> => ({
      kind: 'ok',
      data: {
        name: 'x.test',
        type: 'Primary',
        disabled: false,
        dnssecStatus: 'SignedWithNSEC',
        dsRecords: [
          {
            keyTag,
            dnsKeyState: 'Active',
            isRetiring: false,
            algorithm: 'ECDSAP256SHA256',
            algorithmNumber: 13,
            publicKey: 'AAAA',
            digests: [],
          },
        ],
      },
    })
    await act(async () => asked.get('b.test')!.resolve(answer(22222)))
    await act(async () => asked.get('a.test')!.resolve(answer(11111)))
    expect(screen.getByText('22222')).toBeInTheDocument()
    expect(screen.queryByText('11111')).not.toBeInTheDocument()
  })
})
