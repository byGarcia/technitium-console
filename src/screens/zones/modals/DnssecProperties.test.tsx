import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dnssec from '../../../api/dnssec'
import { DnssecProperties } from './DnssecProperties'
import { wholeText } from '../../../test/whole-text'

/*
DNSSEC Properties against upstream's own modal (index.html, `modalDnssecProperties`):
the three state notes in upstream's words, the "Key Generation" label over its
radios, the DNSKEY TTL with its default and its "Update TTL" button, and the
warning under it.
*/

afterEach(() => vi.restoreAllMocks())

const noop = () => {}

function key(keyTag: number, keyType: string, state: string) {
  return {
    keyTag,
    keyType,
    algorithm: 'ECDSAP256SHA256',
    algorithmNumber: 13,
    state,
    stateChangedOn: '2026-11-01T10:00:00Z',
    isRetiring: false,
    rolloverDays: 0,
  }
}

function withKeys(keys: ReturnType<typeof key>[]) {
  vi.spyOn(dnssec, 'getProperties').mockResolvedValue({
    name: 'casa.test',
    type: 'Primary',
    internal: false,
    disabled: false,
    dnssecStatus: 'SignedWithNSEC',
    dnsKeyTtl: 3600,
    dnssecPrivateKeys: keys,
  } as never)
}

async function open() {
  render(<DnssecProperties zone="casa.test" open token="t" onClose={noop} onConfirm={noop} onChanged2={noop} />)
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByLabelText('DNSKEY TTL')
  return dialog
}

describe('DNSSEC Properties, against upstream', () => {
  it('a Published KSK shows the ready note in upstream words', async () => {
    withKeys([key(1, 'KeySigningKey', 'Published')])
    const dialog = await open()
    expect(
      within(dialog).getByText(
        wholeText(
          'Note! The Key State for a newly published Key Signing Key (KSK) must be Ready before you can add a DS record for it. Use the View DS Info option for more details on adding DS record.',
        ),
      ),
    ).toBeTruthy()
  })

  it('a Ready KSK shows the active note, and a Retired key the removal note', async () => {
    withKeys([key(1, 'KeySigningKey', 'Ready'), key(2, 'ZoneSigningKey', 'Retired')])
    const dialog = await open()
    expect(
      within(dialog).getByText(
        wholeText(
          'Note! The Key State for a Key Signing Key (KSK) will automatically switch from Ready to Active once you have added DS record for it and the DNS Server is able to detect it. Use the View DS Info option for more details on adding DS record. If this is a private zone, then you should manually activate the KSK so that the DNS Server stops the detection process which queries for DS records periodically.',
        ),
      ),
    ).toBeTruthy()
    expect(
      within(dialog).getByText(
        wholeText(
          'Note! The keys with Retired or Revoked Key State will be automatically unpublished and removed when its safe to do so.',
        ),
      ),
    ).toBeTruthy()
  })

  it('no key in those states, no note', async () => {
    withKeys([key(1, 'KeySigningKey', 'Active')])
    const dialog = await open()
    expect(within(dialog).queryByText('Note!')).toBeNull()
  })

  it('the key generation radios carry the "Key Generation" label', async () => {
    withKeys([])
    const user = userEvent.setup()
    const dialog = await open()
    await user.click(within(dialog).getByRole('button', { name: 'Add Private Key' }))
    const group = within(dialog).getByRole('radiogroup', { name: 'Key Generation' })
    expect(within(group).getByLabelText('Automatic Private Key Generation (default)')).toBeTruthy()
    expect(within(group).getByLabelText('Use Specified Private Key')).toBeTruthy()
  })

  it('the DNSKEY TTL says its default, updates with "Update TTL" and carries the warning', async () => {
    withKeys([])
    const ttl = vi.spyOn(dnssec, 'updateDnsKeyTtl').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    const user = userEvent.setup()
    const dialog = await open()
    expect(within(dialog).getByText('seconds (default 3600/1h)')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Save' })).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Update TTL' }))
    expect(ttl).toHaveBeenCalled()
    expect(
      within(dialog).getByText(
        wholeText(
          'Warning! You MUST wait for at least the number of seconds specified by the the old TTL value to elapse before making any changes to the DNS keys above to ensure that all recursive resolvers would have expired the DNSKEY records from its cache. For example, if the old TTL value was 3600, then you must wait for 3600 seconds (1 hour) to pass before making any changes to the DNS keys.',
        ),
      ),
    ).toBeTruthy()
  })

  it('NSEC3 iterations and salt length carry their ranges', async () => {
    vi.spyOn(dnssec, 'getProperties').mockResolvedValue({
      name: 'casa.test',
      type: 'Primary',
      internal: false,
      disabled: false,
      dnssecStatus: 'SignedWithNSEC3',
      dnsKeyTtl: 3600,
      nsec3Iterations: 0,
      nsec3SaltLength: 0,
      dnssecPrivateKeys: [],
    } as never)
    const dialog = await open()
    expect(within(dialog).getByText('(valid range 0-50, recommended 0)')).toBeTruthy()
    expect(within(dialog).getByText('bytes (valid range 0-32, recommended 0)')).toBeTruthy()
  })
})
