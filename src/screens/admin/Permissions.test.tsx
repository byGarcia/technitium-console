import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Permissions } from './Permissions'
import * as client from '../../api/client'
import { CLUSTER_PRIMARY, PERMISSIONS } from './admin.fixture'
import { choose } from '../../test/dropdown'

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

describe('Permissions — the list', () => {
  it('it draws one card per section with its two tables and the total', async () => {
    server()
    render(<Permissions {...props} />)

    /* The section's name is the panel's TITLE, not a button: it was an
       orange link and did the same thing as the "Edit Permissions" next to it
       —two controls for one action. Upstream does not link it either.

       It is `getAllBy` and not `getBy` because the name now appears twice on the
       screen on purpose: once as this panel's title and once as a column of the
       concession map. */
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zones' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Edit Permissions' })).toHaveLength(2)
    expect(screen.getByText('Total Sections: 2')).toBeInTheDocument()
    /* One caption per section table, plus the map's rowgroup header for each
       population that has anyone in it. */
    expect(screen.getAllByText('User Permissions')).toHaveLength(3)
    expect(screen.getAllByText('Group Permissions')).toHaveLength(3)
  })

  /*
  The map is the round's first decision: eleven stacked panels compare nothing,
  and comparing across sections is what this screen is for. It is a table like the
  sections, only transposed — the sections across, one row per subject.
  */
  it('draws the concession map with the sections as its columns', async () => {
    server()
    render(<Permissions {...props} />)
    const map = await screen.findByRole('table', { name: 'Permissions' })
    for (const section of ['Dashboard', 'Zones']) {
      expect(within(map).getByRole('columnheader', { name: section })).toBeInTheDocument()
    }
    expect(within(map).getByRole('rowheader', { name: 'Administrators' })).toBeInTheDocument()
  })

  it('the index has one entry per section, and they point at its panel', async () => {
    server()
    render(<Permissions {...props} />)
    const index = await screen.findByRole('navigation', { name: 'On this page' })
    expect(within(index).getAllByRole('link')).toHaveLength(2)
    expect(within(index).getByRole('link', { name: 'Zones' })).toHaveAttribute('href', '#perm-zones')
  })

  it('with no per-user permissions the upstream literal comes out', async () => {
    server()
    render(<Permissions {...props} />)
    expect(await screen.findByText('No user permissions')).toBeInTheDocument()
  })

  it('with no per-group permissions its own literal comes out', async () => {
    server([{ section: 'Logs', userPermissions: [], groupPermissions: [] }])
    render(<Permissions {...props} />)
    expect(await screen.findByText('No group permissions')).toBeInTheDocument()
  })

  /*
  The one thing this round had to RESOLVE and not merely draw: a cell has a name
  written in the DOM, `{Section} · {Subject} · {Verb}`, and the grid it lives in
  is a table with both axes. Before this the eleven sections were a CSS grid and
  `contract()` reported `tables: []` with 84 cells inside.
  */
  it('the list is read-only: its checkboxes are disabled', async () => {
    server()
    render(<Permissions {...props} />)
    expect(await screen.findByLabelText('Dashboard · Administrators · View')).toBeDisabled()
    expect(screen.getByLabelText('Dashboard · Everyone · Modify')).not.toBeChecked()
  })

  it('a section is a table with its verbs as columns and its subject as the row', async () => {
    server()
    render(<Permissions {...props} />)
    await screen.findByRole('heading', { name: 'Dashboard' })
    const panel = document.getElementById('perm-dashboard')!
    const groups = within(panel).getByRole('table', { name: 'Group Permissions' })
    for (const verb of ['View', 'Modify', 'Delete']) {
      expect(within(groups).getByRole('columnheader', { name: verb })).toHaveAttribute(
        'scope',
        'col',
      )
    }
    expect(within(groups).getByRole('rowheader', { name: 'Everyone' })).toHaveAttribute(
      'scope',
      'row',
    )
  })

  it('with no sections the total says zero', async () => {
    server([])
    render(<Permissions {...props} />)
    expect(await screen.findByText('Total Sections: 0')).toBeInTheDocument()
  })
})

describe('Permissions — the editing modal', () => {
  async function open(cluster = null as never) {
    const spy = server()
    const user = userEvent.setup()
    render(<Permissions {...props} cluster={cluster} />)
    // It opens through its panel's button, which is the only control left.
    await screen.findByRole('heading', { name: 'Dashboard' })
    const panel = document.getElementById('perm-dashboard')!
    await user.click(within(panel).getByRole('button', { name: 'Edit Permissions' }))
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
        node: 'ns1.micluster.test',
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

    await screen.findByRole('heading', { name: 'Dashboard' })
    const panel = document.getElementById('perm-dashboard')!
    await user.click(within(panel).getByRole('button', { name: 'Edit Permissions' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onNotice).toHaveBeenCalledWith({
      type: 'success',
      title: 'Permissions Saved!',
      text: 'Section permissions were saved successfully.',
    })
  })
})
