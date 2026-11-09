import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as dns from '../../api/dnsclient'
import * as logs from '../../api/logs'
import { clearReportCache } from './list-hits'
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

describe('Blocked by list', () => {
  it('counts on click, skips the server address, and reuses the name the next time', async () => {
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
    expect(screen.getByText('Not counted yet. One click reads the current blocked log and skips 127.0.0.1 and ::1.')).toBeInTheDocument()
    expect(logs.queryLogs).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Count lists' }))
    expect(await screen.findByText('sb.txt')).toBeInTheDocument()
    expect(screen.getByText('1 blocked query in the log')).toBeInTheDocument()
    expect(screen.getByText(/Skipped 1 from 127.0.0.1 or ::1/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'sb.txt: 1 blocked' })).toBeInTheDocument()
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith('T', expect.objectContaining({
      server: 'this-server', domain: 'ads.example', type: 'TXT', protocol: 'UDP',
    }))

    await userEvent.click(screen.getByRole('button', { name: 'Count lists' }))
    expect(await screen.findByText(/reused 1 cached name/)).toBeInTheDocument()
    expect(resolve).toHaveBeenCalledTimes(1)
  })
})
