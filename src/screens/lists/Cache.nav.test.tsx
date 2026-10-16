/*
Cache's one panel (2026-10-16): the crumbs go up, the chips go down, and both
send exactly what the tree sent. The tree stays the navigation of Allowed and
Blocked, which `Lists.tree.test.tsx` keeps covering.
*/
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cache } from './Lists'
import * as api from '../../api/zonelists'
import type { ListNode } from '../../api/zonelists'

afterEach(() => vi.restoreAllMocks())

function node(p: Partial<ListNode> = {}): ListNode {
  return { domain: '', zones: [], records: [], ...p }
}

function answering(n: ListNode) {
  return vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: n })
}

describe('Cache moves through one band', () => {
  it('has no tree any more', async () => {
    answering(node({ zones: ['com'] }))
    render(<Cache token="t" />)
    await screen.findByRole('button', { name: 'com' })
    expect(screen.queryByLabelText('Domain tree')).not.toBeInTheDocument()
  })

  it('an ancestor in the crumbs goes up with direction=up, as the [up] link does', async () => {
    const spy = answering(node({ domain: 'www.google.com' }))
    render(<Cache token="t" />)
    const crumbs = await screen.findByRole('navigation', { name: 'Node' })
    await userEvent.click(within(crumbs).getByRole('button', { name: 'google.com' }))
    const up = spy.mock.calls.find((c) => c[2] === 'google.com')
    expect(up?.[3]).toBe('up')
  })

  it('<ROOT> in the crumbs goes back to the root, also upwards', async () => {
    const spy = answering(node({ domain: 'com' }))
    render(<Cache token="t" />)
    const crumbs = await screen.findByRole('navigation', { name: 'Node' })
    await userEvent.click(within(crumbs).getByRole('button', { name: '<ROOT>' }))
    const calls = spy.mock.calls.filter((c) => c[2] === '')
    expect(calls[calls.length - 1][3]).toBe('up')
  })

  it('the open node is the last crumb and is not a button', async () => {
    answering(node({ domain: 'google.com' }))
    render(<Cache token="t" />)
    const crumbs = await screen.findByRole('navigation', { name: 'Node' })
    expect(within(crumbs).queryByRole('button', { name: 'google.com' })).toBeNull()
    expect(crumbs.querySelector('[aria-current="location"]')).toHaveTextContent('google.com')
  })

  it('a chip opens its child with the full name and no direction', async () => {
    const spy = answering(node({ domain: 'google.com', zones: ['www.google.com', 'l.google.com'] }))
    render(<Cache token="t" />)
    expect(await screen.findByText('2 zones')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'www.google.com' }))
    const down = spy.mock.calls.find((c) => c[2] === 'www.google.com')
    expect(down?.[3]).toBeUndefined()
  })

  it('a leaf draws no zone band', async () => {
    answering(node({ domain: 'www.google.com' }))
    render(<Cache token="t" />)
    await screen.findByText(/0 records at/)
    expect(screen.queryByText('0 zones')).not.toBeInTheDocument()
  })

  it('the empty text no longer points at a tree', async () => {
    answering(node({ domain: 'google.com', zones: ['www.google.com'] }))
    render(<Cache token="t" />)
    expect(
      await screen.findByText('This node only contains sub-domains. Open one to see its records.'),
    ).toBeInTheDocument()
  })
})
