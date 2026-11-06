/*
The domain-tree round of 2026-09-07, put on the bench.

What this file guards is the four things the round exists to fix, plus the two it
was not allowed to break. Everything here is measured on the DOM the screen
actually renders, not on the drawing: the drawing is what was agreed, this is
what shipped.
*/
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cache, Lists } from './Lists'
import * as api from '../../api/zonelists'
import * as client from '../../api/client'
import type { ListNode } from '../../api/zonelists'

afterEach(() => vi.restoreAllMocks())

function node(p: Partial<ListNode> = {}): ListNode {
  return { domain: '', zones: [], records: [], ...p }
}

function withNode(...nodes: ListNode[]) {
  const spy = vi.spyOn(api, 'listNode')
  for (const n of nodes) spy.mockResolvedValueOnce({ kind: 'ok', data: n })
  spy.mockResolvedValue({ kind: 'ok', data: nodes[nodes.length - 1] ?? node() })
  return spy
}

const NS = {
  name: 'ads.example.net',
  type: 'NS' as const,
  ttl: 14400,
  ttlString: '4h',
  rData: { nameServer: 'dev' },
  dnssecStatus: 'Unknown',
  lastUsedOn: '0001-01-01T00:00:00',
}

describe('the path says where you are', () => {
  /* The third problem: the current node used to appear only inside
     `N records at <node>`, with no chain, so on a three-level tree there was no
     telling what it hung off. */
  it('it writes the whole chain, root first and the open node last', async () => {
    withNode(node({ domain: 'ads.example.net', records: [NS] }))
    render(<Lists list="allowed" token="t" embedded />)
    await screen.findByText(/2 records at|1 records at/)

    const path = screen.getByRole('navigation', { name: 'Node' })
    expect(path).toHaveTextContent('<ROOT>')
    expect(path).toHaveTextContent('net')
    expect(path).toHaveTextContent('example.net')
    expect(path).toHaveTextContent('ads.example.net')
  })

  it('at the root it says only the root', async () => {
    withNode(node({ zones: ['com'] }))
    render(<Cache token="t" />)
    await screen.findByText('com')
    expect(screen.getByRole('heading', { level: 1, name: 'Cache' })).toBeInTheDocument()
    expect(screen.getByText('<ROOT>')).toBeInTheDocument()
  })

  /*
  Since 2026-11-06 it navigates, as Cache's path does: every step but the last is
  upstream's `[up]` taken one or more times, so it is sent with `direction=up`,
  exactly as the tree's ancestors were. The open node is not a button.
  */
  it('every step but the open node goes up to it, as the [up] link', async () => {
    const spy = withNode(node({ domain: 'ads.example.net', records: [NS] }))
    render(<Lists list="allowed" token="t" embedded />)
    const path = await screen.findByRole('navigation', { name: 'Node' })
    expect(within(path).getAllByRole('button').map((b) => b.textContent)).toEqual(['<ROOT>', 'net', 'example.net'])
    await userEvent.click(within(path).getByRole('button', { name: 'example.net' }))
    expect(spy).toHaveBeenLastCalledWith('allowed', 't', 'example.net', 'up', '')
    await userEvent.click(within(path).getByRole('button', { name: '<ROOT>' }))
    expect(spy).toHaveBeenLastCalledWith('allowed', 't', '', 'up', '')
  })
})

describe('cache and policy are told apart', () => {
  /* Cache names itself in its header. Allowed and Blocked are drawn only inside
     Blocking's Rules, whose toolbar names the list (its `Tree` switch): they draw
     no identity band of their own since 2026-11-06. */
  it('Cache says what it holds under its title', async () => {
    withNode(node())
    render(<Cache token="t" />)
    expect(await screen.findByText('What the server resolved and stored')).toBeInTheDocument()
  })

  it.each(['allowed' as const, 'blocked' as const])('%s draws no band of its own', async (list) => {
    withNode(node())
    render(<Lists list={list} token="t" embedded />)
    await screen.findByText(/^0 records at/)
    expect(screen.queryByText(/Domains the administrator/)).toBeNull()
  })
})

describe('Delete weighs what it costs', () => {
  /*
  The fourth problem, and the design brief had it backwards: it said `Delete` and `Flush` were
  the same red pill. They were not: `Flush` already carried `variant="danger"`
  and `Delete` carried NO variant at all, so the destructive verb in the bar was
  drawn as a plain grey button while the one beside it was a filled red block.
  */
  it('the node Delete is a danger button, not a plain one', async () => {
    withNode(node({ domain: 'ads.example.net', records: [NS] }))
    render(<Lists list="allowed" token="t" embedded />)
    const button = await screen.findByRole('button', { name: 'Delete' })
    expect(button).toHaveAttribute('data-variant', 'danger')
  })

  /* The header's Flush of Allowed and Blocked left with their header (it is
     Rules' now); the filled red one that stays in this component is Cache's. */
  it('and Flush Cache stays the filled one, in the header', async () => {
    withNode(node())
    render(<Cache token="t" />)
    const flush = await screen.findByRole('button', { name: 'Flush Cache' })
    expect(flush).toHaveAttribute('data-variant', 'danger')
  })
})

describe('loading is not emptiness, on either side', () => {
  function pending() {
    return new Promise<never>(() => {})
  }

  /*
  The tree had this fixed on 2026-09-07 and the records side did not: it kept
  saying `0 records at <ROOT>` with the request still in flight, which is exactly
  what a node with no records says. Same lie, other column.
  */
  it('neither count bar is drawn while the request is in flight', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(() => pending() as never)
    render(<Lists list="cache" token="t" />)
    await screen.findByRole('status')
    expect(screen.queryByText(/records at/)).not.toBeInTheDocument()
    expect(screen.queryByText('0 zones')).not.toBeInTheDocument()
  })

  /*
  Two holes, one wait. The eye needs a placeholder in each (that is what says the
  content is coming and not gone), and the ear needs one: two `role="status"` for
  the same request read it out twice.
  */
  /* Allowed and Blocked are one card since 2026-11-06: one hole, announced once. */
  it('Allowed and Blocked have one hole, and it announces its wait', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(() => pending() as never)
    render(<Lists list="blocked" token="t" embedded />)
    await screen.findByRole('status')
    expect(screen.getAllByText('Loading…')).toHaveLength(1)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByText(/records at/)).not.toBeInTheDocument()
  })

  /* Cache is one panel since 2026-10-16: one hole, one placeholder, announced. */
  it('Cache has one hole, and it announces its wait', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(() => pending() as never)
    render(<Cache token="t" />)
    await screen.findByRole('status')
    expect(screen.getAllByText('Loading…')).toHaveLength(1)
  })
})

describe('what the round was not allowed to break', () => {
  it('the two empty texts are still two, and each in its own case', async () => {
    withNode(node({ domain: 'example.org', zones: ['a.example.org', 'b.example.org'] }))
    render(<Lists list="blocked" token="t" embedded />)
    expect(
      await screen.findByText('This node only contains sub-domains. Open one to see its records.'),
    ).toBeInTheDocument()
  })

  it('the field is Domain, the button is Browse, and the placeholder is example.com', async () => {
    withNode(node())
    render(<Cache token="t" />)
    expect(await screen.findByLabelText('Domain')).toHaveAttribute('placeholder', 'example.com')
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument()
  })

  /* `<ROOT>` is how you get back to the root: the trail's first step. */
  it('the trail keeps its <ROOT> step', async () => {
    withNode(node({ domain: 'example.org', zones: [] }))
    render(<Lists list="blocked" token="t" embedded />)
    const path = await screen.findByRole('navigation', { name: 'Node' })
    expect(within(path).getByRole('button', { name: '<ROOT>' })).toBeInTheDocument()
  })
})

describe('loading the tree', () => {
  /*
  Every successful load used to re-create `load`, and the mount effect ran it
  again from the root: hundreds of `cache/list?domain=` a second, and a tree that
  snapped back to the root whenever a node was opened. The mocks above answer the
  last node to every call, which is why no test saw it; this one answers by
  domain, as the server does.
  */
  function byDomain() {
    return vi.spyOn(api, 'listNode').mockImplementation(async (_list, _token, domain) => ({
      kind: 'ok' as const,
      data: domain === 'com' ? node({ domain: 'com', zones: ['example'] }) : node({ zones: ['com', 'net'] }),
    }))
  }

  it('asks for the root once on opening, and not again', async () => {
    const spy = byDomain()
    render(<Cache token="t" />)
    await screen.findByRole('button', { name: 'com' })
    await new Promise((r) => setTimeout(r, 200))
    expect(spy.mock.calls.filter((c) => c[2] === '')).toHaveLength(1)
  })

  it('opening a node stays on that node', async () => {
    const spy = byDomain()
    render(<Cache token="t" />)
    ;(await screen.findByRole('button', { name: 'com' })).click()
    await screen.findByRole('button', { name: 'example' })
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.getByRole('heading', { level: 1, name: 'com' })).toBeInTheDocument()
    expect(spy.mock.calls.filter((c) => c[2] === '')).toHaveLength(1)
  })
})
