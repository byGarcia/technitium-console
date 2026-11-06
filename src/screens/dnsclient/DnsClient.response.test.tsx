import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DnsClient } from './DnsClient'
import * as api from '../../api/dnsclient'
import * as quick from '../../lib/quick-lists'
import real from './resolve.real.json'

/*
The answer as this screen draws it (deviation 18), against real envelopes from a
v15.6.1 server (`resolve.real.json`, 2026-11-06), and four upstream behaviours of
`resolveQuery()` this console had lost.
*/

afterEach(() => vi.restoreAllMocks())

type Key = Exclude<keyof typeof real, '_note'>

function answers(key: Key) {
  return vi.spyOn(api, 'resolve').mockResolvedValue({ kind: 'ok', data: real[key] } as never)
}

async function query(domain: string) {
  render(<DnsClient token="t" />)
  await userEvent.type(screen.getByLabelText('Domain'), domain)
  await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
}

function card(title: string) {
  return screen.getByRole('heading', { name: title }).closest('section')!
}

describe('DNS Client: the cards', () => {
  it('a signed answer: its code, its records by type, who answered and the flags it set', async () => {
    answers('example.com A dnssec')
    await query('example.com')

    const response = card('Response')
    expect(await within(response).findByText('NoError')).toBeInTheDocument()
    expect(within(response).getByText('StandardQuery')).toBeInTheDocument()

    const answer = card('Answer')
    expect(within(answer).getByText('3')).toBeInTheDocument()
    expect(within(answer).getByRole('img', { name: 'A 2, RRSIG 1' })).toBeInTheDocument()
    const types = within(answer).getByRole('list', { name: 'Answer by type' })
    expect(within(types).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A2', 'RRSIG1'])

    const server = card('Server')
    expect(within(server).getByText('ns1.example.net (127.0.0.1)')).toBeInTheDocument()
    expect(within(server).getByText('Udp')).toBeInTheDocument()
    expect(within(server).getByText('310.01 ms')).toBeInTheDocument()
    expect(within(server).getByText('179 bytes')).toBeInTheDocument()

    const flags = within(card('Flags')).getByRole('list', { name: 'Header flags' })
    expect(within(flags).getByText('Authentic Data: true')).toBeInTheDocument()
    expect(within(flags).getByText('Authoritative Answer: false')).toBeInTheDocument()
    expect(within(card('Flags')).getByText('DNSSEC_OK')).toBeInTheDocument()
    expect(within(card('Flags')).getByText('Secure 3')).toBeInTheDocument()
  })

  it('an NXDOMAIN: the code, and zero answers drawn as 0', async () => {
    answers('doesnotexist-zzq12345.com A')
    await query('doesnotexist-zzq12345.com')
    expect(await within(card('Response')).findByText('NxDomain')).toBeInTheDocument()
    const answer = card('Answer')
    expect(within(answer).getByText('0')).toBeInTheDocument()
    expect(within(answer).queryByRole('img')).not.toBeInTheDocument()
    expect(within(answer).getByText('Authority').nextElementSibling).toHaveTextContent('1')
  })

  it('the Extended DNS Error codes of the answer, once each', async () => {
    answers('example.org A recursive-resolver dnssec')
    await query('example.org')
    const response = card('Response')
    expect(await within(response).findByText('Refused')).toBeInTheDocument()
    expect(within(response).getAllByText('NoReachableAuthority')).toHaveLength(1)
  })

  it('a flag names itself in a tooltip on focus', async () => {
    answers('example.com A dnssec')
    await query('example.com')
    const flags = await screen.findByRole('list', { name: 'Header flags' })
    const ad = within(flags).getByText('AD').parentElement!
    ad.focus()
    expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Authentic Data')
  })
})

describe('DNS Client: the sections', () => {
  it('opens on the Answer, each tab with its count, the records in their columns', async () => {
    answers('gmail.com MX')
    await query('gmail.com')
    const tabs = await screen.findByRole('tablist', { name: 'Response sections' })
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Question (1)', 'Answer (5)', 'Authority (0)', 'Additional (1)', 'JSON',
    ])
    expect(within(tabs).getByRole('tab', { name: 'Answer (5)' })).toHaveAttribute('aria-selected', 'true')
    const table = screen.getByRole('table')
    expect(within(table).getByText('alt1.gmail-smtp-in.l.google.com')).toBeInTheDocument()
    expect(within(table).getAllByText('Preference')).toHaveLength(5)
    expect(within(table).getAllByText('MX')).toHaveLength(5)
  })

  it('an empty section says so, and the OPT record keeps the root name', async () => {
    answers('gmail.com MX')
    await query('gmail.com')
    await userEvent.click(await screen.findByRole('tab', { name: 'Authority (0)' }))
    expect(screen.getByText('No Record Found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Additional (1)' }))
    const row = within(screen.getByRole('table')).getByText('OPT').closest('tr')!
    expect(row).toHaveTextContent('.')
    expect(row).toHaveTextContent('1232')
  })

  it('the JSON tab is upstream output, whole', async () => {
    answers('gmail.com MX')
    await query('gmail.com')
    await userEvent.click(await screen.findByRole('tab', { name: 'JSON' }))
    expect(screen.getByLabelText('DNS response for gmail.com A').textContent).toBe(
      JSON.stringify(real['gmail.com MX'].response.result, null, 2),
    )
  })

  it('a tab lists the Extended DNS Errors with where each came from', async () => {
    answers('example.org A recursive-resolver dnssec')
    await query('example.org')
    await userEvent.click(await screen.findByRole('tab', { name: /^Extended DNS Errors \(\d+\)$/ }))
    // The first table is the open tab's; the raw responses' sits folded under it.
    const table = screen.getAllByRole('table')[0]
    expect(within(table).getAllByText('DNS Client').length).toBeGreaterThan(0)
    expect(
      within(table).getByText('e.root-servers.net (192.203.230.10) returned RCODE=Refused for example.org. A IN'),
    ).toBeInTheDocument()
  })

  it('an object that is not a datagram is shown as JSON alone, with no cards', async () => {
    vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: { result: { odd: 1 } } },
    } as never)
    await query('home.test')
    expect(await screen.findByLabelText('DNS response for home.test A')).toHaveTextContent('"odd": 1')
    expect(screen.queryByRole('heading', { name: 'Response' })).not.toBeInTheDocument()
  })
})

describe('DNS Client: the raw responses', () => {
  it('one row per response, each opening its own JSON', async () => {
    answers('example.org A recursive-resolver dnssec')
    await query('example.org')
    await userEvent.click(await screen.findByText('Raw Responses (16)'))
    const rows = screen.getAllByRole('button', { name: /^Show raw response \d+$/ })
    expect(rows).toHaveLength(16)
    expect(screen.queryByLabelText('Raw response 1 of 16')).not.toBeInTheDocument()
    await userEvent.click(rows[0])
    expect(screen.getByLabelText('Raw response 1 of 16')).toHaveTextContent('b.root-servers.net (170.247.170.2)')
    expect(screen.getByRole('button', { name: 'Hide raw response 1' })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('DNS Client: what resolveQuery() does that this console had lost', () => {
  it('Enter in a field resolves, as the form submit of upstream does', async () => {
    const spy = answers('gmail.com MX')
    render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'gmail.com{Enter}')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1].runImport).toBeFalsy()
  })

  it('a pasted URL is cut to its host, in the field and in the request', async () => {
    const spy = answers('gmail.com MX')
    await query('https://gmail.com:8443/inbox')
    expect(spy.mock.calls[0][1].domain).toBe('gmail.com')
    expect(screen.getByLabelText('Domain')).toHaveValue('gmail.com')
  })

  it('a domain of spaces is not empty to upstream: it travels', async () => {
    const spy = answers('gmail.com MX')
    await query('   ')
    expect(spy.mock.calls[0][1].domain).toBe('   ')
  })

  it('the recursive resolver puts the protocol dropdown itself on UDP, even when a check fails', async () => {
    render(<DnsClient token="t" />)
    await userEvent.click(screen.getByLabelText('DNS-over-'))
    await userEvent.click(screen.getByRole('option', { name: 'TLS' }))
    expect(screen.getByLabelText('DNS-over-')).toHaveTextContent('TLS')
    await userEvent.clear(screen.getByLabelText('Server'))
    await userEvent.type(screen.getByLabelText('Server'), 'Recursive Resolver {{recursive-resolver}')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(await screen.findByText('Please enter a domain name to query.')).toBeInTheDocument()
    expect(screen.getByLabelText('DNS-over-')).toHaveTextContent('UDP')
    expect(screen.getByLabelText('Domain')).toHaveFocus()
  })

  it('a server typed by hand joins the top of the list once a query is sent', async () => {
    vi.spyOn(quick, 'loadQuickList').mockResolvedValue([{ name: 'Google', addresses: ['8.8.8.8'] }] as never)
    answers('gmail.com MX')
    render(<DnsClient token="t" />)
    await userEvent.clear(screen.getByLabelText('Server'))
    await userEvent.type(screen.getByLabelText('Server'), '9.9.9.9')
    await userEvent.type(screen.getByLabelText('Domain'), 'gmail.com')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await screen.findByRole('tablist', { name: 'Response sections' })
    await userEvent.click(screen.getByRole('button', { name: 'Server list' }))
    expect((await screen.findAllByRole('menuitem')).map((i) => i.textContent)).toEqual([
      '9.9.9.9', 'This Server {this-server}', 'Google {8.8.8.8}',
    ])
  })

  it('the pressed button reads its busy label and the other one waits', async () => {
    let finish: (v: unknown) => void = () => {}
    vi.spyOn(api, 'resolve').mockReturnValue(new Promise((r) => { finish = r }) as never)
    await query('gmail.com')
    expect(screen.getByRole('button', { name: 'Resolving...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
    finish({ kind: 'ok', data: real['gmail.com MX'] })
    expect(await screen.findByRole('button', { name: 'Resolve' })).toBeEnabled()
  })

  it('an error from the server floats with its message and draws no answer', async () => {
    answers('this-server TLS')
    vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'error', message: real['this-server TLS'].errorMessage,
    } as never)
    await query('example.com')
    expect(
      await screen.findByText("Cannot use DNS-over-TLS protocol for 'this-server'. Please use the TLS certificate domain name as the server."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('a new query clears the alert the last one left', async () => {
    vi.spyOn(api, 'resolve')
      .mockResolvedValueOnce({ kind: 'error', message: 'DNS request failed.' } as never)
      .mockResolvedValueOnce({ kind: 'ok', data: real['gmail.com MX'] } as never)
    await query('gmail.com')
    expect(await screen.findByText('DNS request failed.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(await screen.findByRole('tab', { name: /^Answer/ })).toBeInTheDocument()
    expect(screen.queryByText('DNS request failed.')).not.toBeInTheDocument()
  })

  it('an error with an inner message shows both, as upstream asks with showInnerError', async () => {
    vi.spyOn(api, 'resolve').mockResolvedValue({
      kind: 'error', message: 'DNS request failed.', inner: 'Connection refused.',
    } as never)
    await query('example.com')
    expect(await screen.findByText('DNS request failed. Connection refused.')).toBeInTheDocument()
  })

  it('a DNSSEC failure answers with its warning and still draws the response', async () => {
    answers('dnssec-failed.org A dnssec')
    await query('dnssec-failed.org')
    expect(
      await screen.findByText('Attack detected! DNSSEC validation failed due to unable to find a SEP DNSKEY matching the DS for owner name: dnssec-failed.org'),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Answer (4)' })).toBeInTheDocument()
  })
})
