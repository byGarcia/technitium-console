import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Admin, SUB_TABS } from './Admin'
import { SECTIONS } from '../../app/sections'
import * as client from '../../api/client'
import { CLUSTER_PRIMARY, CLUSTER_NOT_INITIALISED, GROUPS, PERMISSIONS, ADMIN_SESSION, SSO, LDAP, ADMIN_USER } from './admin.fixture'
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
      case 'admin/ldap/get':
        return ok({ response: LDAP, server: 'x' })
      case 'admin/cluster/state':
        return ok({ response: cluster, server: 'x' })
      default:
        return ok({ response: {}, server: 'x' })
    }
  })
}

/*
The sub-navigation is in the sidebar again since 2026-11-06 (deviation 24): the
screen draws no bar, and its title is the screen under `Administration ›`.
*/
describe('Admin: the screen is its sub-section', () => {
  it('with no `sub` it starts on Sessions, just like upstream', async () => {
    server()
    render(<Admin token="tok" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeInTheDocument()
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('a sub-tab that does not exist falls to Sessions instead of going blank', async () => {
    server()
    render(<Admin token="tok" sub="Invented" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeInTheDocument()
  })

  it('the seven sub-tabs draw without breaking and only one at a time', async () => {
    const marks: Record<string, string> = {
      Sessions: 'Total Sessions: 1',
      Users: 'Total Users: 1',
      Groups: 'Total Groups: 3',
      Permissions: 'Total Sections: 2',
      SSO: 'Single Sign-On (SSO)',
      LDAP: 'Enable LDAP Authentication',
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

  it('LDAP sits between SSO and Cluster, as in upstream (index.html:2926-2928)', async () => {
    // The order the sidebar unfolds them in, and the screen's own.
    const admin = SECTIONS.find((x) => x.id === 'admin')!
    expect(admin.subs).toEqual(['Sessions', 'Users', 'Groups', 'Permissions', 'SSO', 'LDAP', 'Cluster'])
    expect([...SUB_TABS]).toEqual(admin.subs)
    server()
    render(<Admin token="tok" sub="LDAP" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'LDAP' })).toBeInTheDocument()
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
    await choose(user, screen.getByLabelText('Cluster Node'), 'ns2.mycluster.test (secondary)')
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns2.mycluster.test (secondary)')

    rerender(<Admin token="tok" sub="Cluster" />)
    await screen.findByText('Total Nodes: 2')
    expect(screen.getAllByLabelText('Cluster Node')).toHaveLength(1)
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns2.mycluster.test (secondary)')

    rerender(<Admin token="tok" sub="Users" />)
    await screen.findByText('Total Users: 1')
    expect(screen.queryByLabelText('Cluster Node')).not.toBeInTheDocument()
  })

  /*
  A parity fix found while building this round, not a redesign.

  `updateClusterNodeDropDown` (cluster.js:1026) selects `dnsServerDomain` when
  nothing has been chosen; ours left the value empty and the control came up
  showing the empty-value dash while the table under it listed two nodes. Seen on
  the harness with the real two-node cluster up.
  */
  it('the node selector starts on THIS server, as upstream does', async () => {
    server(CLUSTER_PRIMARY)
    render(<Admin token="tok" sub="Sessions" />)
    await screen.findByText('Total Sessions: 1')
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns1.mycluster.test (primary)')
  })

  it('if this server is not among the nodes, it falls back to the first', async () => {
    server({
      ...CLUSTER_PRIMARY,
      clusterNodes: CLUSTER_PRIMARY.clusterNodes!.map((n) => ({ ...n, state: 'Connected' })),
    })
    render(<Admin token="tok" sub="Sessions" />)
    await screen.findByText('Total Sessions: 1')
    expect(valueShown(screen.getByLabelText('Cluster Node'))).toBe('ns1.mycluster.test (primary)')
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
