import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DnsClient } from './DnsClient'
import * as api from '../../api/dnsclient'
import real from './resolve.real.json'

/*
The query in the address bar and the recent queries (deviation 18, 2026-11-06): a
query that came back is written to the bar, replacing the entry, and kept in this
browser's list of recent queries; a bar that names a query runs it once on
arrival; a recent query pressed fills the form and resolves it again.
*/

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.removeItem('dnsclient-recent')
  window.history.replaceState(null, '', '/')
})

function answering() {
  return vi.spyOn(api, 'resolve').mockResolvedValue({ kind: 'ok', data: real['gmail.com MX'] } as never)
}

describe('DNS Client: the query in the bar, and the recent ones', () => {
  it('a query that came back is written to the bar and becomes the title; leaving drops it', async () => {
    window.history.replaceState(null, '', '/dnsclient/')
    answering()
    const push = vi.spyOn(window.history, 'pushState')
    const { unmount } = render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'gmail.com')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(window.location.search).toContain('domain=gmail.com'))
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('gmail.com')
    unmount()
    expect(window.location.search).toBe('')
  })

  it('the bar runs its query once on arrival, with the fields it names', async () => {
    window.history.replaceState(null, '', '/dnsclient/?domain=gmail.com&type=MX&protocol=TCP&dnssec=off')
    const spy = answering()
    render(<DnsClient token="t" />)
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(spy.mock.calls[0][1]).toMatchObject({ domain: 'gmail.com', type: 'MX', protocol: 'TCP', dnssec: false })
  })

  it('a recent query is offered on an empty card and runs again when pressed', async () => {
    localStorage.setItem(
      'dnsclient-recent',
      JSON.stringify([{ server: 'This Server {this-server}', domain: 'gmail.com', type: 'MX', protocol: 'UDP' }]),
    )
    const spy = answering()
    render(<DnsClient token="t" />)
    const list = screen.getByRole('list', { name: 'Recent queries' })
    await userEvent.click(within(list).getByRole('button', { name: /gmail\.com/ }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(spy.mock.calls[0][1]).toMatchObject({ domain: 'gmail.com', type: 'MX' })
    expect(screen.getByLabelText('Domain')).toHaveValue('gmail.com')
  })

  it('a resolved query joins the recent list, newest first and once', async () => {
    answering()
    render(<DnsClient token="t" />)
    await userEvent.type(screen.getByLabelText('Domain'), 'gmail.com')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(localStorage.getItem('dnsclient-recent')).toContain('gmail.com'))
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('dnsclient-recent') ?? '[]')).toHaveLength(1))
  })
})
