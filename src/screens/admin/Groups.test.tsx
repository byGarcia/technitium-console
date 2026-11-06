import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Groups } from './Groups'
import * as client from '../../api/client'
import { GROUPS } from './admin.fixture'
import { choose } from '../../test/dropdown'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

function server(groups = GROUPS, detail?: Record<string, unknown>) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'admin/groups/list') return ok({ response: { groups: groups }, server: 'x' })
    if (path === 'admin/groups/get') {
      return ok({
        response: detail ?? {
          name: 'Administrators',
          description: 'Super administrators',
          members: ['admin'],
          users: ['admin', 'testuser'],
        },
        server: 'x',
      })
    }
    if (path === 'admin/groups/create') {
      return ok({ response: { name: 'Ops', description: 'the on-call team' }, server: 'x' })
    }
    if (path === 'admin/groups/set') {
      return ok({ response: { name: 'Others', description: 'Super administrators' }, server: 'x' })
    }
    return ok({ response: {}, server: 'x' })
  })
}

const props = { token: 'tok', onNotice: vi.fn() }

describe('Groups: the table', () => {
  it('it draws name, description and the total', async () => {
    server()
    render(<Groups {...props} />)
    expect(await screen.findByText('Super administrators')).toBeInTheDocument()
    expect(screen.getByText('Total Groups: 3')).toBeInTheDocument()
  })

  /* On the row it is cut to one line; its Details holds it whole, a line per
     line, as upstream's `<br />` draws it (deviation 23). */
  it('a description with newlines is drawn over several lines under Details', async () => {
    server([{ name: 'Ops', description: 'first line\nsecond line' }])
    const user = userEvent.setup()
    render(<Groups {...props} />)
    expect(await screen.findByText('first line second line')).toBeInTheDocument()
    const details = screen.getByRole('button', { name: 'Details' })
    expect(details).toHaveAttribute('aria-expanded', 'false')
    await user.click(details)
    expect(details).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('first line')).toBeInTheDocument()
    expect(screen.getByText('second line')).toBeInTheDocument()
  })

  it('the menu holds the two upstream entries, and the name opens the details', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Groups {...props} />)
    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'View Details',
      'Delete Group',
    ])
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Administrators' }))
    await screen.findByLabelText('Members')
    expect(spy.mock.calls.find((c) => c[0] === 'admin/groups/get')?.[1]?.body).toEqual({
      group: 'Administrators',
      includeUsers: 'true',
    })
  })

  it('the search narrows by name or description, writes ?q= and asks nothing', async () => {
    const spy = server()
    const user = userEvent.setup()
    const { unmount } = render(<Groups {...props} />)
    await screen.findByText('Total Groups: 3')
    const calls = spy.mock.calls.length
    await user.type(screen.getByLabelText('Search'), 'super')
    expect(screen.getAllByRole('button', { name: /^Actions for / })).toHaveLength(1)
    expect(screen.getByText('Total Groups: 3, 1 shown')).toBeInTheDocument()
    expect(window.location.search).toBe('?q=super')
    expect(spy.mock.calls.length).toBe(calls)
    unmount()
    expect(window.location.search).toBe('')
  })

  it('a search in the address bar is read on arrival', async () => {
    window.history.replaceState(null, '', '/admin/groups/?q=nothing-like-this')
    server()
    const { unmount } = render(<Groups {...props} />)
    expect(await screen.findByText('No Group Found')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toHaveValue('nothing-like-this')
    unmount()
    window.history.replaceState(null, '', '/')
  })

  it('with no groups the total says zero', async () => {
    server([])
    render(<Groups {...props} />)
    expect(await screen.findByText('Total Groups: 0')).toBeInTheDocument()
  })

  it('if the server fails it alerts with its message', async () => {
    const onNotice = vi.fn()
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    render(<Groups {...props} onNotice={onNotice} />)
    expect(await screen.findByText('Total Groups: 0')).toBeInTheDocument()
    expect(onNotice).toHaveBeenCalledWith({
      type: 'danger',
      title: 'Error!',
      text: 'Access was denied.',
    })
  })
})

describe('Groups: "Add Group"', () => {
  it('it requires the name and nothing else', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Groups {...props} />)

    await user.click(await screen.findByRole('button', { name: 'Add Group' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Please enter a name to add group.')).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'admin/groups/create')).toBeUndefined()
  })

  it('it creates the group with its description and puts it first in the list', async () => {
    const spy = server()
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Groups {...props} onNotice={onNotice} />)

    await user.click(await screen.findByRole('button', { name: 'Add Group' }))
    await user.type(screen.getByLabelText('Name'), 'Ops')
    await user.type(screen.getByLabelText('Description'), 'the on-call team')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/groups/create')?.[1]).toEqual({
      token: 'tok',
      body: { group: 'Ops', description: 'the on-call team' },
    })
    expect(screen.getByText('Total Groups: 4')).toBeInTheDocument()
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Group Added!',
      text: 'Group was added successfully.',
    })
  })
})

describe('Groups: the details modal', () => {
  it('it saves cleaned members and WITHOUT `newGroup` if the name did not change', async () => {
    const spy = server()
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Groups {...props} onNotice={onNotice} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'View Details' }))
    await screen.findByLabelText('Members')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/groups/set')?.[1]).toEqual({
      token: 'tok',
      body: { group: 'Administrators', description: 'Super administrators', members: 'admin' },
    })
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Group Saved!',
      text: 'Group details were saved successfully.',
    })
  })

  it('`newGroup` travels when the name changes', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Groups {...props} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'View Details' }))
    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Others')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const body = spy.mock.calls.find((c) => c[0] === 'admin/groups/set')?.[1]?.body as Record<string, string>
    expect(body.newGroup).toBe('Others')
    expect(body.group).toBe('Administrators')
  })

  it('\"Add User\" appends at the end and \"None\" empties the member list', async () => {
    server()
    const user = userEvent.setup()
    render(<Groups {...props} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'View Details' }))
    const add = await screen.findByLabelText('Add User')

    await choose(user, add, 'testuser')
    expect(screen.getByLabelText('Members')).toHaveValue('admin\ntestuser\n')

    await choose(user, add, 'None')
    expect(screen.getByLabelText('Members')).toHaveValue('')
  })

  it('deleting asks for confirmation with the name and takes the row out', async () => {
    const spy = server()
    const onNotice = vi.fn()
    const user = userEvent.setup()
    render(<Groups {...props} onNotice={onNotice} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Group' }))
    expect(
      screen.getByText('Are you sure you want to delete the group [Administrators] ?'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/groups/delete')?.[1]).toEqual({
      token: 'tok',
      body: { group: 'Administrators' },
    })
    expect(screen.getByText('Total Groups: 2')).toBeInTheDocument()
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Group Deleted!',
      text: 'Group was deleted successfully.',
    })
  })
})
