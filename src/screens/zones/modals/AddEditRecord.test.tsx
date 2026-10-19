import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEditRecord, type AddEditRecordProps } from './AddEditRecord'
import * as records from '../../../api/records'
import * as appsApi from '../../../api/apps'
import { chooseIn } from '../../../test/dropdown'

/*
The record form against `modifyAddRecordFormByType` and its handlers
(zone.js:543-603, 4489-4796, 5336-5395).
*/

afterEach(() => vi.restoreAllMocks())

const ZONE_INFO = { name: 'casa.test', type: 'Primary', dnssecStatus: 'Unsigned' } as never

function props(over: Partial<AddEditRecordProps> = {}): AddEditRecordProps {
  return {
    open: true,
    mode: 'add',
    zone: 'casa.test',
    zoneInfo: ZONE_INFO,
    records: [],
    token: 't',
    defaults: { defaultRecordTtl: 3600, defaultNsRecordTtl: 14400, defaultSoaRecordTtl: 900, dnssecValidation: true },
    onClose: () => {},
    onDone: () => {},
    onExpiryTtl: () => {},
    ...over,
  }
}

function added() {
  return vi.spyOn(records, 'addRecord').mockResolvedValue({ kind: 'ok', data: {} } as never)
}

describe('record form: changing the type', () => {
  it('empties the TTL and the previous type fields, and the TTL placeholder follows the type', async () => {
    const user = userEvent.setup()
    render(<AddEditRecord {...props()} />)
    expect(screen.getByLabelText('TTL')).toHaveValue('')
    expect(screen.getByLabelText('TTL')).toHaveAttribute('placeholder', '3600')
    await user.type(screen.getByLabelText('IPv4 Address'), '10.0.0.1')
    await user.type(screen.getByLabelText('TTL'), '600')

    await chooseIn(user, 'Type', 'NS')
    expect(screen.getByLabelText('TTL')).toHaveValue('')
    expect(screen.getByLabelText('TTL')).toHaveAttribute('placeholder', '14400')
    expect(screen.getByText('seconds (default 14400)')).toBeInTheDocument()

    await chooseIn(user, 'Type', 'AAAA')
    expect(screen.getByLabelText('IPv6 Address')).toHaveValue('')
  })

  it('an empty TTL travels empty, so the server applies its default', async () => {
    const user = userEvent.setup()
    const spy = added()
    render(<AddEditRecord {...props()} />)
    await user.type(screen.getByLabelText('Name'), 'www')
    await user.type(screen.getByLabelText('IPv4 Address'), '10.0.0.1')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(spy.mock.calls[0][1]).toMatchObject({ ttl: '' })
  })

  it('the Name placeholder follows the type', async () => {
    const user = userEvent.setup()
    render(<AddEditRecord {...props()} />)
    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', '@')
    await chooseIn(user, 'Type', 'SRV')
    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', '_service._protocol.name')
  })

  it('reopening keeps the type it was left on', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AddEditRecord {...props()} />)
    await chooseIn(user, 'Type', 'TXT')
    rerender(<AddEditRecord {...props({ open: false })} />)
    rerender(<AddEditRecord {...props({ open: true })} />)
    expect(screen.getByLabelText('Type')).toHaveTextContent('TXT')
  })

  it('a reverse zone opens on PTR', () => {
    render(<AddEditRecord {...props({ zone: '1.168.192.in-addr.arpa' })} />)
    expect(screen.getByLabelText('Type')).toHaveTextContent('PTR')
  })

  it('"Create reverse zone" is only enabled while the PTR box is ticked', async () => {
    const user = userEvent.setup()
    render(<AddEditRecord {...props()} />)
    const zone = screen.getByRole('checkbox', { name: /Create reverse zone/ })
    expect(zone).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Add reverse (PTR) record' }))
    expect(zone).toBeEnabled()
  })
})

const FORWARDER = { name: 'casa.test', type: 'Forwarder', dnssecStatus: 'Unsigned' } as never

/* FWD is only offered in a Forwarder zone. */
describe('record form: FWD', () => {
  it('starts at TTL 0, fixed, with DNSSEC validation as the server', async () => {
    const user = userEvent.setup()
    render(<AddEditRecord {...props({ zoneInfo: FORWARDER })} />)
    await chooseIn(user, 'Type', 'FWD')
    expect(screen.getByLabelText('TTL')).toHaveValue('0')
    expect(screen.getByLabelText('TTL')).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Enable DNSSEC Validation' })).toBeChecked()
  })

  it('"Use This Server" sends this-server on UDP and hides the proxy', async () => {
    const user = userEvent.setup()
    const spy = added()
    render(<AddEditRecord {...props({ zoneInfo: FORWARDER })} />)
    await chooseIn(user, 'Type', 'FWD')
    await user.type(screen.getByLabelText('Name'), 'fwd')
    await user.click(screen.getByRole('radio', { name: 'DNS-over-TLS' }))
    await user.click(screen.getByRole('checkbox', { name: 'Use "This Server"' }))

    expect(screen.getByLabelText('Forwarder')).toHaveValue('this-server')
    expect(screen.getByLabelText('Forwarder')).toBeDisabled()
    expect(screen.queryByText('Network Proxy')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(spy.mock.calls[0][1]).toMatchObject({ forwarder: 'this-server', protocol: 'Udp' })
  })
})

describe('record form: APP', () => {
  it('choosing a class fills Record Data with its template, and changing the app empties both', async () => {
    const user = userEvent.setup()
    vi.spyOn(appsApi, 'listApps').mockResolvedValue({
      kind: 'ok',
      data: {
        response: {
          apps: [
            {
              name: 'Split Horizon',
              version: '1',
              description: '',
              dnsApps: [
                { classPath: 'SplitHorizon.SimpleAddress', recordDataTemplate: '{"public": []}', isAppRecordRequestHandler: true },
              ],
            },
            {
              name: 'Geo',
              version: '1',
              description: '',
              dnsApps: [{ classPath: 'Geo.Address', recordDataTemplate: null, isAppRecordRequestHandler: true }],
            },
          ],
        },
      },
    } as never)
    render(<AddEditRecord {...props()} />)
    await chooseIn(user, 'Type', 'APP')
    await chooseIn(user, 'App Name', 'Split Horizon')
    await chooseIn(user, 'Class Path', 'SplitHorizon.SimpleAddress')
    expect(screen.getByLabelText('Record Data (if any)')).toHaveValue('{"public": []}')

    await chooseIn(user, 'App Name', 'Geo')
    expect(screen.getByLabelText('Record Data (if any)')).toHaveValue('')
    expect(screen.getByLabelText('Class Path')).not.toHaveTextContent('SplitHorizon')
  })
})

describe('record form: SVCB params', () => {
  it('a new param opens on a dropdown of known keys; "Unknown" turns it into a key number', async () => {
    const user = userEvent.setup()
    render(<AddEditRecord {...props()} />)
    await chooseIn(user, 'Type', 'SVCB')
    await user.click(screen.getByRole('button', { name: 'Add Param' }))
    expect(screen.getByLabelText('Param key 1')).toHaveTextContent('mandatory')

    await chooseIn(user, 'Param key 1', 'Unknown')
    expect(screen.getByLabelText('Param key 1')).toHaveAttribute('placeholder', 'key number')
    expect(screen.getByLabelText('Param value 1')).toHaveAttribute('placeholder', 'hex string')
  })
})
