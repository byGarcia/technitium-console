import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Admin, SUB_TABS } from './Admin'
import * as client from '../../api/client'
import { CLUSTER_PRIMARY, CLUSTER_NOT_INITIALISED, GROUPS, PERMISSIONS, ADMIN_SESSION, SSO, ADMIN_USER } from './admin.fixture'
import { choose, valueShown } from '../../test/dropdown'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

function server(cluster = CLUSTER_NOT_INITIALISED) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    switch (path) {
      case 'admin/sessions/list':
        return ok({ response: { sessions: [ADMIN_SESSION] }, server: 'x' })
      case 'admin/users/list':
        return ok({ response: { users: [ADMIN_USER] }, server: 'x' })
      case 'admin/groups/list':
        return ok({ response: { groups: GROUPS }, server: 'x' })
      case 'admin/permissions/list':
        return ok({ response: { permissions: PERMISSIONS }, server: 'x' })
      case 'admin/sso/get':
        return ok({ response: SSO, server: 'x' })
      case 'admin/cluster/state':
        return ok({ response: cluster, server: 'x' })
      default:
        return ok({ response: {}, server: 'x' })
    }
  })
}

/*
The sub-navigation moved on 2026-09-07: it was the Shell's side panel and it is now
a bar under the title (`ui/SubTabs`), which is what the accepted delivery draws. So
the title is the SECTION and the active screen is the tab marked as the page.
*/
describe('Admin — the sub-navigation is a bar under the title', () => {
  it('with no `sub` it starts on Sessions, just like upstream', async () => {
    server()
    render(<Admin token="tok" />)
    expect(await screen.findByRole('heading', { name: 'Administration' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page')
  })

  it('a sub-tab that does not exist falls to Sessions instead of going blank', async () => {
    server()
    render(<Admin token="tok" sub="Inventada" />)
    expect(await screen.findByRole('heading', { name: 'Administration' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page')
  })

  it('the six sub-tabs draw without breaking and only one at a time', async () => {
    const marks: Record<string, string> = {
      Sessions: 'Total Sessions: 1',
      Users: 'Total Users: 1',
      Groups: 'Total Groups: 3',
      Permissions: 'Total Sections: 2',
      SSO: 'Single Sign-On (SSO)',
      Cluster: 'Cluster Not Initialized',
    }
    for (const sub of SUB_TABS) {
      server()
      const { unmount } = render(<Admin token="tok" sub={sub} />)
      expect(await screen.findAllByText(marks[sub])).not.toHaveLength(0)
      unmount()
      vi.restoreAllMocks()
    }
  })

  it('the cluster state is asked for ONCE and the sub-tabs share it', async () => {
    const spy = server()
    render(<Admin token="tok" sub="Users" />)
    await screen.findByText('Total Users: 1')
    expect(spy.mock.calls.filter((c) => c[0] === 'admin/cluster/state')).toHaveLength(1)
  })

  it('the node selector exists only in Sessions and Cluster, and both share its value', async () => {
    server(CLUSTER_PRIMARY)
    const user = userEvent.setup()
    const { rerender } = render(<Admin token="tok" sub="Sessions" />)
    await screen.findByText('Total Sessions: 1')

    expect(screen.getAllByLabelText('Cluster Node')).toHaveLength(1)
    await choose(user, screen.getByLabelText('Cluster Node'), 'ns2.micluster.test (secondary)')
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns2.micluster.test (secondary)')

    rerender(<Admin token="tok" sub="Cluster" />)
    await screen.findByText('Total Nodes: 2')
    expect(screen.getAllByLabelText('Cluster Node')).toHaveLength(1)
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns2.micluster.test (secondary)')

    rerender(<Admin token="tok" sub="Users" />)
    await screen.findByText('Total Users: 1')
    expect(screen.queryByLabelText('Cluster Node')).not.toBeInTheDocument()
  })

  /*
  A parity fix found while building this round, not a redesign.

  `updateClusterNodeDropDown` (cluster.js:1026) selects `dnsServerDomain` when
  nothing has been chosen; ours left the value empty and the control came up
  showing the "—" placeholder while the table under it listed two nodes. Seen on
  the harness with the real two-node cluster up.
  */
  it('the node selector starts on THIS server, as upstream does', async () => {
    server(CLUSTER_PRIMARY)
    render(<Admin token="tok" sub="Sessions" />)
    await screen.findByText('Total Sessions: 1')
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns1.micluster.test (primary)')
  })

  it('if this server is not among the nodes, it falls back to the first', async () => {
    server({
      ...CLUSTER_PRIMARY,
      clusterNodes: CLUSTER_PRIMARY.clusterNodes!.map((n) => ({ ...n, state: 'Connected' })),
    })
    render(<Admin token="tok" sub="Sessions" />)
    await screen.findByText('Total Sessions: 1')
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns1.micluster.test (primary)')
  })

  it('if the cluster state fails, the section keeps working', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
      if (path === 'admin/cluster/state') return { kind: 'error' as const, message: 'boom' }
      if (path === 'admin/groups/list') return ok({ response: { groups: GROUPS }, server: 'x' })
      return ok({ response: {}, server: 'x' })
    })
    render(<Admin token="tok" sub="Groups" />)
    expect(await screen.findByText('Total Groups: 3')).toBeInTheDocument()
  })
})
