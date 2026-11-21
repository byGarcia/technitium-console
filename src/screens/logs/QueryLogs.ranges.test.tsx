/*
The quick ranges beside From and To (deviation 52): each fills both fields, from
that long ago to now, and runs the same `logs/query` Query would, from page 1.
A field changed by hand, Reset and Live Update leave no range pressed, and the
filters go to the address bar as any query's do.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Logs } from './Logs'
import * as logs from '../../api/logs'
import * as apps from '../../api/apps'
import type { InstalledApp } from '../../api/apps'
import type { QueryLogsParams } from '../../api/logs'
import { forgetRoot } from '../../app/route'
import { localInput } from '../dashboard/jump'

const APP = {
  name: 'Query Logs (Sqlite)',
  dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }],
} as unknown as InstalledApp

const NODES = [
  { name: 'ns1.test', type: 'Primary' },
  { name: 'ns2.test', type: 'Secondary' },
]

function setUp() {
  vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: [APP] } } } as never)
  return vi.spyOn(logs, 'queryLogs').mockResolvedValue({
    kind: 'ok',
    data: { response: { pageNumber: 1, totalPages: 1, totalEntries: 0, entries: [] } },
  } as never)
}

function servedAt(trail: string, route: string | null) {
  document.head.querySelector('meta[name="route"]')?.remove()
  if (route != null) {
    const m = document.createElement('meta')
    m.setAttribute('name', 'route')
    m.setAttribute('content', route)
    document.head.appendChild(m)
  }
  window.history.replaceState(null, '', trail)
  forgetRoot()
}

const NOW = new Date('2026-11-20T12:30:15').getTime()
const ranges = () => screen.getByRole('group', { name: 'Quick range' })
const pressed = () =>
  within(ranges()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)
/* jsdom writes a `datetime-local` value with seconds as `…:15.000`; a browser as `…:15`. */
const shown = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value.replace(/\.000$/, '')
const sent = (spy: ReturnType<typeof setUp>): QueryLogsParams[] => spy.mock.calls.map((c) => c[1])

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  servedAt('/logs/query-logs/', 'logs/query-logs')
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  servedAt('/', null)
})

describe('Query Logs: quick ranges', () => {
  it('offers 15 min, 1 h, 24 h and 7 d beside From and To, none pressed, and queries nothing by itself', async () => {
    const spy = setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')

    expect(within(ranges()).getAllByRole('button').map((b) => b.textContent)).toEqual(['15 min', '1 h', '24 h', '7 d'])
    expect(pressed()).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it.each([
    ['15 min', 15 * 60_000],
    ['1 h', 3_600_000],
    ['24 h', 86_400_000],
    ['7 d', 7 * 86_400_000],
  ])('%s fills From and To and runs the query from page 1 with the other filters as typed', async (label, span) => {
    const user = userEvent.setup({ delay: null })
    const spy = setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.type(screen.getByLabelText('Domain'), 'example.com')
    await user.type(screen.getByLabelText('Page Number'), '{selectall}4')

    await user.click(within(ranges()).getByRole('button', { name: label }))

    const start = localInput(NOW - span)
    const end = localInput(NOW)
    expect(shown('From')).toBe(start)
    expect(shown('To')).toBe(end)
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(sent(spy)[0]).toMatchObject({
      pageNumber: '1',
      qname: 'example.com',
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    })
    expect(pressed()).toEqual([label])
    /* The bar carries the instants, as any query's From and To. */
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('start')).toBe(new Date(start).toISOString()))
  })

  it('pressed again, asks again up to the new now', async () => {
    const user = userEvent.setup({ delay: null })
    const spy = setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.click(within(ranges()).getByRole('button', { name: '1 h' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    vi.setSystemTime(NOW + 60_000)
    await user.click(within(ranges()).getByRole('button', { name: '1 h' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(sent(spy)[1].end).toBe(new Date(localInput(NOW + 60_000)).toISOString())
    expect(pressed()).toEqual(['1 h'])
  })

  it('a From or To typed by hand is a custom range: no range stays pressed and nothing more is queried', async () => {
    const user = userEvent.setup({ delay: null })
    const spy = setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.click(within(ranges()).getByRole('button', { name: '24 h' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    await user.clear(screen.getByLabelText('From'))
    await user.type(screen.getByLabelText('From'), '2026-11-01T00:00')
    expect(pressed()).toEqual([])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('Reset empties From and To and leaves no range pressed', async () => {
    const user = userEvent.setup({ delay: null })
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.click(within(ranges()).getByRole('button', { name: '7 d' }))

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByLabelText('From')).toHaveValue('')
    expect(screen.getByLabelText('To')).toHaveValue('')
    expect(pressed()).toEqual([])
  })

  it('Live Update disables them with From and To, and leaves none pressed', async () => {
    const user = userEvent.setup({ delay: null })
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')
    await user.click(within(ranges()).getByRole('button', { name: '15 min' }))

    await user.click(screen.getByLabelText('Live Update'))
    for (const b of within(ranges()).getAllByRole('button')) expect(b).toBeDisabled()
    expect(screen.getByLabelText('From')).toHaveValue('')
    expect(pressed()).toEqual([])
  })

  it('without an app says what Query says, and fills the fields all the same', async () => {
    const user = userEvent.setup({ delay: null })
    vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: [] } } } as never)
    const spy = vi.spyOn(logs, 'queryLogs')
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')

    await user.click(within(ranges()).getByRole('button', { name: '1 h' }))
    expect(
      await screen.findByText(/Please install the 'Query Logs \(Sqlite\)' DNS App .* from the Apps section\./),
    ).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    expect(shown('From')).toBe(localInput(NOW - 3_600_000))
  })

  it('in All nodes, sends the range to every node', async () => {
    const user = userEvent.setup({ delay: null })
    const spy = setUp()
    render(<Logs token="t" sub="Query Logs" nodes={NODES} clusterInitialised />)
    await screen.findByLabelText('App Name')
    await user.click(screen.getByRole('button', { name: 'All nodes' }))

    await user.click(within(ranges()).getByRole('button', { name: '1 h' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    const start = new Date(localInput(NOW - 3_600_000)).toISOString()
    expect(sent(spy).map((p) => [p.node, p.start])).toEqual([
      ['ns1.test', start],
      ['ns2.test', start],
    ])
  })
})
