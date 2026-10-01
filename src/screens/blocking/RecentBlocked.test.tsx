import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as apps from '../../api/apps'
import type { InstalledApp } from '../../api/apps'
import * as blocking from '../../api/blocking'
import { RecentBlocked } from './RecentBlocked'

afterEach(() => vi.restoreAllMocks())

const LOGGER: InstalledApp = {
  name: 'Query Logs (Sqlite)', description: null, version: '1', dnsApps: [{
    classPath: 'QueryLogsSqlite.App', description: '', isAppRecordRequestHandler: false, recordDataTemplate: null,
    isRequestController: false, isAuthoritativeRequestHandler: false, isRequestBlockingHandler: false,
    isQueryLogger: true, isQueryLogs: true, isPostProcessor: false,
  }],
}

function withApps(list: InstalledApp[]) {
  return vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { response: { apps: list } } })
}

describe('RecentBlocked', () => {
  it('without a logging app it says so with upstream sentence and links to Apps', async () => {
    withApps([])
    render(<RecentBlocked token="T" permissions={undefined} node="" aggregate={false} serverDomain="dns.test" />)
    const sentence = await screen.findByText(/Please install the 'Query Logs \(Sqlite\)' DNS App/)
    expect(sentence).toHaveTextContent(
      "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature from the Apps section.",
    )
    expect(screen.getByRole('link', { name: 'Apps' })).toHaveAttribute('href', expect.stringMatching(/apps\/$/))
  })

  it('draws the entries of the first logging app', async () => {
    withApps([LOGGER])
    const spy = vi.spyOn(blocking, 'recentBlocked').mockResolvedValue({
      kind: 'ok', data: { partial: false, entries: [{
        rowNumber: 1, timestamp: '2026-10-01T10:00:00Z', clientIpAddress: '192.168.1.34', protocol: 'Udp',
        responseType: 'Blocked', rcode: 'NoError', qname: 'app-measurement.com', qtype: 'A', qclass: 'IN', answer: null,
      }] },
    })
    render(<RecentBlocked token="T" permissions={undefined} node="" aggregate={false} serverDomain="dns.test" />)
    expect(await screen.findByText('app-measurement.com')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('T', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, '')
    expect(screen.getByRole('link', { name: 'Open Query Logs' }))
      .toHaveAttribute('href', expect.stringMatching(/logs\/query-logs\/$/))
  })

  it('with a node chosen it reads that node', async () => {
    withApps([LOGGER])
    const spy = vi.spyOn(blocking, 'recentBlocked').mockResolvedValue({ kind: 'ok', data: { partial: false, entries: [] } })
    render(<RecentBlocked token="T" permissions={undefined} node="node2.test" aggregate={false} serverDomain="dns.test" />)
    expect(await screen.findByText('No blocked queries.')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('T', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, 'node2.test')
  })

  it('with the cluster aggregate it reads the connected node and says which', async () => {
    withApps([LOGGER])
    const spy = vi.spyOn(blocking, 'recentBlocked').mockResolvedValue({ kind: 'ok', data: { partial: false, entries: [] } })
    render(<RecentBlocked token="T" permissions={undefined} node="cluster" aggregate serverDomain="dev.cluster.test" />)
    expect(await screen.findByText('on dev.cluster.test')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('T', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, '')
  })

  it('says when one of the three classes could not be read', async () => {
    withApps([LOGGER])
    vi.spyOn(blocking, 'recentBlocked').mockResolvedValue({ kind: 'ok', data: { partial: true, entries: [] } })
    render(<RecentBlocked token="T" permissions={undefined} node="" aggregate={false} serverDomain="dns.test" />)
    expect(await screen.findByText('Some blocked queries could not be read.')).toBeInTheDocument()
  })

  it('a failed app list is an error with the server message, not the no-app state', async () => {
    vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    render(<RecentBlocked token="T" permissions={undefined} node="" aggregate={false} serverDomain="dns.test" />)
    expect(await screen.findByText('Access was denied.')).toBeInTheDocument()
    expect(screen.queryByText(/Please install/)).toBeNull()
  })

  it('without Logs.canView it is locked', () => {
    const list = withApps([LOGGER])
    render(
      <RecentBlocked token="T" permissions={{ Logs: { canView: false, canModify: false, canDelete: false } }}
        node="" aggregate={false} serverDomain="dns.test" />,
    )
    expect(screen.getByText('Requires Logs: View')).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })
})
