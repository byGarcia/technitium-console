/*
Cache keeps its view in the address bar, as Blocking keeps `?rule=`: the open node
(`?domain=`) and the type the table is narrowed to (`?type=`), written by
replacing the entry and dropped with the screen.
*/
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cache } from './Lists'
import * as api from '../../api/zonelists'
import type { ListNode } from '../../api/zonelists'

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

const A = { name: 'google.com', type: 'A', ttl: '60 (1m)', rData: { ipAddress: '1.2.3.4' }, dnssecStatus: 'Insecure' }
const NS = { name: 'google.com', type: 'NS', ttl: '60 (1m)', rData: { nameServer: 'ns1.google.com' }, dnssecStatus: 'Insecure' }

function serving() {
  return vi.spyOn(api, 'listNode').mockImplementation(async (_list, _token, domain) => {
    const n: ListNode =
      domain === 'google.com'
        ? { domain: 'google.com', zones: [], records: [A, NS] as never }
        : { domain: domain === 'com' ? 'com' : '', zones: domain === 'com' ? ['google.com'] : ['com'], records: [] }
    return { kind: 'ok', data: n }
  })
}

describe('Cache in the address bar', () => {
  it('opening a node writes it, replacing the entry', async () => {
    window.history.replaceState(null, '', '/cache/')
    serving()
    const push = vi.spyOn(window.history, 'pushState')
    render(<Cache token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: 'com' }))
    await waitFor(() => expect(window.location.search).toBe('?domain=com'))
    expect(push).not.toHaveBeenCalled()
  })

  it('the bar opens the node and the type it names', async () => {
    window.history.replaceState(null, '', '/cache/?domain=google.com&type=NS')
    const spy = serving()
    render(<Cache token="t" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'google.com' })).toBeInTheDocument()
    expect(spy.mock.calls[0][2]).toBe('google.com')
    const types = screen.getByRole('group', { name: 'Records by type' })
    expect(within(types).getByRole('button', { name: /^NS/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1)
  })

  it('pressing a type writes it, and leaving the screen takes both out', async () => {
    window.history.replaceState(null, '', '/cache/?domain=google.com')
    serving()
    const { unmount } = render(<Cache token="t" />)
    const types = await screen.findByRole('group', { name: 'Records by type' })
    await userEvent.click(within(types).getByRole('button', { name: /^A/ }))
    expect(window.location.search).toBe('?domain=google.com&type=A')
    unmount()
    expect(window.location.search).toBe('')
  })
})
