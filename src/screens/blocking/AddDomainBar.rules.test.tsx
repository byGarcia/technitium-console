import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddDomainBar } from './AddDomainBar'
import { mergeRules } from './rules-model'

/*
"Already one of your rules?" while typing (deviation 32): fed at the `fetch` level, so
the count of reads is the count of requests the server would see.
*/

const text = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/plain' } })
const calls: string[] = []

beforeEach(() => {
  calls.length = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), window.location.href)
    const path = url.pathname.replace(/^.*?\/api\//, '')
    calls.push(path)
    if (path === 'blocked/export') return text('ads.example.com\ntelemetry.example-iot.net\nexample.org\n')
    if (path === 'allowed/export') return text('ok.example.org\n')
    throw new Error(`unexpected ${path}`)
  })
})

afterEach(() => vi.restoreAllMocks())

const P = (v: boolean) => ({ canView: v, canModify: true, canDelete: true })

function setup(props: Partial<Parameters<typeof AddDomainBar>[0]> = {}) {
  render(<AddDomainBar token="T" permissions={undefined} onNotice={vi.fn()} onChanged={vi.fn()} {...props} />)
  return screen.getByLabelText('Domain')
}

describe('Already one of your rules, while typing', () => {
  it('reads your rules once for the whole name, and makes no DNS query', async () => {
    const field = setup()
    expect(calls).toEqual([])
    await userEvent.type(field, 'sub.telemetry.example-iot.net')
    expect(await screen.findByText('Already blocked by your rule telemetry.example-iot.net, which covers its subdomains.'))
      .toBeInTheDocument()
    expect(calls.sort()).toEqual(['allowed/export', 'blocked/export'])
    expect(field).toHaveAttribute('aria-describedby', screen.getByText(/^Already blocked by/).parentElement!.id)
  })

  it('follows the name as it is typed, from the rules it already read', async () => {
    const field = setup()
    await userEvent.type(field, 'ads.example.com')
    expect(await screen.findByText('Already blocked: it is one of your rules.')).toBeInTheDocument()
    await userEvent.type(field, '.x')
    expect(screen.getByText('Not one of your rules. Check asks the block lists.')).toBeInTheDocument()
    await userEvent.clear(field)
    await userEvent.type(field, 'www.ok.example.org')
    expect(screen.getByText(/^Already allowed by your rule ok\.example\.org/)).toBeInTheDocument()
    expect(calls).toHaveLength(2)
  })

  it('without Allowed: View the allow rules are not read, and the line says so', async () => {
    const field = setup({ permissions: { Blocked: P(true), Allowed: P(false), DnsClient: P(true) } })
    await userEvent.type(field, 'example.net')
    expect(await screen.findByText(
      'Not one of your blocked rules. Your allowed rules were not checked: Requires Allowed: View. Check asks the block lists.',
    )).toBeInTheDocument()
    expect(calls).toEqual(['blocked/export'])
  })

  it('without either View nothing is read and nothing is said', async () => {
    const field = setup({ permissions: { Blocked: P(false), Allowed: P(false), DnsClient: P(true) } })
    await userEvent.type(field, 'ads.example.com')
    expect(calls).toEqual([])
    expect(screen.queryByText(/your rules/i)).toBeNull()
  })

  it('a failed read says so once, under the field', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response('', { status: 502, statusText: 'Bad Gateway' }))
    const field = setup()
    await userEvent.type(field, 'ads.example.com')
    expect(await screen.findByText('Could not read your rules.')).toBeInTheDocument()
  })

  it('on Rules it uses the table the tab already holds, and reads nothing itself', async () => {
    const field = setup({ rules: mergeRules(['example.org'], []) })
    await userEvent.type(field, 'a.example.org')
    expect(screen.getByText('Already blocked by your rule example.org, which covers its subdomains.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('an empty field says nothing', async () => {
    setup({ rules: mergeRules(['example.org'], []) })
    expect(screen.queryByText(/your rules/i)).toBeNull()
  })
})
