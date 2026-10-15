import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import quickBuiltin from '../../../public/json/quick-block-lists-builtin.json'
import * as zonelists from '../../api/zonelists'
import REAL from './check-domain.real.json'
import { AddDomainBar } from './AddDomainBar'

/*
"Check" in the panel, fed at the `fetch` level with what a live v15.6.1 answered
(`check-domain.real.json`), so the client, the parsers and the verdict run as they do
in production.
*/

const ANSWERS: Record<string, unknown> = {
  'app-measurement.com': REAL.blockLists,
  'telemetry.example-iot.net': REAL.ownRule,
  'sub.telemetry.example-iot.net': REAL.ownRuleParent,
  's.youtube.com': REAL.allowedRule,
  'example.com': REAL.notBlocked,
  'this-does-not-exist-xyz123.invalid': REAL.nonExistent,
  'not a domain': REAL.invalidName,
}

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const calls: string[] = []

beforeEach(() => {
  calls.length = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), window.location.href)
    const path = url.pathname.replace(/^.*?\/api\//, '')
    calls.push(path)
    if (url.pathname.endsWith('/json/quick-block-lists-builtin.json')) return json(quickBuiltin)
    if (url.pathname.includes('/json/')) return new Response('', { status: 404, statusText: 'Not Found' })
    if (path === 'dnsClient/resolve') return json(ANSWERS[url.searchParams.get('domain') ?? ''])
    if (path === 'settings/get') return json(REAL.settings)
    if (path === 'allowed/export') return new Response(REAL.allowedExport, { headers: { 'Content-Type': 'text/plain' } })
    throw new Error(`unexpected ${path}`)
  })
})

afterEach(() => vi.restoreAllMocks())

const P = (v: boolean) => ({ canView: v, canModify: true, canDelete: true })

function setup(permissions?: Parameters<typeof AddDomainBar>[0]['permissions']) {
  const onNotice = vi.fn()
  render(<AddDomainBar token="T" permissions={permissions} onNotice={onNotice} onChanged={vi.fn()} />)
  return { onNotice, field: screen.getByLabelText('Domain') }
}

async function check(domain: string) {
  const { field, onNotice } = setup()
  await userEvent.type(field, domain)
  await userEvent.click(screen.getByRole('button', { name: 'Check' }))
  return { field, onNotice }
}

describe('Check a domain', () => {
  it('names the panel for its three verbs', () => {
    setup()
    expect(screen.getByText('Check, block or allow a domain')).toBeInTheDocument()
  })

  it('blocked by two lists: their names as the Lists tab gives them, their URLs and the way to Lists', async () => {
    await check('app-measurement.com')
    expect(await screen.findByText('Blocked by 2 block lists')).toBeInTheDocument()
    expect(screen.getByText('Steven Black [adware + malware]')).toBeInTheDocument()
    expect(screen.getByText('https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts')).toBeInTheDocument()
    expect(screen.getByText('https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/pro-onlydomains.txt')).toBeInTheDocument()
    expect(screen.queryByText('Listed as')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open Lists' })).toHaveAttribute('href', expect.stringMatching(/blocking\/lists\/$/))
  })

  it('blocked by a rule on a parent: the rule, and the way to Rules', async () => {
    await check('sub.telemetry.example-iot.net')
    expect(await screen.findByText('Blocked by your rule')).toBeInTheDocument()
    expect(screen.getByText('sub.telemetry.example-iot.net', { selector: 'div' })).toBeInTheDocument()
    expect(screen.getByText('telemetry.example-iot.net')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Rules' })).toHaveAttribute('href', expect.stringMatching(/blocking\/rules\/$/))
  })

  it('allowed by an allow rule', async () => {
    await check('s.youtube.com')
    expect(await screen.findByText('Allowed by your rule')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Rules' })).toBeInTheDocument()
  })

  it('not blocked, and a name that does not exist is not blocked either', async () => {
    await check('example.com')
    expect(await screen.findByText('Not blocked')).toBeInTheDocument()
    expect(screen.queryByText(/not checked/)).toBeNull()
  })

  it('asks DNS Client, the settings and the allow rules, and changes nothing', async () => {
    await check('example.com')
    await screen.findByText('Not blocked')
    expect(calls.filter((c) => !c.includes('json/')).sort()).toEqual(['allowed/export', 'dnsClient/resolve', 'settings/get'])
    const url = new URL(String(vi.mocked(fetch).mock.calls.find((c) => String(c[0]).includes('dnsClient/resolve'))![0]), 'http://x')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      server: 'this-server', domain: 'example.com', type: 'A', protocol: 'UDP', dnssec: 'false', eDnsClientSubnet: '',
    })
  })

  it('the server refusing the name says why under the field, not on the page', async () => {
    const { field, onNotice } = await check('not a domain')
    const why = await screen.findByText('Invalid domain name [not a domain]: invalid character [32] was found.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAttribute('aria-describedby', why.id)
    expect(onNotice).not.toHaveBeenCalled()
    await userEvent.type(field, 'x')
    expect(field).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText(/Invalid domain name/)).toBeNull()
  })

  it('an empty field is said under it, before any call', async () => {
    const { field, onNotice } = setup()
    await userEvent.type(field, '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText('Please enter a domain name to check.')).toBeInTheDocument()
    expect(field).toHaveFocus()
    expect(onNotice).not.toHaveBeenCalled()
    expect(calls.filter((c) => c.includes('dnsClient'))).toEqual([])
  })

  it('editing the name takes the verdict away', async () => {
    const { field } = await check('example.com')
    await screen.findByText('Not blocked')
    await userEvent.type(field, 'x')
    expect(screen.queryByText('Not blocked')).toBeNull()
  })

  it('Enter still blocks and never checks', async () => {
    const add = vi.spyOn(zonelists, 'addDomain').mockResolvedValue({ kind: 'ok', data: {} })
    const { field } = setup()
    await userEvent.type(field, 'example.com{Enter}')
    expect(add).toHaveBeenCalledWith('blocked', 'T', 'example.com')
    expect(calls.filter((c) => c.includes('dnsClient'))).toEqual([])
  })

  it('a Block after a check takes the verdict away: it answered the old state', async () => {
    vi.spyOn(zonelists, 'addDomain').mockResolvedValue({ kind: 'ok', data: {} })
    await check('example.com')
    await screen.findByText('Not blocked')
    await userEvent.click(screen.getByRole('button', { name: 'Block' }))
    expect(screen.queryByText('Not blocked')).toBeNull()
  })

  it('without DnsClient.canView, Check keeps its place with its padlock', () => {
    setup({ DnsClient: P(false), Blocked: P(true), Allowed: P(true) })
    expect(screen.getByRole('button', { name: /Check/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Block' })).toBeEnabled()
  })

  it('without Allowed.canView and Settings.canView, a not blocked says what it could not read', async () => {
    const { field } = setup({ DnsClient: P(true), Allowed: P(false), Settings: P(false) })
    await userEvent.type(field, 's.youtube.com')
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    const verdict = (await screen.findByText('Not blocked')).closest('[data-verdict]') as HTMLElement
    expect(within(verdict).getByText(/Your allow rules were not checked\./)).toHaveTextContent(
      'Your allow rules were not checked. Requires Allowed: View',
    )
    expect(within(verdict).getByText(/The blocking settings were not checked\./)).toHaveTextContent(
      'The blocking settings were not checked. Requires Settings: View',
    )
    expect(calls).not.toContain('allowed/export')
    expect(calls).not.toContain('settings/get')
  })
})
