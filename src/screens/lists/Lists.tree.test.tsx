/*
The domain-tree round of 2026-09-07, put on the bench.

What this file guards is the four things the round exists to fix, plus the two it
was not allowed to break. Everything here is measured on the DOM the screen
actually renders, not on the drawing: the drawing is what was agreed, this is
what shipped.
*/
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Allowed, Blocked, Cache, Lists } from './Lists'
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
  /* Problem 3 of the contract: the current node used to appear only inside
     `N records at <node>`, with no chain, so on a three-level tree there was no
     telling what it hung off. */
  it('it writes the whole chain, root first and the open node last', async () => {
    withNode(node({ domain: 'ads.example.net', records: [NS] }))
    render(<Allowed token="t" />)
    await screen.findByText(/2 records at|1 records at/)

    const path = screen.getByText('Node').parentElement!
    expect(path).toHaveTextContent('<ROOT>')
    expect(path).toHaveTextContent('net')
    expect(path).toHaveTextContent('example.net')
    expect(path).toHaveTextContent('ads.example.net')
  })

  it('at the root it says only the root', async () => {
    withNode(node({ zones: ['com'] }))
    render(<Cache token="t" />)
    await screen.findByText('com')
    expect(screen.getByText('Node').parentElement).toHaveTextContent('<ROOT>')
  })

  /*
  It does NOT navigate, and that is the point: navigating is the tree's job and a
  second way to do it would be behaviour upstream does not have. If somebody ever
  makes these clickable, this is what says no.
  */
  it('nothing in it is clickable', async () => {
    withNode(node({ domain: 'ads.example.net', records: [NS] }))
    render(<Allowed token="t" />)
    await screen.findByText('Node')

    const path = screen.getByText('Node').parentElement!
    expect(within(path).queryByRole('link')).toBeNull()
    expect(within(path).queryByRole('button')).toBeNull()
  })
})

describe('cache and policy are told apart', () => {
  /* Problem 2: three screens, one component, and nothing said which was which.
     The second line is one of the three channels, and the only one a test can
     read; the icon and the colour are checked in the 4x4 matrix. */
  it.each([
    [Cache, 'Cache', 'What the server resolved and stored'],
    [Allowed, 'Allowed', 'Domains the administrator lets through'],
    [Blocked, 'Blocked', 'Domains the administrator blocks'],
  ])('%#: the identity band names the screen and what it holds', async (Screen, title, sub) => {
    withNode(node())
    render(<Screen token="t" />)
    expect(await screen.findByText(sub)).toBeInTheDocument()
    expect(screen.getAllByText(title).length).toBeGreaterThan(0)
  })
})

describe('Delete weighs what it costs', () => {
  /*
  Problem 4, and the contract had it backwards: it said `Delete` and `Flush` were
  the same red pill. They were not — `Flush` already carried `variant="danger"`
  and `Delete` carried NO variant at all, so the destructive verb in the bar was
  drawn as a plain grey button while the one beside it was a filled red block.
  */
  it('the node Delete is a danger button, not a plain one', async () => {
    withNode(node({ domain: 'ads.example.net', records: [NS] }))
    render(<Allowed token="t" />)
    const button = await screen.findByRole('button', { name: 'Delete' })
    expect(button).toHaveAttribute('data-variant', 'danger')
  })

  it('and Flush stays the filled one, in the header', async () => {
    withNode(node())
    render(<Blocked token="t" />)
    const flush = await screen.findByRole('button', { name: 'Flush' })
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
  Two holes, one wait. The eye needs a placeholder in each —that is what says the
  content is coming and not gone— and the ear needs one: two `role="status"` for
  the same request read it out twice.
  */
  it('both holes show a placeholder and only one of them announces it', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(() => pending() as never)
    render(<Lists list="cache" token="t" />)
    await screen.findByRole('status')
    expect(screen.getAllByText('Loading…')).toHaveLength(2)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
})

describe('what the round was not allowed to break', () => {
  it('the two empty texts are still two, and each in its own case', async () => {
    withNode(node({ domain: 'example.org', zones: ['a.example.org', 'b.example.org'] }))
    render(<Blocked token="t" />)
    expect(
      await screen.findByText('This node only contains sub-domains. Open one in the tree to see its records.'),
    ).toBeInTheDocument()
  })

  it('the field is Domain, the button is Browse, and the placeholder is example.com', async () => {
    withNode(node())
    render(<Cache token="t" />)
    expect(await screen.findByLabelText('Domain')).toHaveAttribute('placeholder', 'example.com')
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument()
  })

  /* `<ROOT>` is how you get back to the root: it is a tree node, not decoration,
     and the path beside it must not have replaced it. */
  it('the tree keeps its <ROOT> node', async () => {
    withNode(node({ domain: 'example.org', zones: [] }))
    render(<Blocked token="t" />)
    const tree = await screen.findByLabelText('Domain tree')
    expect(within(tree).getByText('<ROOT>')).toBeInTheDocument()
  })
})
