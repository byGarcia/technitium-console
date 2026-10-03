import { afterEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DnsClient } from './DnsClient'
import * as api from '../../api/dnsclient'
import * as client from '../../api/client'

/*
Arriving from another screen's "Query DNS Server": `queryDnsServer`
(dnsclient.js:231-257) fills the form and runs `resolveQuery()`.
*/

afterEach(() => vi.restoreAllMocks())

const NODES = [
  { name: 'node1.example', type: 'Primary' },
  { name: 'node2.example', type: 'Secondary' },
]

function resolved() {
  return vi.spyOn(api, 'resolve').mockResolvedValue({
    kind: 'ok',
    data: { status: 'ok', response: { result: { answer: 'ok' } } },
  } as never)
}

describe('DNS Client: a query handed over by another screen', () => {
  it('the form is filled as upstream fills it and the query runs once on arrival', async () => {
    const spy = resolved()
    render(
      <StrictMode>
        <DnsClient token="t" request={{ domain: 'github.com', type: 'AAAA', node: '' }} />
      </StrictMode>,
    )

    expect(await screen.findByText(/"answer": "ok"/)).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toMatchObject({
      server: 'this-server',
      domain: 'github.com',
      type: 'AAAA',
      protocol: 'UDP',
      dnssec: false,
      eDnsClientSubnet: '',
      runImport: false,
      node: '',
    })
    expect(screen.getByLabelText('Server')).toHaveValue('This Server {this-server}')
    expect(screen.getByLabelText('Domain')).toHaveValue('github.com')
    expect(screen.getByLabelText('EDNS Client Subnet')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Enable DNSSEC Validation' })).not.toBeChecked()
  })

  it('the node in the request is chosen in the selector and the query asks it', async () => {
    const spy = resolved()
    render(
      <DnsClient
        token="t"
        nodes={NODES}
        clusterInitialised
        request={{ domain: 'github.com', type: 'A', node: 'node2.example' }}
      />,
    )
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(spy.mock.calls[0][1].node).toBe('node2.example')
    expect(screen.getByText('node2.example (secondary)')).toBeInTheDocument()
  })

  it('the node travels to the server as the node parameter', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { result: {} } },
    } as never)
    render(<DnsClient token="t" request={{ domain: 'github.com', type: 'A', node: 'node2.example' }} />)
    await waitFor(() => {
      const call = spy.mock.calls.find((c) => c[0] === 'dnsClient/resolve')
      expect(call?.[1]?.node).toBe('node2.example')
    })
  })

  it('an empty domain warns with the literal text and asks nothing', async () => {
    const spy = resolved()
    render(<DnsClient token="t" request={{ domain: '', type: 'null', node: '' }} />)
    expect(await screen.findByText('Please enter a domain name to query.')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('without a request nothing runs and DNSSEC validation starts checked', async () => {
    const spy = resolved()
    render(<DnsClient token="t" />)
    expect(screen.getByRole('checkbox', { name: 'Enable DNSSEC Validation' })).toBeChecked()
    expect(screen.getByText('Run a query to see the response.')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('the node chosen by hand is the one Resolve asks', async () => {
    const spy = resolved()
    render(<DnsClient token="t" nodes={NODES} clusterInitialised />)
    await userEvent.click(screen.getByLabelText('Cluster Node'))
    await userEvent.click(screen.getByRole('option', { name: 'node1.example (primary)' }))
    await userEvent.type(screen.getByLabelText('Domain'), 'home.test')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(spy.mock.calls[0][1].node).toBe('node1.example')
  })
})
