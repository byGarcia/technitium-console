import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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
    expect(await screen.findByRole('heading', { name: 'Recently Blocked on dev.cluster.test' })).toBeInTheDocument()
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

/* The Overview's Blocked figure moves in real time; the list follows it. */
describe('RecentBlocked: following the Blocked figure', () => {
  const row = (n: number, qname: string) => ({
    rowNumber: n, timestamp: '2026-10-01T10:00:00Z', clientIpAddress: '192.168.1.34', protocol: 'Udp',
    responseType: 'Blocked', rcode: 'NoError', qname, qtype: 'A', qclass: 'IN', answer: null,
  })
  const props = { token: 'T', permissions: undefined, node: '', aggregate: false, serverDomain: 'dns.test' }

  it('a new figure reads the list again, keeping the rows on screen while it travels', async () => {
    withApps([LOGGER])
    let finish!: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void
    const spy = vi.spyOn(blocking, 'recentBlocked')
      .mockResolvedValueOnce({ kind: 'ok', data: { partial: false, entries: [row(1, 'first.test')] } })
      .mockReturnValueOnce(new Promise((r) => { finish = r }))
    const { rerender } = render(<RecentBlocked {...props} refreshOn={5} />)
    expect(await screen.findByText('first.test')).toBeInTheDocument()

    rerender(<RecentBlocked {...props} refreshOn={6} />)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.getByText('first.test')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    finish({ kind: 'ok', data: { partial: false, entries: [row(2, 'second.test'), row(1, 'first.test')] } })
    expect(await screen.findByText('second.test')).toBeInTheDocument()
    expect(listApps()).toHaveBeenCalledTimes(1)
  })

  it('never two reads at once: a figure that moves mid-read reads once more afterwards', async () => {
    withApps([LOGGER])
    let finish!: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void
    const spy = vi.spyOn(blocking, 'recentBlocked')
      .mockResolvedValueOnce({ kind: 'ok', data: { partial: false, entries: [row(1, 'first.test')] } })
      .mockReturnValueOnce(new Promise((r) => { finish = r }))
      .mockResolvedValue({ kind: 'ok', data: { partial: false, entries: [row(3, 'third.test')] } })
    const { rerender } = render(<RecentBlocked {...props} refreshOn={5} />)
    await screen.findByText('first.test')
    rerender(<RecentBlocked {...props} refreshOn={6} />)
    rerender(<RecentBlocked {...props} refreshOn={7} />)
    rerender(<RecentBlocked {...props} refreshOn={8} />)
    expect(spy).toHaveBeenCalledTimes(2)
    finish({ kind: 'ok', data: { partial: false, entries: [row(2, 'second.test')] } })
    expect(await screen.findByText('third.test')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('a failed refresh leaves the last good list in place', async () => {
    withApps([LOGGER])
    const spy = vi.spyOn(blocking, 'recentBlocked')
      .mockResolvedValueOnce({ kind: 'ok', data: { partial: false, entries: [row(1, 'first.test')] } })
      .mockResolvedValue({ kind: 'error', message: 'boom' })
    const { rerender } = render(<RecentBlocked {...props} refreshOn={5} />)
    await screen.findByText('first.test')
    await act(async () => rerender(<RecentBlocked {...props} refreshOn={6} />))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.getByText('first.test')).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })

  it('queues a figure change while the first rows are loading', async () => {
    withApps([LOGGER])
    let finish!: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void
    const spy = vi.spyOn(blocking, 'recentBlocked')
      .mockReturnValueOnce(new Promise((r) => { finish = r }))
      .mockResolvedValue({ kind: 'ok', data: { partial: false, entries: [row(2, 'new.test')] } })
    const { rerender } = render(<RecentBlocked {...props} refreshOn={5} />)
    await act(async () => {})
    expect(spy).toHaveBeenCalledTimes(1)
    rerender(<RecentBlocked {...props} refreshOn={6} />)
    await act(async () => finish({ kind: 'ok', data: { partial: false, entries: [row(1, 'old.test')] } }))
    expect(await screen.findByText('new.test')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('drops an old node response and its queued refresh after changing nodes', async () => {
    withApps([LOGGER])
    let finish!: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void
    const spy = vi.spyOn(blocking, 'recentBlocked')
      .mockResolvedValueOnce({ kind: 'ok', data: { partial: false, entries: [row(1, 'first.test')] } })
      .mockReturnValueOnce(new Promise((r) => { finish = r }))
      .mockResolvedValue({ kind: 'ok', data: { partial: false, entries: [row(3, 'new-node.test')] } })
    const { rerender } = render(<RecentBlocked {...props} node="old-node.test" refreshOn={5} />)
    await screen.findByText('first.test')
    rerender(<RecentBlocked {...props} node="old-node.test" refreshOn={6} />)
    rerender(<RecentBlocked {...props} node="old-node.test" refreshOn={7} />)
    rerender(<RecentBlocked {...props} node="new-node.test" refreshOn={7} />)
    await screen.findByText('new-node.test')
    await act(async () => finish({ kind: 'ok', data: { partial: false, entries: [row(2, 'late.test')] } }))
    expect(screen.queryByText('late.test')).not.toBeInTheDocument()
    expect(screen.getByText('new-node.test')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(3)
    expect(spy.mock.calls.map((args) => args[2])).toEqual(['old-node.test', 'old-node.test', 'new-node.test'])
  })

  it('drops a pending refresh when Logs permission is revoked', async () => {
    withApps([LOGGER])
    let finish!: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void
    const spy = vi.spyOn(blocking, 'recentBlocked')
      .mockResolvedValueOnce({ kind: 'ok', data: { partial: false, entries: [row(1, 'first.test')] } })
      .mockReturnValueOnce(new Promise((r) => { finish = r }))
    const { rerender } = render(<RecentBlocked {...props} refreshOn={5} />)
    await screen.findByText('first.test')
    rerender(<RecentBlocked {...props} refreshOn={6} />)
    rerender(<RecentBlocked {...props} refreshOn={7} />)
    rerender(<RecentBlocked {...props} refreshOn={7} permissions={{ Logs: { canView: false, canModify: false, canDelete: false } }} />)
    await act(async () => finish({ kind: 'ok', data: { partial: false, entries: [row(2, 'late.test')] } }))
    expect(screen.getByText('Requires Logs: View')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('late.test')).not.toBeInTheDocument()
  })

  it('does not continue a queued refresh after unmount', async () => {
    withApps([LOGGER])
    let finish!: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void
    const spy = vi.spyOn(blocking, 'recentBlocked')
      .mockResolvedValueOnce({ kind: 'ok', data: { partial: false, entries: [row(1, 'first.test')] } })
      .mockReturnValueOnce(new Promise((r) => { finish = r }))
    const { rerender, unmount } = render(<RecentBlocked {...props} refreshOn={5} />)
    await screen.findByText('first.test')
    rerender(<RecentBlocked {...props} refreshOn={6} />)
    rerender(<RecentBlocked {...props} refreshOn={7} />)
    unmount()
    await act(async () => finish({ kind: 'ok', data: { partial: false, entries: [] } }))
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

const listApps = () => vi.mocked(apps.listApps)
