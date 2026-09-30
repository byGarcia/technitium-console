import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../../api/client'
import * as dnssec from '../../../api/dnssec'
import type { ZoneOptions as ZoneOptionsResponse } from '../../../api/zones'
import { ZoneOptions } from './ZoneOptions'
import { SignZone } from './SignZone'
import { DnssecProperties } from './DnssecProperties'
import { AddEditRecord } from './AddEditRecord'

/*
Upstream explanations that had been missing from the zone modals since v15.4,
found by `dev/check-parity-controls.mjs`'s NOTE PARITY on 2026-09-30. Every
text is asserted literally, against index.html in v15.5.1.
*/

afterEach(() => vi.restoreAllMocks())

const noop = () => {}

function options(changes: Partial<ZoneOptionsResponse> = {}): ZoneOptionsResponse {
  return {
    name: 'casa.test',
    type: 'Primary',
    dnssecStatus: 'Unsigned',
    disabled: false,
    catalog: null,
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
    availableCatalogZoneNames: [],
    availableTsigKeyNames: [],
    ...changes,
  }
}

function serveOptions(r: ZoneOptionsResponse) {
  vi.spyOn(client, 'apiRequest').mockResolvedValue({
    kind: 'ok',
    data: { status: 'ok', response: r },
  } as never)
}

async function openOptions(r: ZoneOptionsResponse) {
  serveOptions(r)
  render(<ZoneOptions zone="casa.test" open token="t" onClose={noop} onDone={noop} />)
  return screen.findByRole('dialog')
}

const ACL_HELP =
  'Enter IP addresses or network addresses one below another to allow access. Add ! character at the start to deny access, e.g. !192.168.10.0/24 will deny entire subnet. The ACL is processed in the same order its listed. If no networks match, the default policy is to deny all.'

/** The ACL help carries two `<code>`: compare the element's whole text. */
function byWholeText(text: string) {
  return (_: string, el: Element | null) =>
    el != null &&
    el.textContent?.replace(/\s+/g, ' ').trim() === text &&
    Array.from(el.children).every((c) => c.textContent?.replace(/\s+/g, ' ').trim() !== text)
}

describe('Zone Options: the explanation under each radio', () => {
  it('Query Access: six radios, six texts, the ACL help and the Note', async () => {
    const dialog = await openOptions(options())
    for (const t of [
      'Denies everyone from querying the zone by refusing the request.',
      'Allows everyone to query the zone.',
      'Allows only private networks to query the zone. Any request from a public network will be refused.',
      'Allows only the name servers with an NS record in the zone to query the zone.',
      'Uses the specified network access control list to allow/deny to query the zone.',
      "Allows zone's name servers and uses specified network access control list to allow/deny to query the zone.",
      'The zone can always be queried from loopback IP addresses and internally by the DNS Server irrespective of the Query Access configuration.',
    ]) {
      expect(await within(dialog).findByText(t)).toBeTruthy()
    }
    expect(within(dialog).getByText(byWholeText(ACL_HELP))).toBeTruthy()
  })

  it('Zone Transfer: five texts, the ACL help and both Notes', async () => {
    const user = userEvent.setup()
    const dialog = await openOptions(options())
    await user.click(await within(dialog).findByRole('tab', { name: 'Zone Transfer' }))
    for (const t of [
      'Denies everyone from performing a zone transfer.',
      'Allows everyone to perform a zone transfer.',
      'Allows only the name servers with an NS record in the zone to perform a zone transfer.',
      'Uses the specified network access control list to allow/deny to perform a zone transfer.',
      "Allows zone's name servers and uses specified network access control list to allow/deny to perform a zone transfer.",
      'Zone transfer should be allowed only for trusted name servers to sync their secondary zone.',
      'TSIG key names must be configured from the Settings before using them here. Entering one or more TSIG key names above will cause the DNS Server to authenticate all zone transfer requests. A secondary zone must be configured with one of the above keys to be able to perform a zone transfer.',
    ]) {
      expect(within(dialog).getByText(t)).toBeTruthy()
    }
    expect(within(dialog).getByText(byWholeText(ACL_HELP))).toBeTruthy()
  })

  it('Notify on a Primary: four texts, the list help and the Note', async () => {
    const user = userEvent.setup()
    const dialog = await openOptions(options())
    await user.click(await within(dialog).findByRole('tab', { name: 'Notify' }))
    for (const t of [
      'Does not notify any name server when the zone is updated.',
      'Notifies only the name servers with an NS record in the zone when the zone is updated.',
      'Notifies only the specified name servers when the zone is updated.',
      "Notifies both the zone's name servers and the specified name servers when the zone is updated.",
      'Enter only the IP addresses of the name servers above.',
      'Notification must be enabled to allow other name servers to trigger a zone transfer immediately when the zone is updated.',
    ]) {
      expect(within(dialog).getByText(t)).toBeTruthy()
    }
  })

  it('Notify on a Catalog: the separate-servers radio and the Secondary Catalog list help', async () => {
    const user = userEvent.setup()
    const dialog = await openOptions(options({ type: 'Catalog', notify: 'None' }))
    await user.click(await within(dialog).findByRole('tab', { name: 'Notify' }))
    expect(
      within(dialog).getByText(
        'Notifies specified name servers for member zone updates and secondary catalog name servers for catalog zone updates.',
      ),
    ).toBeTruthy()
    expect(within(dialog).getByText('Enter only the IP addresses of the Secondary Catalog name servers above.')).toBeTruthy()
  })

  it('Dynamic Updates: five texts, the ACL help, Note, Warning and the security policy Note', async () => {
    const user = userEvent.setup()
    const dialog = await openOptions(options())
    await user.click(await within(dialog).findByRole('tab', { name: 'Dynamic Updates (RFC 2136)' }))
    for (const t of [
      'Denies everyone from performing dynamic updates.',
      'Allows everyone to perform dynamic updates.',
      'Allows only the name servers with an NS record in the zone to perform dynamic updates.',
      'Uses the specified network access control list to allow/deny to perform dynamic updates.',
      "Allows zone's name servers and uses specified network access control list to allow/deny to perform dynamic updates.",
      'Dynamic updates should be allowed only to trusted IP addresses since they will be able to add/delete records in the zone.',
      'If no security policy is configured in the Primary Zone then access will be provided only based on the options selected here. Thus setting up a security policy in the Primary Zone is highly recommended.',
      'Configuring a security policy above will cause the DNS Server to authenticate all dynamic update requests. A TSIG key can add/delete records only for the specified domain name and allowed record types. TSIG key names must be configured from the Settings before using them here. Use wildcard domain name to specify all sub domain names. Use a comma separator to specify more than one record type. Use ANY to specify all record types.',
    ]) {
      expect(within(dialog).getByText(t)).toBeTruthy()
    }
    expect(within(dialog).getByText(byWholeText(ACL_HELP))).toBeTruthy()
  })

  it('General with catalogs available: the select help, the three override helps and the Note', async () => {
    const dialog = await openOptions(options({ availableCatalogZoneNames: ['cat.test'] }))
    for (const t of [
      'Select a Catalog zone to register as its member zone.',
      'Enable to override Query Access option in the Catalog zone.',
      'Enable to override Zone Transfer option in the Catalog zone.',
      'Enable to override Notify option in the Catalog zone.',
      "When a zone becomes a member of a Catalog zone, all of the Catalog zone's Options are inherited unless they are explicitly overridden using the Override Options.",
    ]) {
      expect(await within(dialog).findByText(t)).toBeTruthy()
    }
  })

  it('General on a Secondary: the ZONEMD validation help', async () => {
    const dialog = await openOptions(
      options({ type: 'Secondary', primaryNameServerAddresses: [], primaryZoneTransferProtocol: 'Tcp' }),
    )
    expect(
      await within(dialog).findByText(
        'When enabled, the secondary zone will be validated using the ZONEMD record after every zone transfer. The zone will get disabled if the validation fails. The zone must be DNSSEC signed for the validation to work.',
      ),
    ).toBeTruthy()
  })
})

const NSEC_HELP =
  'With NSEC, all the records in your zone can be discovered by anyone using "zone walking" technique. NSEC is recommended if your zone does not contain any private/internal records.'
const NSEC3_HELP =
  'NSEC3, makes it difficult to perform "zone walking" since it uses hashing with a random salt. NSEC3 should be used if your zone contains any private/internal records that you do not wish to be enumerable.'

describe('Proof of Non-Existence: upstream wording, not a summary', () => {
  it('Sign Zone prints both explanations literally', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<SignZone zone="casa.test" open token="t" onClose={noop} onDone={noop} />)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(NSEC_HELP)).toBeTruthy()
    expect(within(dialog).getByText(NSEC3_HELP)).toBeTruthy()
    expect(within(dialog).queryByText(/NSEC3 makes it difficult since/)).toBeNull()
  })

  it('DNSSEC Properties prints both too', async () => {
    vi.spyOn(dnssec, 'getProperties').mockResolvedValue({
      name: 'casa.test',
      type: 'Primary',
      internal: false,
      disabled: false,
      dnssecStatus: 'SignedWithNSEC',
      dnsKeyTtl: 3600,
      dnssecPrivateKeys: [],
    } as never)
    render(
      <DnssecProperties zone="casa.test" open token="t" onClose={noop} onConfirm={noop} onChanged2={noop} />,
    )
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(NSEC_HELP)).toBeTruthy()
    expect(within(dialog).getByText(NSEC3_HELP)).toBeTruthy()
  })
})

describe('Add/Edit Record, TLSA', () => {
  it('explains the Certificate Association Data field', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(
      <AddEditRecord
        open
        mode="update"
        zone="casa.test"
        zoneInfo={{ name: 'casa.test', type: 'Primary', dnssecStatus: 'SignedWithNSEC', disabled: false } as never}
        records={[]}
        original={
          {
            name: '_443._tcp.casa.test',
            type: 'TLSA',
            ttl: 3600,
            disabled: false,
            rData: {
              certificateUsage: 'DANE-EE',
              selector: 'SPKI',
              matchingType: 'SHA2-256',
              certificateAssociationData: 'AB',
            },
          } as never
        }
        token="t"
        onClose={noop}
        onDone={noop}
        onExpiryTtl={noop}
      />,
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Certificate Association Data')).toBeTruthy()
    expect(
      within(dialog).getByText(
        'Enter either a hash value that you have independently generated, OR enter the certificate in PEM format to automatically generate the association data based on the Selector and Matching Type values.',
      ),
    ).toBeTruthy()
  })
})
