import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as dns from '../../api/dnsclient'
import * as logs from '../../api/logs'
import * as settingsApi from '../../api/settings'
import { clearReportCache, LOOKUP_CAP } from './list-hits'
import { ListHits } from './ListHits'

/*
Count lists, fed at the API: one blocked name from a client, one from the server
itself. The panel must not read the log until the button is pressed, and a second
press must reuse the name it already resolved.
*/

const APP = { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }

function entry(ip: string, qname: string) {
  return {
    rowNumber: 1, timestamp: '2026-11-09T12:00:00Z', clientIpAddress: ip, protocol: 'Udp',
    responseType: 'Blocked', rcode: 'NxDomain', qname, qtype: 'A', qclass: 'IN', answer: null,
  }
}

afterEach(() => {
  clearReportCache()
  vi.restoreAllMocks()
})

const OPEN = {
  enableBlocking: true,
  allowTxtBlockingReport: true,
  blockingBypassList: [] as string[],
}

function allowReports() {
  vi.spyOn(settingsApi, 'readSettings').mockResolvedValue({ kind: 'ok', data: OPEN as never })
}

describe('Blocked by list', () => {
  it('counts on click, skips the server address, and reuses the name the next time', async () => {
    allowReports()
    vi.spyOn(logs, 'queryLogs').mockResolvedValue({
      kind: 'ok',
      data: {
        response: {
          pageNumber: 1, totalPages: 1, totalEntries: 2,
          entries: [entry('10.0.0.5', 'ads.example'), entry('127.0.0.1', 'loop.example')],
        },
      },
    })
    const resolve = vi.spyOn(dns, 'resolve').mockResolvedValue({
      kind: 'ok',
      data: {
        response: {
          result: {
            Question: [{ Name: 'ads.example' }],
            Answer: [{
              Type: 'TXT',
              RDATA: { Text: 'source=block-list-zone; blockListUrl=https://lists.test/sb.txt; domain=ads.example' },
            }],
          },
        },
      },
    } as never)
    render(<ListHits token="T" app={APP} node="" aggregate={false} serverDomain="dns1.example" />)
    expect(screen.getByRole('heading', { name: 'Blocked by list' })).toBeInTheDocument()
    expect(screen.getByText(
      `Not counted yet. One click reads the current blocked log, skips 127.0.0.1 and ::1, and sends at most ${LOOKUP_CAP.toLocaleString()} lookups. Each lookup is logged as blocked from this server. Allow TXT Blocking Report has to be enabled, or this server does not say which list matched.`,
    )).toBeInTheDocument()
    expect(logs.queryLogs).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Count lists' }))
    expect(await screen.findByText('sb.txt')).toBeInTheDocument()
    expect(screen.getByText('1 blocked query in the log')).toBeInTheDocument()
    expect(screen.getByText(/Skipped 1 from 127.0.0.1 or ::1/)).toBeInTheDocument()
    expect(screen.getByText(/Each one is logged as blocked from this server/)).toBeInTheDocument()
    expect(screen.getByText(/this server's own group, not the client's/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'sb.txt: 1 blocked' })).toBeInTheDocument()
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith('T', expect.objectContaining({
      server: 'this-server', domain: 'ads.example', type: 'TXT', protocol: 'UDP',
    }))

    await userEvent.click(screen.getByRole('button', { name: 'Count lists' }))
    expect(await screen.findByText(/reused 1 cached name/)).toBeInTheDocument()
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('does not look a name up when the server will not say which list matched', async () => {
    vi.spyOn(settingsApi, 'readSettings').mockResolvedValue({
      kind: 'ok',
      data: { ...OPEN, allowTxtBlockingReport: false } as never,
    })
    vi.spyOn(logs, 'queryLogs').mockResolvedValue({
      kind: 'ok',
      data: { response: { pageNumber: 1, totalPages: 1, totalEntries: 1, entries: [entry('10.0.0.5', 'ads.example')] } },
    })
    const resolve = vi.spyOn(dns, 'resolve')
    render(<ListHits token="T" app={APP} node="" aggregate={false} serverDomain="dns1.example" />)
    await userEvent.click(screen.getByRole('button', { name: 'Count lists' }))
    expect(await screen.findByText(/Allow TXT Blocking Report is off/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Blocking › Settings' })).toBeInTheDocument()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('without Settings: View it says so and reads nothing', async () => {
    const read = vi.spyOn(settingsApi, 'readSettings')
    const query = vi.spyOn(logs, 'queryLogs')
    const resolve = vi.spyOn(dns, 'resolve')
    render(
      <ListHits token="T" app={APP} node="" aggregate={false} serverDomain="dns1.example" settingsNeed="Settings.canView" />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Count lists' }))
    expect(await screen.findByText(/The blocking settings were not checked/)).toBeInTheDocument()
    expect(screen.getByText(/Requires Settings: View/)).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('changing the node drops the count, and an answer still in flight is not drawn there', async () => {
    allowReports()
    vi.spyOn(logs, 'queryLogs').mockResolvedValue({
      kind: 'ok',
      data: { response: { pageNumber: 1, totalPages: 1, totalEntries: 1, entries: [entry('10.0.0.5', 'ads.example')] } },
    })
    let finish!: (value: Awaited<ReturnType<typeof dns.resolve>>) => void
    vi.spyOn(dns, 'resolve').mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const props = { token: 'T', app: APP, aggregate: false, serverDomain: 'dns1.example' }
    const { rerender } = render(<ListHits {...props} node="a" />)
    await userEvent.click(screen.getByRole('button', { name: 'Count lists' }))
    expect(await screen.findByText('Reading the blocked log…')).toBeInTheDocument()
    rerender(<ListHits {...props} node="b" />)
    expect(screen.getByText(/Not counted yet/)).toBeInTheDocument()
    await act(async () => {
      finish({
        kind: 'ok',
        data: {
          response: {
            result: {
              Question: [{ Name: 'ads.example' }],
              Answer: [{
                Type: 'TXT',
                RDATA: { Text: 'source=block-list-zone; blockListUrl=https://lists.test/sb.txt; domain=ads.example' },
              }],
            },
          },
        },
      })
    })
    expect(screen.getByText(/Not counted yet/)).toBeInTheDocument()
    expect(screen.queryByText('sb.txt')).toBeNull()
  })
})
