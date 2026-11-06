import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sessions } from './Sessions'
import * as client from '../../api/client'
import {
  CLUSTER_PRIMARY,
  CLUSTER_NOT_INITIALISED,
  ADMIN_SESSION,
  TOKEN_SESSION,
  ADMIN_USER,
  NEW_USER,
  USER_DETAIL,
} from './admin.fixture'
import { choose } from '../../test/dropdown'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

function server(overrides: Record<string, unknown> = {}, server = 'ref.technitium-ui.test') {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'admin/sessions/list') {
      return ok({ response: { sessions: [ADMIN_SESSION, TOKEN_SESSION] }, server, ...overrides })
    }
    if (path === 'admin/users/list') {
      return ok({ response: { users: [ADMIN_USER, NEW_USER] }, server })
    }
    if (path === 'admin/users/get') {
      return ok({ response: { ...USER_DETAIL, username: 'testuser' }, server })
    }
    if (path === 'admin/sessions/createToken') {
      return ok({
        response: { username: 'testuser', tokenName: 'orbiter', token: 'abc123' },
        server,
      })
    }
    return ok({ response: {}, server })
  })
}

const props = { token: 'tok', cluster: null, onNotice: vi.fn() }

describe('Sessions: the table', () => {
  it('it draws each session with its partial token, its type and the total', async () => {
    server()
    render(<Sessions {...props} />)

    const t = await screen.findByRole('table')
    expect(within(t).getByText('[5fc1a6bc90cc1d9a]')).toBeInTheDocument()
    expect(within(t).getByText('(current)')).toBeInTheDocument()
    expect(within(t).getByText('Standard')).toBeInTheDocument()
    expect(within(t).getByText('API Token')).toBeInTheDocument()
    expect(within(t).getByText('tok1')).toBeInTheDocument()
    expect(screen.getByText('Total Sessions: 2')).toBeInTheDocument()
  })

  it('a session type it does not know is not swallowed: it comes out as \"Unknown\"', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(
      ok({
        response: { sessions: [{ ...ADMIN_SESSION, type: 'Martian' }] },
        server: 'x',
      }),
    )
    render(<Sessions {...props} />)
    expect(within(await screen.findByRole('table')).getByText('Unknown')).toBeInTheDocument()
  })

  it('with no sessions the table is left empty and the total says zero', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(ok({ response: { sessions: [] }, server: 'x' }))
    render(<Sessions {...props} />)
    expect(await screen.findByText('Total Sessions: 0')).toBeInTheDocument()
  })

  it('if the server fails it alerts with ITS message and does not blow up', async () => {
    const onNotice = vi.fn()
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    render(<Sessions {...props} onNotice={onNotice} />)

    expect(await screen.findByText('Total Sessions: 0')).toBeInTheDocument()
    expect(onNotice).toHaveBeenCalledWith({
      type: 'danger',
      title: 'Error!',
      text: 'Access was denied.',
    })
  })
})

describe('Sessions: "Create Token"', () => {
  it('it shows when there is no cluster', async () => {
    server()
    render(<Sessions {...props} />)
    expect(await screen.findByRole('button', { name: 'Create Token' })).toBeInTheDocument()
  })

  it('it shows if this server IS the primary node', async () => {
    server({}, 'ns1.mycluster.test')
    render(<Sessions {...props} cluster={CLUSTER_PRIMARY} />)
    expect(await screen.findByRole('button', { name: 'Create Token' })).toBeInTheDocument()
  })

  it('it hides if this server is NOT the primary node', async () => {
    server({}, 'ns2.mycluster.test')
    render(<Sessions {...props} cluster={CLUSTER_PRIMARY} />)
    await screen.findByText('Total Sessions: 2')
    expect(screen.queryByRole('button', { name: 'Create Token' })).not.toBeInTheDocument()
  })

  it('it requires the user first and the token name second', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Sessions {...props} />)

    await user.click(await screen.findByRole('button', { name: 'Create Token' }))
    await screen.findByLabelText('Token Name')

    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(screen.getByText('Please enter a token name.')).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'admin/sessions/createToken')).toBeUndefined()
  })

  it('it creates the token and shows user, name and token', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Sessions {...props} />)

    await user.click(await screen.findByRole('button', { name: 'Create Token' }))
    await user.type(await screen.findByLabelText('Token Name'), 'orbiter')
    await choose(user, screen.getByLabelText('Username'), 'testuser')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const call = spy.mock.calls.find((c) => c[0] === 'admin/sessions/createToken')
    expect(call?.[1]).toEqual({ token: 'tok', body: { user: 'testuser', tokenName: 'orbiter' } })
    expect(await screen.findByText('API token was created successfully.')).toBeInTheDocument()
    expect(screen.getByLabelText('Token')).toHaveValue('abc123')
  })
})

describe('Sessions: deleting a session', () => {
  it('it asks for confirmation with the partial token in the text', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Sessions {...props} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Session' }))
    expect(
      screen.getByText('Are you sure you want to delete the session [5fc1a6bc90cc1d9a] ?'),
    ).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'admin/sessions/delete')).toBeUndefined()
  })

  it('an ordinary session is deleted with the node CHOSEN on the screen', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Sessions {...props} cluster={CLUSTER_NOT_INITIALISED} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Session' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/sessions/delete')?.[1]).toEqual({
      token: 'tok',
      body: { partialToken: '5fc1a6bc90cc1d9a', node: '' },
    })
  })

  it('an API token is deleted against the PRIMARY node, not the chosen one', async () => {
    const spy = server({}, 'ns1.mycluster.test')
    const user = userEvent.setup()
    render(<Sessions {...props} cluster={CLUSTER_PRIMARY} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[1])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Session' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/sessions/delete')?.[1]).toEqual({
      token: 'tok',
      body: { partialToken: '799a4919af7636e2', node: 'ns1.mycluster.test' },
    })
  })

  it('on deleting, the success alert is the upstream literal and comes out on the page', async () => {
    const onNotice = vi.fn()
    server()
    const user = userEvent.setup()
    render(<Sessions {...props} onNotice={onNotice} />)

    await user.click((await screen.findAllByRole('button', { name: /^Actions for / }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Session' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Session Deleted!',
      text: 'The user session was deleted successfully.',
    })
    expect(screen.getByText('Total Sessions: 1')).toBeInTheDocument()
  })
})

describe('Sessions: the row that is mine', () => {
  it('washes my own session row, and only that one', async () => {
    server()
    render(<Sessions {...props} />)
    await screen.findByText('Total Sessions: 2')
    const rows = [...document.querySelectorAll('tbody tr')]
    const marked = rows.filter((r) => /_rowSelf_/.test(r.className))
    expect(marked).toHaveLength(1)
    /* The colour is never the only channel: the cell still says `(current)`,
       which is upstream's own word for it. */
    expect(marked[0].textContent).toContain('(current)')
  })
})

/* auth.js:937-938: upstream's menu holds "View User Details" and "Delete Session",
   in that order, and so does this one (deviation 23); the username opens the
   details too, as upstream's link does. */
describe('Sessions: the row actions', () => {
  it('the menu holds the two upstream entries in their order', async () => {
    server()
    render(<Sessions {...props} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for 799a4919af7636e2' }))
    const menu = screen.getByRole('menu', { name: 'Actions for 799a4919af7636e2' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'View User Details',
      'Delete Session',
    ])
  })

  it('View User Details opens the details of that session user', async () => {
    const spy = server()
    render(<Sessions {...props} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for 799a4919af7636e2' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'View User Details' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('testuser')).toBeInTheDocument()
    await waitFor(() => {
      const call = spy.mock.calls.find((c) => c[0] === 'admin/users/get')
      expect(call?.[1]?.body).toEqual({ user: 'testuser', includeGroups: 'true' })
    })
  })
})

/* Deviation 23: the strip, the search and the row's Details. */
describe('Sessions: the list reads like the rest', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('the strip counts by type, and pressing one narrows the table and writes ?type=', async () => {
    const spy = server()
    const user = userEvent.setup()
    const { unmount } = render(<Sessions {...props} />)
    const types = await screen.findByRole('group', { name: 'Sessions by type' })
    const calls = spy.mock.calls.length
    await user.click(within(types).getByRole('button', { name: /API Token/ }))
    expect(screen.getByText('Total Sessions: 2, 1 shown')).toBeInTheDocument()
    expect(window.location.search).toBe('?type=ApiToken')
    expect(spy.mock.calls.length).toBe(calls)
    await user.click(within(types).getByRole('button', { name: /API Token/ }))
    expect(screen.getByText('Total Sessions: 2')).toBeInTheDocument()
    unmount()
    expect(window.location.search).toBe('')
  })

  it('pressing a user in the strip writes it in the search', async () => {
    server()
    const user = userEvent.setup()
    render(<Sessions {...props} />)
    const users = await screen.findByRole('list', { name: 'Users' })
    await user.click(within(users).getByRole('button', { name: /testuser/ }))
    expect(screen.getByLabelText('Search')).toHaveValue('testuser')
    expect(screen.getByText('Total Sessions: 2, 1 shown')).toBeInTheDocument()
    expect(window.location.search).toBe('?q=testuser')
  })

  it('the search narrows by token name too', async () => {
    server()
    const user = userEvent.setup()
    render(<Sessions {...props} />)
    await screen.findByText('Total Sessions: 2')
    await user.type(screen.getByLabelText('Search'), 'TOK1')
    expect(within(screen.getByRole('table')).getByText('tok1')).toBeInTheDocument()
    expect(screen.getByText('Total Sessions: 2, 1 shown')).toBeInTheDocument()
  })

  it('Details opens the type and the whole user agent under the row', async () => {
    server()
    const user = userEvent.setup()
    render(<Sessions {...props} />)
    const row = (await screen.findByRole('button', { name: 'Actions for 799a4919af7636e2' })).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Details' }))
    const detail = row.nextElementSibling as HTMLElement
    expect(within(detail).getByText('User Agent')).toBeInTheDocument()
    expect(within(detail).getByText('API Token')).toBeInTheDocument()
  })

  it('the node picker and Create Token sit in the table toolbar', async () => {
    server({}, 'ns1.mycluster.test')
    render(<Sessions {...props} cluster={CLUSTER_PRIMARY} node="ns1.mycluster.test" />)
    const create = await screen.findByRole('button', { name: 'Create Token' })
    const search = screen.getByLabelText('Search')
    expect(create.closest('div[class*="toolbar"]')).toBe(search.closest('div[class*="toolbar"]'))
    expect(screen.getByLabelText('Cluster Node')).toBeInTheDocument()
  })
})
