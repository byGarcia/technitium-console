import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Permissions } from './Permissions'
import * as client from '../../api/client'
import { CLUSTER_PRIMARY, PERMISSIONS } from './admin.fixture'
import { choose } from '../../test/dropdown'
import { mockSystemTheme, resetTheme } from '../../test/system-theme'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

const DETAIL = {
  section: 'Dashboard',
  userPermissions: [],
  groupPermissions: [
    { name: 'Administrators', canView: true, canModify: true, canDelete: true },
    { name: 'Everyone', canView: true, canModify: false, canDelete: false },
  ],
  users: ['admin', 'testuser'],
  // `Everyone` appears in this list and NOT in `groups/list`'s: they are two
  // different lists from the server.
  groups: ['Administrators', 'DHCP Administrators', 'Everyone'],
}

function server(sections = PERMISSIONS, detail: Record<string, unknown> = DETAIL) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'admin/permissions/list') {
      return ok({ response: { permissions: sections }, server: 'x' })
    }
    if (path === 'admin/permissions/get') return ok({ response: detail, server: 'x' })
    if (path === 'admin/permissions/set') {
      return ok({
        response: { section: 'Dashboard', userPermissions: [], groupPermissions: [] },
        server: 'x',
      })
    }
    return ok({ response: {}, server: 'x' })
  })
}

const props = { token: 'tok', cluster: null, onNotice: vi.fn() }

/* A section's row in the matrix, by its row header. */
async function rowOf(section: string) {
  return (await screen.findByRole('rowheader', { name: section })).closest('tr')!
}

describe('Permissions: the matrix', () => {
  /*
  Deviation 23: upstream's list is a row per section holding two small tables; here
  it is ONE matrix with the sections as rows and every subject as a column, groups
  first and then users, under upstream's two titles.
  */
  it('draws the sections as rows and the groups, then the users, as columns', async () => {
    server()
    render(<Permissions {...props} />)
    const map = await screen.findByRole('table', { name: 'Permissions' })
    expect(within(map).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Dashboard', 'Zones'])
    const heads = within(map).getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual([
      'Section',
      'Group Permissions',
      'User Permissions',
      'Edit Permissions',
      'Administrators',
      'Everyone',
      'testuser',
    ])
    expect(screen.getByText('Total Sections: 2')).toBeInTheDocument()
  })

  it('a cell says the verbs granted; no entry is an empty cell', async () => {
    server()
    render(<Permissions {...props} />)
    const dashboard = await rowOf('Dashboard')
    const cells = within(dashboard).getAllByRole('cell')
    // Administrators, Everyone, testuser, then the row's action.
    expect(cells[0]).toHaveTextContent('View, Modify, Delete')
    expect(cells[1]).toHaveTextContent('View')
    expect(cells[1]).not.toHaveTextContent('Modify')
    expect(cells[2]).toHaveTextContent('')
    expect(cells[2].textContent).toBe('')
    const zones = within(await rowOf('Zones')).getAllByRole('cell')
    expect(zones[1].textContent).toBe('')
    expect(zones[2]).toHaveTextContent('View')
  })

  it('an entry that grants nothing is still drawn, and says None', async () => {
    server([
      {
        section: 'Logs',
        userPermissions: [],
        groupPermissions: [{ name: 'Everyone', canView: false, canModify: false, canDelete: false }],
      },
    ])
    render(<Permissions {...props} />)
    const cells = within(await rowOf('Logs')).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('None')
  })

  it('with nobody holding a user permission the upstream literal comes out once', async () => {
    server([PERMISSIONS[0]])
    render(<Permissions {...props} />)
    expect(await screen.findAllByText('No user permissions')).toHaveLength(1)
  })

  it('with no per-group permissions its own literal comes out', async () => {
    server([{ section: 'Logs', userPermissions: [], groupPermissions: [] }])
    render(<Permissions {...props} />)
    expect(await screen.findByText('No group permissions')).toBeInTheDocument()
  })

  it('the Section header sorts the rows, as upstream does', async () => {
    server()
    const user = userEvent.setup()
    render(<Permissions {...props} />)
    const map = await screen.findByRole('table', { name: 'Permissions' })
    // Already in order, so the first press reverses it, as upstream's `sortTable` does.
    await user.click(within(map).getByRole('button', { name: 'Section' }))
    expect(within(map).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Zones', 'Dashboard'])
    await user.click(within(map).getByRole('button', { name: 'Section' }))
    expect(within(map).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Dashboard', 'Zones'])
  })

  it('the name, the row button and a click on the row each open the section', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Permissions {...props} />)
    const sectionOf = () => {
      const body = spy.mock.calls.filter((c) => c[0] === 'admin/permissions/get').at(-1)?.[1]?.body
      return (body as Record<string, string> | undefined)?.section
    }

    await user.click(await screen.findByRole('button', { name: 'Zones' }))
    expect(await screen.findByRole('dialog', { name: 'Edit Permissions - Zones' })).toBeInTheDocument()
    expect(sectionOf()).toBe('Zones')
    await user.keyboard('{Escape}')

    await user.click(within(await rowOf('Dashboard')).getByRole('button', { name: 'Edit Permissions' }))
    expect(await screen.findByRole('dialog', { name: 'Edit Permissions - Dashboard' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(within(await rowOf('Zones')).getAllByRole('cell')[0])
    expect(await screen.findByRole('dialog', { name: 'Edit Permissions - Zones' })).toBeInTheDocument()
  })

  it('with no sections the total says zero', async () => {
    server([])
    render(<Permissions {...props} />)
    expect(await screen.findByText('Total Sections: 0')).toBeInTheDocument()
  })
})

describe('Permissions: folded on a phone', () => {
  afterEach(() => resetTheme())

  it('one block per section, its groups then its users, with the upstream literals', async () => {
    mockSystemTheme(true) // every media query matches: the narrow layout
    server()
    render(<Permissions {...props} />)
    const blocks = await screen.findByRole('list', { name: 'Permissions' })
    const items = within(blocks).getAllByRole('listitem').filter((li) => li.parentElement === blocks)
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('No user permissions')).toBeInTheDocument()
    expect(within(items[0]).getByText('Everyone')).toBeInTheDocument()
    expect(within(items[1]).getByText('testuser')).toBeInTheDocument()
    expect(within(items[1]).getByRole('button', { name: 'Edit Permissions' })).toBeInTheDocument()
  })
})

describe('Permissions: the editing modal', () => {
  async function open(cluster = null as never) {
    const spy = server()
    const user = userEvent.setup()
    render(<Permissions {...props} cluster={cluster} />)
    // It opens through the section's row.
    await user.click(within(await rowOf('Dashboard')).getByRole('button', { name: 'Edit Permissions' }))
    await screen.findByRole('dialog')
    return { user, spy }
  }

  it('it asks for the section with users and groups', async () => {
    const { spy } = await open()
    expect(spy.mock.calls.find((c) => c[0] === 'admin/permissions/get')?.[1]).toEqual({
      token: 'tok',
      body: { section: 'Dashboard', includeUsersAndGroups: 'true' },
    })
  })

  it('it serialises both tables with `|` and sends the primary node of the cluster', async () => {
    const { user, spy } = await open(CLUSTER_PRIMARY as never)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/permissions/set')?.[1]).toEqual({
      token: 'tok',
      body: {
        section: 'Dashboard',
        userPermissions: '',
        groupPermissions:
          'Administrators|true|true|true|Everyone|true|false|false',
        node: 'ns1.mycluster.test',
      },
    })
  })

  it('with no cluster the node travels as an empty string', async () => {
    const { user, spy } = await open()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const body = spy.mock.calls.find((c) => c[0] === 'admin/permissions/set')?.[1]?.body as Record<string, string>
    expect(body.node).toBe('')
  })

  it('\"Add User\" adds the row with the three permissions false', async () => {
    const { user, spy } = await open()
    await choose(user, screen.getByLabelText('Add User'), 'testuser')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const body = spy.mock.calls.find((c) => c[0] === 'admin/permissions/set')?.[1]?.body as Record<string, string>
    expect(body.userPermissions).toBe('testuser|false|false|false')
  })

  it('\"None\" empties the whole table', async () => {
    const { user, spy } = await open()
    await choose(user, screen.getByLabelText('Add Group'), 'None')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const body = spy.mock.calls.find((c) => c[0] === 'admin/permissions/set')?.[1]?.body as Record<string, string>
    expect(body.groupPermissions).toBe('')
  })

  it('\"Remove\" takes a row out and checking a box shows up in the send', async () => {
    const { user, spy } = await open()
    const dialog = screen.getByRole('dialog')

    /* The modal names its cells exactly as the read-only list does: what you
       tick here is called what it was called there. */
    await user.click(within(dialog).getByLabelText('Dashboard · Everyone · Modify'))
    await user.click(within(dialog).getAllByRole('button', { name: 'Remove' })[0])
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const body = spy.mock.calls.find((c) => c[0] === 'admin/permissions/set')?.[1]?.body as Record<string, string>
    expect(body.groupPermissions).toBe('Everyone|true|true|false')
  })

  it('on saving it alerts with the upstream literal and redraws the section', async () => {
    const onNotice = vi.fn()
    server()
    const user = userEvent.setup()
    render(<Permissions {...props} onNotice={onNotice} />)

    await user.click(within(await rowOf('Dashboard')).getByRole('button', { name: 'Edit Permissions' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Permissions Saved!',
      text: 'Section permissions were saved successfully.',
    })
  })
})
