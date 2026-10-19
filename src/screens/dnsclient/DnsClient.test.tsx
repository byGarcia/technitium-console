import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DnsClient } from './DnsClient'
import * as api from '../../api/dnsclient'

afterEach(() => vi.restoreAllMocks())

describe('DNS Client', () => {
  it('it requires the domain with the literal text of upstream', async () => {
    render(<DnsClient token="t" />)
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(await screen.findByText('Please enter a domain name to query.')).toBeInTheDocument()
  })

  it('it requires the server with the literal text, and before the domain', async () => {
    render(<DnsClient token="t" />)
    await userEvent.clear(screen.getByLabelText('Server'))
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(await screen.findByText('Please enter a valid Name Server.')).toBeInTheDocument()
  })

  it('Resolve does not import; Import does', async () => {
    const spy = vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: { result: { ok: true } } },
    } as never)
    render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'home.test')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(spy.mock.calls[0][1].runImport).toBeFalsy()
    spy.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(spy.mock.calls[0][1].runImport).toBe(true)
  })

  it('on importing it confirms with the literal text', async () => {
    vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: { result: {} } },
    } as never)
    render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'home.test')
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(
      await screen.findByText('Resource records resolved by this DNS client query were successfully imported into this server.'),
    ).toBeInTheDocument()
  })

  /*
  The second panel of upstream's accordion ("Raw Responses (N)",
  `dnsclient.js:178-194`) was missing entirely: the API type already declared
  `rawResponses` and nobody drew it. It is what lets you see what each server
  answered along the way when a recursive query goes wrong.
  */
  it('it shows the raw responses, collapsed and with their count', async () => {
    vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { result: {}, rawResponses: [{ a: 1 }, { b: 2 }, { c: 3 }] } },
    } as never)
    render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'home.test')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))

    const summary = await screen.findByText('Raw Responses (3)')
    // Collapsed, as in upstream: the final answer is what gets looked at first.
    expect(summary.closest('details')).not.toHaveAttribute('open')
  })

  it('with no raw responses there is no panel to open', async () => {
    vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: { result: {}, rawResponses: [] } },
    } as never)
    render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'home.test')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await screen.findByText('Response')
    expect(screen.queryByText(/Raw Responses/)).not.toBeInTheDocument()
  })

  it('a warningMessage from the server is shown as an alert and beats the imported one', async () => {
    vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: { result: {}, warningMessage: 'Watch out for this' } },
    } as never)
    render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'home.test')
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('Watch out for this')).toBeInTheDocument()
    expect(screen.queryByText(/successfully imported/)).not.toBeInTheDocument()
  })

  /*
 The DNSSEC checkbox moved to `ui/Check` in the redesign: it was an `<input>` with
 its own `.chk`, a third name for the same gesture and the only place in the
 console where it measured 34 px high. Nothing covered it, so migrating it was a
 change without a net, and every call site has to keep its accessible name and its
 behaviour.
  */
  it('the DNSSEC checkbox keeps its accessible name and can be ticked', async () => {
    render(<DnsClient token="t" />)

    const checkbox = screen.getByLabelText('Enable DNSSEC Validation')
    expect(checkbox).toHaveProperty('type', 'checkbox')
    /* It starts CHECKED (`useState(true)`, DnsClient.tsx:62). That was checked by
 reading the source and not by assuming: the first version of this test took for granted
 that it started empty and failed because of that, not because of the component. */
    expect(checkbox).toBeChecked()

    await userEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })
})

import * as quick from '../../lib/quick-lists'

/*
Issue #15: the list hung off a `<datalist>`, which the browser filters by what the
field already holds. The field starts as "This Server {this-server}", so the
arrow opened nothing. Upstream's is a dropdown (index.html:840-846): it shows
every server whatever the field says, and choosing one also moves the protocol
(dnsclient.js:24-47).
*/
describe('DNS Client: the server list', () => {
  function servers() {
    vi.spyOn(quick, 'loadQuickList').mockResolvedValue([
      { name: 'Google', addresses: ['8.8.8.8'] },
      { name: 'Cloudflare HTTPS', addresses: ['https://cloudflare-dns.com/dns-query (1.1.1.1)'] },
    ] as never)
  }

  it('opens with every server, whatever the field already holds', async () => {
    servers()
    render(<DnsClient token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Server list' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual([
      'This Server {this-server}',
      'Google {8.8.8.8}',
      'Cloudflare HTTPS {https://cloudflare-dns.com/dns-query (1.1.1.1)}',
    ])
  })

  it('choosing a server fills the field and the protocol follows it', async () => {
    servers()
    const spy = vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: { result: {} } },
    } as never)
    render(<DnsClient token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Server list' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Cloudflare HTTPS/ }))
    expect(screen.getByLabelText('Server')).toHaveValue(
      'Cloudflare HTTPS {https://cloudflare-dns.com/dns-query (1.1.1.1)}',
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Domain'), 'example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(spy.mock.calls[0][1]).toMatchObject({
      server: 'https://cloudflare-dns.com/dns-query (1.1.1.1)',
      protocol: 'HTTPS',
    })
  })

  it('the field stays free text: typing does not touch the protocol', async () => {
    servers()
    const spy = vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: { result: {} } },
    } as never)
    render(<DnsClient token="t" />)
    await userEvent.clear(screen.getByLabelText('Server'))
    await userEvent.type(screen.getByLabelText('Server'), 'https://doh.example/dns-query')
    await userEvent.type(screen.getByLabelText('Domain'), 'example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(spy.mock.calls[0][1]).toMatchObject({ server: 'https://doh.example/dns-query', protocol: 'UDP' })
  })
})
