/*
The cards over a cache node (deviation 16): they read the `cache/list` answer the
screen already asked for, follow the node the table follows, and ask for nothing
of their own. The answer is a real one (`cache-node.real.json`, see
`cache-facts.test.ts`).
*/
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cache } from './Lists'
import * as api from '../../api/zonelists'
import * as client from '../../api/client'
import type { ListNode } from '../../api/zonelists'
import real from './cache-node.real.json'

afterEach(() => vi.restoreAllMocks())

const GITHUB = real as unknown as ListNode

function answering(...nodes: ListNode[]) {
  const spy = vi.spyOn(api, 'listNode')
  for (const n of nodes) spy.mockResolvedValueOnce({ kind: 'ok', data: n })
  spy.mockResolvedValue({ kind: 'ok', data: nodes[nodes.length - 1] })
  return spy
}

/** A card, found by its heading. */
async function card(title: string) {
  const heading = await screen.findByRole('heading', { name: title })
  return heading.closest('[role="group"], section, div[class*="panel"]') as HTMLElement
}

describe('the cache node cards', () => {
  it('count the records by type', async () => {
    answering(GITHUB)
    render(<Cache token="t" />)
    const types = await screen.findByRole('group', { name: 'Records by type' })
    const keys = within(types).getAllByRole('button').map((b) => b.textContent)
    expect(keys).toEqual(['A1', 'NS8', 'SOA1', 'MX1', 'TXT3', 'AAAA1', 'DS1'])
    expect(screen.getByRole('img', { name: 'A 1, NS 8, SOA 1, MX 1, TXT 3, AAAA 1, DS 1' })).toBeInTheDocument()
  })

  it('a type narrows the table to it, says so at the foot, and pressed again clears it', async () => {
    const spy = answering(GITHUB)
    render(<Cache token="t" />)
    const types = await screen.findByRole('group', { name: 'Records by type' })
    const ns = within(types).getByRole('button', { name: /^NS/ })
    await userEvent.click(ns)
    expect(ns).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(8)
    expect(screen.getByText(/8 of 16 records at/)).toBeInTheDocument()
    await userEvent.click(ns)
    expect(ns).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(16)
    // The filter is drawn from the answer on screen: nothing more is asked.
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('say what leaves first, the longest time left, and how many are stale', async () => {
    answering(GITHUB)
    render(<Cache token="t" />)
    const left = await card('Time Left')
    expect(within(left).getByText('2m5s')).toBeInTheDocument()
    expect(within(left).getByText('AAAA')).toBeInTheDocument()
    expect(within(left).getByText('21m24s')).toBeInTheDocument()
    expect(within(left).getByText('Stale').closest('div')).toHaveTextContent('6')
  })

  it('explain Stale and Negative in a bubble on focus', async () => {
    answering(GITHUB)
    render(<Cache token="t" />)
    const left = await card('Time Left')
    const stale = within(left).getByText('Stale').closest('[tabindex]') as HTMLElement
    stale.focus()
    expect(await screen.findByText(/Its TTL has run out\. The server keeps it for Serve Stale/)).toBeInTheDocument()
    const negative = screen.getByText('Negative').closest('[tabindex]') as HTMLElement
    expect(negative).toHaveTextContent('2')
    negative.focus()
    expect(await screen.findByText(/A cached answer that the name, or a record of that type, does not exist\./)).toBeInTheDocument()
  })

  it('count the DNSSEC states and the servers that answered', async () => {
    answering(GITHUB)
    render(<Cache token="t" />)
    expect(await screen.findByRole('img', { name: 'Insecure 14, Unknown 2' })).toBeInTheDocument()
    const servers = screen.getByRole('list', { name: 'Answered By' })
    expect(within(servers).getByText('1.1.1.1')).toBeInTheDocument()
    expect(within(servers).getByText('16')).toBeInTheDocument()
  })

  it('an empty node draws only the Records card, and it says 0', async () => {
    answering({ domain: 'org', zones: ['example.org', 'wikipedia.org'], records: [] })
    render(<Cache token="t" />)
    expect(await screen.findByRole('heading', { name: 'Records' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Time Left' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'DNSSEC' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Answered By' })).toBeNull()
    expect(screen.getByText('0 records at')).toBeInTheDocument()
  })

  it('follow the node: opening a child redraws them from its answer', async () => {
    answering({ domain: 'com', zones: ['github.com'], records: [] }, GITHUB)
    render(<Cache token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: 'github.com' }))
    expect(await screen.findByRole('group', { name: 'Records by type' })).toBeInTheDocument()
  })

  it('ask the server for nothing beyond the node itself', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: GITHUB } } as never)
    render(<Cache token="t" />)
    await screen.findByRole('group', { name: 'Records by type' })
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['cache/list'])
  })
})

describe('the records table', () => {
  it('marks a stale record beside its TTL', async () => {
    answering(GITHUB)
    render(<Cache token="t" />)
    await screen.findByRole('group', { name: 'Records by type' })
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Stale')).toBeInTheDocument()
    expect(within(rows[1]).queryByText('Stale')).toBeNull()
  })

  it('writes the count at the foot of the table', async () => {
    answering(GITHUB)
    render(<Cache token="t" />)
    expect(await screen.findByText('16 records at')).toBeInTheDocument()
  })

  it('a Bogus record reads as an error, a Secure one as fine', async () => {
    const base = GITHUB.records[1]
    answering({ ...GITHUB, records: [{ ...base, dnssecStatus: 'Bogus' }, { ...base, dnssecStatus: 'Secure' }] })
    render(<Cache token="t" />)
    const bogus = await screen.findByText('Bogus', { selector: 'span[class*="tag"]' })
    expect(bogus.className).toMatch(/dan/)
    expect(screen.getByText('Secure', { selector: 'span[class*="tag"]' }).className).toMatch(/ok/)
  })
})
