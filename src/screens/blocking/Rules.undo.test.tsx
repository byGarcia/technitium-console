import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import * as blocking from '../../api/blocking'
import * as zonelists from '../../api/zonelists'
import { Rules } from './Rules'

/*
Delete in the Rules table: at once, with Undo (Rules.tsx, the header; undo.ts).
The server is a small in-memory one, so a read after a change sees it.
*/

const OK = { kind: 'ok' as const, data: {} }
const P = (v: boolean, m = true, d = true) => ({ canView: v, canModify: m, canDelete: d })

beforeEach(() => window.history.replaceState(null, '', '/blocking/rules/'))
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function server(blocked: string[], allowed: string[]) {
  const lists = { blocked: new Set(blocked), allowed: new Set(allowed) }
  vi.spyOn(blocking, 'readRuleExport').mockImplementation(async (list) => ({ kind: 'ok', data: [...lists[list]] }))
  const remove = vi.spyOn(zonelists, 'deleteDomain').mockImplementation(async (list, _t, domain) => {
    lists[list].delete(domain)
    return OK
  })
  const add = vi.spyOn(zonelists, 'addDomain').mockImplementation(async (list, _t, domain) => {
    lists[list].add(domain)
    return OK
  })
  return { lists, remove, add }
}

const status = () => screen.getByRole('status')

async function del(domain: string, user: Pick<UserEvent, 'click'> = userEvent) {
  await user.click(await screen.findByRole('button', { name: `Delete ${domain}` }))
}

describe('Rules: Delete with Undo', () => {
  it('deletes at once, with no dialog, and says so with upstream sentence', async () => {
    const { remove, lists } = server(['ads.example.com'], [])
    render(<Rules token="T" permissions={undefined} />)
    await del('ads.example.com')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(remove).toHaveBeenCalledWith('blocked', 'T', 'ads.example.com')
    expect(lists.blocked.size).toBe(0)
    expect(status()).toHaveTextContent("Blocked zone 'ads.example.com' was deleted successfully.")
    expect(await screen.findByText('No rules')).toBeInTheDocument()
  })

  it('Undo puts the same domain back in the same list, with the add call', async () => {
    const { add } = server([], ['s.youtube.com'])
    render(<Rules token="T" permissions={undefined} />)
    await del('s.youtube.com')
    expect(status()).toHaveTextContent("Domain 's.youtube.com' was deleted from Allowed Zone successfully.")
    await userEvent.click(within(status().parentElement!).getByRole('button', { name: 'Undo' }))
    expect(add).toHaveBeenCalledExactlyOnceWith('allowed', 'T', 's.youtube.com')
    expect(await screen.findByText("'s.youtube.com' is back in Allowed.")).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Delete s.youtube.com' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('a second Delete joins the open notice, and one Undo puts both back, each in its list', async () => {
    const { add, lists } = server(['ads.example.com'], ['s.youtube.com'])
    render(<Rules token="T" permissions={undefined} />)
    await del('ads.example.com')
    await del('s.youtube.com')
    expect(status()).toHaveTextContent('2 rules were deleted.')
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(add.mock.calls).toEqual([
      ['blocked', 'T', 'ads.example.com'],
      ['allowed', 'T', 's.youtube.com'],
    ])
    expect(await screen.findByText('2 rules are back.')).toBeInTheDocument()
    expect([...lists.blocked, ...lists.allowed]).toEqual(['ads.example.com', 's.youtube.com'])
  })

  it('a Delete after the notice said "back" starts a new one', async () => {
    server(['a.test', 'b.test'], [])
    render(<Rules token="T" permissions={undefined} />)
    await del('a.test')
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await screen.findByText("'a.test' is back in Blocked.")
    await del('b.test')
    expect(status()).toHaveTextContent("Blocked zone 'b.test' was deleted successfully.")
  })

  it('an Undo that fails says which rules did not come back, and why', async () => {
    const { add } = server(['a.test', 'b.test', 'c.test'], [])
    add.mockResolvedValueOnce(OK).mockResolvedValueOnce({ kind: 'error', message: 'Access was denied.' })
    render(<Rules token="T" permissions={undefined} />)
    await del('a.test')
    await del('b.test')
    await del('c.test')
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('2 of 3 rules were not put back: Access was denied.')).toBeInTheDocument()
    // It stops at the first refusal: the third is not asked for.
    expect(add).toHaveBeenCalledTimes(2)
    expect(status()).toBeEmptyDOMElement()
  })

  it('an expired session during Undo says so', async () => {
    const { add } = server(['a.test'], [])
    add.mockResolvedValue({ kind: 'invalid-token' })
    render(<Rules token="T" permissions={undefined} />)
    await del('a.test')
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText("'a.test' was not put back: Invalid token or session expired.")).toBeInTheDocument()
  })

  it('a Delete that fails leaves no Undo, only the server message', async () => {
    const { remove } = server(['a.test'], [])
    remove.mockResolvedValue({ kind: 'error', message: 'No such zone.' })
    render(<Rules token="T" permissions={undefined} />)
    await del('a.test')
    expect(await screen.findByText('No such zone.')).toBeInTheDocument()
    expect(status()).toBeEmptyDOMElement()
  })

  it('dismissing the notice keeps the deletion', async () => {
    const { add } = server(['a.test'], [])
    render(<Rules token="T" permissions={undefined} />)
    await del('a.test')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(status()).toBeEmptyDOMElement()
    expect(add).not.toHaveBeenCalled()
    expect(screen.getByText('No rules')).toBeInTheDocument()
  })

  it('Escape inside the notice dismisses it', async () => {
    server(['a.test'], [])
    render(<Rules token="T" permissions={undefined} />)
    await del('a.test')
    screen.getByRole('button', { name: 'Undo' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(status()).toBeEmptyDOMElement()
  })

  it('the notice goes after a few seconds, and not while the pointer is on it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    server(['a.test'], [])
    render(<Rules token="T" permissions={undefined} />)
    await del('a.test', user)
    await user.hover(screen.getByRole('button', { name: 'Undo' }))
    act(() => vi.advanceTimersByTime(20_000))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    await user.unhover(screen.getByRole('button', { name: 'Undo' }))
    // The focus went to Undo when the row went; while it stays there the clock holds.
    act(() => screen.getByLabelText('Filter domains').focus())
    act(() => vi.advanceTimersByTime(8_000))
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('a permission lost while the notice is up turns Undo off and names it', async () => {
    const { add } = server(['a.test'], [])
    const { rerender } = render(<Rules token="T" permissions={{ Blocked: P(true), Allowed: P(true) }} />)
    await del('a.test')
    rerender(<Rules token="T" permissions={{ Blocked: P(true, false), Allowed: P(true) }} />)
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toBeDisabled()
    await userEvent.hover(undo.parentElement!)
    expect(await screen.findByText('Requires Blocked: Modify')).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })

  it('leaving the tab drops the notice and keeps the deletion', async () => {
    const { add } = server(['a.test'], [])
    const { unmount } = render(<Rules token="T" permissions={undefined} />)
    await del('a.test')
    unmount()
    expect(screen.queryByRole('status')).toBeNull()
    expect(add).not.toHaveBeenCalled()
  })

  it('the focus the deleted row held goes to Undo, and from Undo to the filter when it is done', async () => {
    server(['a.test', 'b.test'], [])
    render(<Rules token="T" permissions={undefined} />)
    const button = await screen.findByRole('button', { name: 'Delete a.test' })
    button.focus()
    await userEvent.keyboard('{Enter}')
    const undo = await screen.findByRole('button', { name: 'Undo' })
    await vi.waitFor(() => expect(undo).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await screen.findByText("'a.test' is back in Blocked.")
    await vi.waitFor(() => expect(screen.getByLabelText('Filter domains')).toHaveFocus())
  })

  it('without Modify on the list the Delete asks first, as upstream; with it, it does not', async () => {
    const { remove } = server(['ads.test'], ['ok.test'])
    render(<Rules token="T" permissions={{ Blocked: P(true), Allowed: P(true, false) }} />)
    await del('ads.test')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(remove).toHaveBeenCalledWith('blocked', 'T', 'ads.test')
    await del('ok.test')
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent("Are you sure you want to delete the allowed zone 'ok.test'?")
  })
})
