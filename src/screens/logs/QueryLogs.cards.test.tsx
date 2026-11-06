import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Logs } from './Logs'
import * as logs from '../../api/logs'
import * as apps from '../../api/apps'
import type { InstalledApp } from '../../api/apps'
import type { QueryLogEntry, QueryLogPage } from '../../api/logs'
import { toIso } from './dates'

/*
Query Logs laid out as cards over one results card (deviation 20): the page's
cards and what pressing them sends, one line per row with its Details, and the
query in the address bar.
*/

const APP = {
  name: 'Query Logs (Sqlite)',
  dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }],
} as unknown as InstalledApp

function entry(rowNumber: number, partial: Partial<QueryLogEntry> = {}): QueryLogEntry {
  return {
    rowNumber,
    timestamp: '2026-11-06T07:00:00Z',
    clientIpAddress: '10.0.0.1',
    protocol: 'Udp',
    responseType: 'Recursive',
    responseRtt: 4.5,
    rcode: 'NoError',
    qname: 'example.com',
    qtype: 'A',
    qclass: 'IN',
    answer: 'A 192.0.2.1, A 192.0.2.2',
    ...partial,
  }
}

const ENTRIES = [
  entry(4, { responseType: 'Cached' }),
  entry(3, { responseType: 'Blocked', rcode: 'NxDomain', qname: 'ads.example', clientIpAddress: '10.0.0.9', answer: null }),
  entry(2),
  entry(1, { qname: 'other.example' }),
]

function page(partial: Partial<QueryLogPage> = {}): QueryLogPage {
  return { pageNumber: 1, totalPages: 3, totalEntries: 12, entries: ENTRIES, ...partial }
}

function setUp(answer: QueryLogPage = page()) {
  vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: [APP] } } } as never)
  return vi.spyOn(logs, 'queryLogs').mockResolvedValue({ kind: 'ok', data: { response: answer } } as never)
}

async function queried(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText('App Name')
  await user.click(screen.getByRole('button', { name: 'Query' }))
  await screen.findByTitle('ads.example')
}

function card(title: string) {
  return within(screen.getByRole('heading', { name: title }).closest('div')!.parentElement!)
}

beforeEach(() => window.history.replaceState(null, '', '/logs/query-logs/'))
afterEach(() => vi.restoreAllMocks())

describe('Query Logs: the cards of the page on screen', () => {
  it('are drawn only once a page has landed', async () => {
    const user = userEvent.setup()
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    expect(screen.queryByRole('heading', { name: 'Response Types' })).toBeNull()
    await queried(user)
    for (const title of ['Response Types', 'RCODE', 'Top Clients', 'Top Domains']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('count the page, of the logs the server has, and how many were answered blocked', async () => {
    const user = userEvent.setup()
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await queried(user)
    const types = card('Response Types')
    expect(types.getByText('of 12 logs')).toBeInTheDocument()
    expect(types.getByRole('button', { name: 'Recursive 2' })).toBeInTheDocument()
    expect(types.getByText('25%')).toBeInTheDocument()
    expect(card('RCODE').getByRole('button', { name: 'NX Domain 1' })).toBeInTheDocument()
    expect(card('Top Clients').getByRole('button', { name: '10.0.0.1 3' })).toBeInTheDocument()
    expect(card('Top Domains').getByRole('button', { name: 'example.com 2' })).toBeInTheDocument()
  })

  it('a pressed type sets Response Type and runs Query from page 1, as choosing it would', async () => {
    const user = userEvent.setup()
    const query = setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await queried(user)
    await user.type(screen.getByLabelText('Page Number'), '{backspace}3')

    await user.click(card('Response Types').getByRole('button', { name: 'Cached 1' }))

    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[1][1]).toMatchObject({ responseType: 'Cached', pageNumber: '1', qname: '' })
    expect(screen.getByLabelText('Response Type')).toHaveTextContent('Cached')
    expect(screen.getByLabelText('Page Number')).toHaveValue(1)
  })

  it('the applied one is pressed, and pressing it again empties the field and queries', async () => {
    const user = userEvent.setup()
    const query = setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await queried(user)
    await user.click(card('RCODE').getByRole('button', { name: 'NX Domain 1' }))
    await vi.waitFor(() => expect(card('RCODE').getByRole('button', { name: 'NX Domain 1' })).toHaveAttribute('aria-pressed', 'true'))

    await user.click(card('RCODE').getByRole('button', { name: 'NX Domain 1' }))
    expect(query.mock.calls[2][1]).toMatchObject({ rcode: '' })
  })

  it('a client or a name sets its own field', async () => {
    const user = userEvent.setup()
    const query = setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await queried(user)
    await user.click(card('Top Clients').getByRole('button', { name: '10.0.0.9 1' }))
    expect(query.mock.calls[1][1]).toMatchObject({ clientIpAddress: '10.0.0.9' })
    await user.click(card('Top Domains').getByRole('button', { name: 'other.example 1' }))
    expect(query.mock.calls[2][1]).toMatchObject({ clientIpAddress: '10.0.0.9', qname: 'other.example' })
  })

  it('with Live Update on, pressing only sets the field, which the loop then sends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ delay: null })
      const query = setUp()
      render(<Logs token="t" sub="Query Logs" />)
      // With fake clocks `findBy*` does not work (CONVENTIONS.md, Tests).
      await vi.waitFor(() => expect(screen.queryByLabelText('App Name')).toBeInTheDocument())
      /* The filters reach the ref Query reads in an effect after the app lands; a
         loaded machine could press Query before it and get upstream's `Missing!`. */
      await vi.advanceTimersByTimeAsync(0)
      await user.click(screen.getByRole('button', { name: 'Query' }))
      await vi.waitFor(() => expect(screen.queryByTitle('ads.example')).toBeInTheDocument())
      await user.click(screen.getByLabelText('Live Update'))
      await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(2))

      await user.click(card('Response Types').getByRole('button', { name: 'Cached 1' }))
      expect(query).toHaveBeenCalledTimes(2)
      expect(screen.getByLabelText('Response Type')).toHaveTextContent('Cached')

      await vi.advanceTimersByTimeAsync(2100)
      expect(query).toHaveBeenCalledTimes(3)
      expect(query.mock.calls[2][1]).toMatchObject({ responseType: 'Cached', pageNumber: '1' })
      await user.click(screen.getByLabelText('Live Update'))
    } finally {
      vi.useRealTimers()
    }
  })
})

/* Live Update, seen live (deviation 27): the rows a turn brings flash once, and the
   switch says how many logs arrived since it was turned on, counted from the total. */
describe('Query Logs: what Live Update brings', () => {
  it('marks the new rows of each turn and counts the arrivals from the total', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ delay: null })
      const query = setUp()
      render(<Logs token="t" sub="Query Logs" />)
      await vi.waitFor(() => expect(screen.queryByLabelText('App Name')).toBeInTheDocument())
      await user.click(screen.getByLabelText('Live Update'))
      await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
      await vi.waitFor(() => expect(screen.queryByTitle('ads.example')).toBeInTheDocument())
      // The first turn is what was there: nothing is new yet.
      expect(screen.getByText('0 new')).toBeInTheDocument()
      expect(document.querySelectorAll('tr[data-fresh]')).toHaveLength(0)

      query.mockResolvedValue({
        kind: 'ok',
        data: { response: page({ totalEntries: 27, entries: [entry(6, { qname: 'new.example' }), entry(5), ...ENTRIES.slice(0, 2)] }) },
      } as never)
      await vi.advanceTimersByTimeAsync(2100)
      await vi.waitFor(() => expect(screen.queryByTitle('new.example')).toBeInTheDocument())
      expect(document.querySelectorAll('tr[data-fresh]')).toHaveLength(2)
      // Fifteen more in the log, though only two fit on page 1.
      expect(screen.getByText('15 new')).toBeInTheDocument()

      // A filter changed while live starts a new count: the next turn adds nothing.
      await user.click(card('Response Types').getByRole('button', { name: 'Cached 1' }))
      query.mockResolvedValue({
        kind: 'ok',
        data: { response: page({ totalEntries: 900, entries: [entry(9, { responseType: 'Cached', qname: 'cached.example' })] }) },
      } as never)
      await vi.advanceTimersByTimeAsync(2100)
      await vi.waitFor(() => expect(screen.queryByTitle('cached.example')).toBeInTheDocument())
      expect(query.mock.calls.at(-1)?.[1]).toMatchObject({ responseType: 'Cached' })
      expect(screen.getByText('15 new')).toBeInTheDocument()
      expect(document.querySelectorAll('tr[data-fresh]')).toHaveLength(0)

      await user.click(screen.getByLabelText('Live Update'))
      expect(screen.queryByText(/\d+ new/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Query Logs: one line per row', () => {
  it('holds when, who, what and how it was answered; the rest is under Details', async () => {
    const user = userEvent.setup()
    setUp(page({ entries: [ENTRIES[2]] }))
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.click(screen.getByRole('button', { name: 'Query' }))
    const headers = (await screen.findAllByRole('columnheader')).map((h) => h.textContent)
    expect(headers).toEqual(['Timestamp', 'Client IP Address', 'Domain', 'Type', 'Response Type', 'RCODE', 'Answer', ''])

    const details = screen.getByRole('button', { name: 'Details' })
    expect(details).toHaveAttribute('aria-expanded', 'false')
    await user.click(details)
    expect(details).toHaveAttribute('aria-expanded', 'true')
    const open = document.getElementById(details.getAttribute('aria-controls')!)!
    expect(open).toHaveTextContent('#2')
    expect(open).toHaveTextContent('ProtocolUdp')
    expect(open).toHaveTextContent('ClassIN')
    expect(open).toHaveTextContent('(4.50 ms)')
    // The answer whole, one record a line, and the same text as it came.
    expect(open).toHaveTextContent('A 192.0.2.1, A 192.0.2.2')
    expect(within(open).getByText('A 192.0.2.2')).toBeInTheDocument()

    await user.click(details)
    expect(document.getElementById(details.getAttribute('aria-controls')!)).toBeNull()
  })
})

describe('Query Logs: the query in the address bar', () => {
  it('is written once a query lands: what it sent and the page the server answered', async () => {
    const user = userEvent.setup()
    setUp(page({ pageNumber: 3 }))
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.type(screen.getByLabelText('Domain'), '*.example')
    expect(window.location.search).toBe('')
    await user.click(screen.getByRole('button', { name: 'Query' }))
    await screen.findByTitle('ads.example')
    const bar = new URLSearchParams(window.location.search)
    expect(bar.get('qname')).toBe('*.example')
    expect(bar.get('pageNumber')).toBe('3')
    expect(bar.get('name')).toBeNull()
  })

  it('a link queries that form once on arrival, with Live Update off', async () => {
    const start = toIso('2026-11-06T08:00')
    window.history.replaceState(
      null,
      '',
      `/logs/query-logs/?qname=example.com&rcode=NxDomain&pageNumber=2&start=${encodeURIComponent(start)}`,
    )
    const query = setUp(page({ pageNumber: 2 }))
    render(<Logs token="t" sub="Query Logs" />)

    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query.mock.calls[0][1]).toMatchObject({
      qname: 'example.com',
      rcode: 'NxDomain',
      pageNumber: '2',
      start,
      name: 'Query Logs (Sqlite)',
    })
    expect(screen.getByLabelText('Domain')).toHaveValue('example.com')
    expect(screen.getByLabelText('Live Update')).not.toBeChecked()
  })

  it('a jump from another screen wins over the bar', async () => {
    window.history.replaceState(null, '', '/logs/query-logs/?qname=from-the-bar.example')
    const query = setUp()
    render(<Logs token="t" sub="Query Logs" request={{ domain: 'jump.example', clientIp: null, node: '' }} />)
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query.mock.calls[0][1]).toMatchObject({ qname: 'jump.example' })
  })

  it('leaves with the screen', async () => {
    const user = userEvent.setup()
    setUp()
    const { unmount } = render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.type(screen.getByLabelText('Domain'), 'x.example')
    await user.click(screen.getByRole('button', { name: 'Query' }))
    await screen.findByTitle('ads.example')
    expect(window.location.search).not.toBe('')
    unmount()
    expect(window.location.search).toBe('')
  })
})
