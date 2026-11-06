import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResponseTime } from './ResponseTime'
import { useDashboardSample } from './dashboard-sample'

/* The card as the Dashboard mounts it: over the Dashboard's one read of the log. */
function Card({ token, node, canView, refreshOn, where = '' }: { token: string; node: string; canView: boolean; refreshOn: unknown; where?: string }) {
  const sample = useDashboardSample(token, node, canView, refreshOn)
  return <ResponseTime sample={sample} where={where} />
}
import * as apps from '../../api/apps'
import * as logs from '../../api/logs'
import type { InstalledApp } from '../../api/apps'

afterEach(() => vi.restoreAllMocks())

const APP = { name: 'Query Logs (Sqlite)', dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }] } as unknown as InstalledApp

function withApp(installed = true) {
  return vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: installed ? [APP] : [] } } } as never)
}

const entry = (rtt?: number) => ({
  rowNumber: 1, timestamp: '', clientIpAddress: '10.0.0.1', protocol: 'Udp', responseType: 'Recursive',
  ...(rtt == null ? {} : { responseRtt: rtt }), rcode: 'NoError', qname: 'a.example', qtype: 'A', qclass: 'IN', answer: null,
})

describe('the Dashboard Response Time card', () => {
  it('reads the newest 1,000 log entries of the node and shows the median, p95 and the slow share', async () => {
    withApp()
    const read = vi.spyOn(logs, 'newestQueries').mockResolvedValue({ kind: 'ok', data: [entry(2), entry(12), entry(150), entry()] } as never)
    render(<Card token="t" node="ns2" canView refreshOn={1} />)
    expect(await screen.findByText('Median')).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith('t', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, expect.objectContaining({ node: 'ns2', limit: 1000 }))
    expect(screen.getByText('12.0 ms')).toBeInTheDocument()
    expect(screen.getByText('150 ms')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
    // How many answers it stands on comes first, against the sample.
    expect(screen.getByText((_, el) => el?.textContent === '3 of the last 4 queries went upstream')).toBeInTheDocument()
    // Under 20 timed answers the 95th percentile is the slowest one, and says so.
    expect(screen.getByText('Slowest')).toBeInTheDocument()
    expect(screen.queryByText('95th percentile')).toBeNull()
  })

  it('says whose log it read on the cluster aggregate', async () => {
    withApp()
    vi.spyOn(logs, 'newestQueries').mockResolvedValue({ kind: 'ok', data: [entry(5)] } as never)
    render(<Card token="t" node="" canView refreshOn={1} where=" on ns1.example" />)
    expect(await screen.findByText((_, el) => el?.textContent === '1 of the last 1 query went upstream on ns1.example')).toBeInTheDocument()
  })

  it('is locked without Logs: View, and reads nothing', () => {
    const list = withApp()
    render(<Card token="t" node="" canView={false} refreshOn={1} />)
    expect(screen.getByText(/Logs/)).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })

  it('says so without a query logging app, and when nothing was timed', async () => {
    withApp(false)
    const { unmount } = render(<Card token="t" node="" canView refreshOn={1} />)
    expect(await screen.findByText(/Please install the 'Query Logs \(Sqlite\)' DNS App/)).toBeInTheDocument()
    unmount()
    withApp()
    vi.spyOn(logs, 'newestQueries').mockResolvedValue({ kind: 'ok', data: [entry(), entry()] } as never)
    render(<Card token="t" node="" canView refreshOn={1} />)
    expect(await screen.findByText('No query in the latest 2 went upstream.')).toBeInTheDocument()
  })

  it('names the 95th percentile once there are 20 timed answers, and writes shares in whole percents', async () => {
    withApp()
    vi.spyOn(logs, 'newestQueries').mockResolvedValue({ kind: 'ok', data: Array.from({ length: 20 }, (_, i) => entry(i + 1)) } as never)
    render(<Card token="t" node="" canView refreshOn={1} />)
    expect(await screen.findByText('95th percentile')).toBeInTheDocument()
    expect(screen.queryByText('Slowest')).toBeNull()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

describe('wholePercent', () => {
  it('keeps 0 and 100 for exactly none and all', async () => {
    const { wholePercent } = await import('./response-time')
    expect([0, 0.001, 0.004, 0.333, 0.996, 1].map(wholePercent)).toEqual(['0%', '<1%', '<1%', '33%', '>99%', '100%'])
  })
})
