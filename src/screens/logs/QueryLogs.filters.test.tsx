import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Logs } from './Logs'
import * as logs from '../../api/logs'
import * as apps from '../../api/apps'
import type { InstalledApp } from '../../api/apps'
import { activeFilters, defaultFilters, FOLD_QUERY, LEGEND_ROWS } from './QueryLogs'
import { choose } from '../../test/dropdown'

/*
The filter panel and the legend below 960 px (FOLD_QUERY in QueryLogs.tsx): the
panel folds to its title and lists what is set, and nothing it sends changes.
*/

const APP = {
  name: 'Query Logs (Sqlite)',
  dnsApps: [{ classPath: 'QueryLogsSqlite.App', isQueryLogs: true }],
} as unknown as InstalledApp
const NO_QUERY_LOGS = {
  name: 'NO DATA',
  dnsApps: [{ classPath: 'NoData.App', isQueryLogs: false }],
} as unknown as InstalledApp

function setUp(list: InstalledApp[] = [APP]) {
  vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps: list } } } as never)
  return vi.spyOn(logs, 'queryLogs').mockResolvedValue({
    kind: 'ok',
    data: { response: { pageNumber: 1, totalPages: 1, totalEntries: 0, entries: [] } },
  } as never)
}

/** A window this wide or narrower matches `FOLD_QUERY`; jsdom has no matchMedia. */
function windowWidth(narrow: boolean) {
  const matchMedia = (media: string) => ({
    media,
    matches: narrow && media === FOLD_QUERY,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true, writable: true })
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as { matchMedia?: unknown }).matchMedia
})

const panel = () => document.getElementById('ql-filters') as HTMLElement

describe('Query Logs: what the folded panel lists', () => {
  const reset = defaultFilters('Query Logs (Sqlite)', 'QueryLogsSqlite.App')

  it('nothing, when the form is what Reset gives', () => {
    expect(activeFilters(reset, reset)).toEqual([])
  })

  it('every field that differs, in the form order, with the value the field shows', () => {
    const f = {
      ...reset,
      start: '2026-10-16T09:00',
      descendingOrder: 'false',
      qname: '*.com',
      protocol: 'Udp',
      responseType: 'Blocked',
      rcode: 'NxDomain',
    }
    expect(activeFilters(f, reset)).toEqual([
      { label: 'From', value: '2026-10-16 09:00' },
      { label: 'Order', value: 'Ascending' },
      { label: 'Domain', value: '*.com' },
      { label: 'Protocol', value: logs.PROTOCOLS.find((p) => p.value === 'Udp')?.label },
      { label: 'Response Type', value: logs.RESPONSE_TYPES.find((p) => p.value === 'Blocked')?.label },
      { label: 'RCODE', value: logs.RCODES.find((p) => p.value === 'NxDomain')?.label },
    ])
  })

  it('names each filter by the label its field carries in the form', async () => {
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')

    const changed = Object.fromEntries(Object.keys(reset).map((k) => [k, 'x'])) as unknown as typeof reset
    const labels = activeFilters(changed, reset).map((a) => a.label)
    expect(labels).toHaveLength(14)
    for (const label of labels) expect(screen.getByLabelText(label)).toBeInTheDocument()
  })
})

describe('Query Logs: the filter panel above 960', () => {
  it('is always open, under a heading and with no toggle', async () => {
    windowWidth(false)
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByLabelText('App Name')

    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull()
    expect(panel()).not.toHaveAttribute('hidden')
  })
})

describe('Query Logs: the filter panel below 960', () => {
  it('starts folded to its title, which opens and closes it', async () => {
    windowWidth(true)
    const user = userEvent.setup()
    setUp()
    render(<Logs token="t" sub="Query Logs" />)

    const toggle = await screen.findByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(panel()).toHaveAttribute('hidden')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel()).not.toHaveAttribute('hidden')
  })

  it('Query sends the same filters and folds the panel, which then says what is set', async () => {
    windowWidth(true)
    const user = userEvent.setup()
    const query = setUp()
    render(<Logs token="t" sub="Query Logs" />)

    await user.click(await screen.findByRole('button', { name: 'Filters' }))
    await user.type(screen.getByLabelText('Domain'), 'home.test')
    await choose(user, screen.getByLabelText('Protocol'), 'UDP')
    await user.click(screen.getByRole('button', { name: 'Query' }))

    expect(query.mock.calls[0][1]).toMatchObject({ qname: 'home.test', protocol: 'Udp', pageNumber: '1' })
    const toggle = screen.getByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(panel()).toHaveAttribute('hidden')
    const set = document.getElementById('ql-filters-set') as HTMLElement
    expect(toggle).toHaveAttribute('aria-describedby', 'ql-filters-set')
    expect(set).toHaveTextContent('Domain: home.test')
    expect(set).toHaveTextContent('Protocol: UDP')
    // The fields keep their values while folded.
    expect(screen.getByLabelText('Domain')).toHaveValue('home.test')
  })

  it('with nothing set, the folded panel lists nothing', async () => {
    windowWidth(true)
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    const toggle = await screen.findByRole('button', { name: 'Filters' })

    expect(document.getElementById('ql-filters-set')).toBeNull()
    expect(toggle).not.toHaveAttribute('aria-describedby')
  })

  it('a validation that fails opens the panel and focuses its field, as upstream does', async () => {
    windowWidth(true)
    const user = userEvent.setup()
    const query = setUp([NO_QUERY_LOGS])
    render(<Logs token="t" sub="Query Logs" />)
    await screen.findByRole('button', { name: 'Filters' })

    await user.click(screen.getByRole('button', { name: 'Query' }))

    expect(query).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature from the Apps section.",
      ),
    ).toBeInTheDocument()
    expect(panel()).not.toHaveAttribute('hidden')
    expect(screen.getByLabelText('App Name')).toHaveFocus()

    // Export validates the same field, and opens the panel the same way.
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(panel()).toHaveAttribute('hidden')
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(panel()).not.toHaveAttribute('hidden')
    expect(screen.getByLabelText('App Name')).toHaveFocus()
  })

  it('a jump from the Dashboard arrives folded, and the panel says which filters it brought', async () => {
    windowWidth(true)
    setUp()
    const filters = { start: '2026-10-15T21:04:00', responseType: 'Cached' }
    render(<Logs token="t" sub="Query Logs" request={{ domain: 'example.com', clientIp: null, node: '', filters }} />)

    const set = await vi.waitFor(() => {
      const el = document.getElementById('ql-filters-set')
      if (el == null) throw new Error('not yet')
      return el
    })
    expect(set).toHaveTextContent('From: 2026-10-15 21:04:00')
    expect(set).toHaveTextContent('Domain: example.com')
    expect(set).toHaveTextContent(`Response Type: ${logs.RESPONSE_TYPES.find((r) => r.value === 'Cached')?.label}`)
  })
})

describe('Query Logs: the legend below 960', () => {
  it('keeps the seven pills, and its title opens the conditions', async () => {
    windowWidth(true)
    const user = userEvent.setup()
    setUp()
    render(<Logs token="t" sub="Query Logs" />)
    await user.click(await screen.findByRole('button', { name: 'Query' }))

    const toggle = await screen.findByRole('button', { name: 'Row colours' })
    const legend = toggle.parentElement as HTMLElement
    for (const row of LEGEND_ROWS) {
      expect(within(legend).getByText(row.name)).toBeInTheDocument()
      expect(within(legend).getByText(row.when)).toBeInTheDocument()
    }
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
