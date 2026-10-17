import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logs } from './Logs'
import * as logs from '../../api/logs'
import * as apps from '../../api/apps'
import type { InstalledApp } from '../../api/apps'
import { toIso } from './dates'

/*
The Dashboard charts' jump (deviation 7): the same arrival as a row menu's
`showQueryLogs`, with a time window or a value in this form's own fields.
*/

afterEach(() => vi.restoreAllMocks())

const APP = {
  name: 'Query Logs (Sqlite)',
  dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }],
} as unknown as InstalledApp

function setUp(list: InstalledApp[] = [APP]) {
  vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: list } } } as never)
  return vi.spyOn(logs, 'queryLogs').mockResolvedValue({
    kind: 'ok',
    data: { response: { pageNumber: 1, totalPages: 1, totalEntries: 0, entries: [] } },
  } as never)
}

describe('Query Logs: arriving from a Dashboard chart', () => {
  it('fills From, To and the value, and queries once with them', async () => {
    const query = setUp()
    const filters = { start: '2026-10-15T21:04:00', end: '2026-10-15T21:04:59', responseType: 'Cached' }
    render(<Logs token="t" sub="Query Logs" request={{ domain: null, clientIp: null, node: 'ns2', filters }} />)

    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query.mock.calls[0][1]).toMatchObject({
      start: toIso(filters.start),
      end: toIso(filters.end),
      responseType: 'Cached',
      protocol: '',
      qtype: '',
      qname: '',
      node: 'ns2',
    })
    /* The field normalises how it writes the value (no ":00", or ".000"): what
       matters is that it is the same instant. */
    expect(toIso((screen.getByLabelText('From') as HTMLInputElement).value)).toBe(toIso(filters.start))
    expect(toIso((screen.getByLabelText('To') as HTMLInputElement).value)).toBe(toIso(filters.end))
    expect(screen.getByLabelText('Response Type')).toHaveTextContent('Cached')
  })

  it('a protocol and a type land in their own fields', async () => {
    const query = setUp()
    render(<Logs token="t" sub="Query Logs" request={{ domain: null, clientIp: null, node: '', filters: { protocol: 'Tcp', qtype: 'AAAA' } }} />)
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query.mock.calls[0][1]).toMatchObject({ protocol: 'Tcp', qtype: 'AAAA', start: '', end: '' })
  })

  it("a count card's response code lands in RCODE, with no time window (upstream's v15.6.2 jump)", async () => {
    const query = setUp()
    render(<Logs token="t" sub="Query Logs" request={{ domain: null, clientIp: null, node: '', filters: { rcode: 'NxDomain' } }} />)
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query.mock.calls[0][1]).toMatchObject({ rcode: 'NxDomain', responseType: '', start: '', end: '' })
    expect(screen.getByLabelText('RCODE')).toHaveTextContent('NX Domain')
  })

  it('without a logging app it says what a row menu jump says, and queries nothing', async () => {
    const query = setUp([])
    render(<Logs token="t" sub="Query Logs" request={{ domain: null, clientIp: null, node: '', filters: { qtype: 'A' } }} />)
    expect(await screen.findByText(
      "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature from the Apps section.",
    )).toBeInTheDocument()
    expect(query).not.toHaveBeenCalled()
  })
})
