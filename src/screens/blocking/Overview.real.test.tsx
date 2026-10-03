import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { percentage } from '../dashboard/Dashboard'
import { REAL, realServer } from '../../test/real-blocking'
import { Overview } from './Overview'

/*
The Overview fed with what the harness really answered (`test/real-blocking.ts`):
the shapes of `dashboard/stats/get`, `settings/get`, `apps/list` and `logs/query` go
through the real client and parsers, and every figure on screen is checked against
the captured answer, not against a number typed here.
*/

const drawn = vi.hoisted(() => new Map<string, { labels: string[]; datasets: { label: string; data: number[] }[] }>())

vi.mock('../dashboard/Chart', () => ({
  Chart: ({ aria, data }: { aria: string; data: never }) => {
    drawn.set(aria.startsWith('Blocked share') ? 'ring' : 'bars', data)
    return <div role="img" aria-label={aria} />
  },
}))

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(realServer())
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  drawn.clear()
})

/** The value of a figure, found by its label: a bare number can also be a hit count,
    and `Blocked` is also the ring's word. A figure is value, sub-line, label. */
function figure(label: string) {
  const own = screen
    .getAllByText(label, { selector: 'span' })
    .filter((el) => el.parentElement!.children[2] === el)
  expect(own).toHaveLength(1)
  return own[0].parentElement!.firstElementChild!.textContent
}

async function shows(label: string, value: string) {
  await vi.waitFor(() => expect(figure(label)).toBe(value))
}

const series = (d: { datasets: { label: string; data: (number | string)[] }[] }, label: string) =>
  d.datasets.find((x) => x.label === label)!.data.map(Number)

describe('Overview against the harness', () => {
  it('draws the four figures of the period as the server counted them', async () => {
    const s = REAL.statsLastHour.response.stats
    render(<Overview token="T" permissions={undefined} />)
    await shows('Total Queries', s.totalQueries.toLocaleString())
    expect(figure('Blocked')).toBe(s.totalBlocked.toLocaleString())
    expect(screen.getByText(`${percentage(s.totalBlocked, s.totalQueries)} of total`)).toBeInTheDocument()
    expect(figure('Block List Domains')).toBe(s.blockListZones.toLocaleString())
    const rules = screen.getByText('Your Rules', { selector: 'span' }).parentElement!
    expect([...rules.children[0].children].map((c) => c.textContent)).toEqual([
      s.blockedZones.toLocaleString(),
      s.allowedZones.toLocaleString(),
    ])
  })

  it('a day of traffic: the bars split Total into Allowed and Blocked, minute by minute', async () => {
    const day = REAL.statsLastDay.response
    render(<Overview token="T" permissions={undefined} />)
    await shows('Total Queries', REAL.statsLastHour.response.stats.totalQueries.toLocaleString())
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    await shows('Total Queries', day.stats.totalQueries.toLocaleString())
    expect(figure('Blocked')).toBe(day.stats.totalBlocked.toLocaleString())

    const bars = drawn.get('bars')!
    const total = series(day.mainChartData, 'Total')
    const blocked = series(day.mainChartData, 'Blocked')
    expect(bars.labels).toHaveLength(day.mainChartData.labels.length)
    expect(series(bars, 'Blocked')).toEqual(blocked)
    expect(series(bars, 'Allowed')).toEqual(total.map((t, i) => t - blocked[i]))
    // The server's own totals: the series add up to the figures above them.
    expect(blocked.reduce((a, b) => a + b, 0)).toBe(day.stats.totalBlocked)
    expect(total.reduce((a, b) => a + b, 0)).toBe(day.stats.totalQueries)
    expect(screen.getByRole('img', { name: `Blocked share: ${percentage(day.stats.totalBlocked, day.stats.totalQueries)}` }))
      .toBeInTheDocument()
  })

  it('the top tables list the domains the server ranked, with their hits', async () => {
    const day = REAL.statsLastDay.response
    render(<Overview token="T" permissions={undefined} />)
    await shows('Total Queries', REAL.statsLastHour.response.stats.totalQueries.toLocaleString())
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    await shows('Total Queries', day.stats.totalQueries.toLocaleString())
    for (const [title, rows] of [
      ['Top Blocked Domains', day.topBlockedDomains],
      ['Top Domains', day.topDomains],
    ] as const) {
      const panel = screen.getByRole('heading', { name: title }).parentElement!.parentElement!
      const table = within(panel).getByRole('table')
      expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1)
      for (const r of rows) {
        const row = within(table).getByText(r.name).closest('tr')!
        expect(row).toHaveTextContent(r.hits.toLocaleString())
      }
    }
  })

  it('reads the blocking state from the real settings', async () => {
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByText(REAL.settings.response.enableBlocking ? 'Blocking is enabled' : 'Blocking is disabled'))
      .toBeInTheDocument()
  })

  it('Recently Blocked finds the logging app and draws the newest blocked queries', async () => {
    const entries = [
      ...REAL.logsBlocked.response.entries,
      ...REAL.logsUpstreamBlocked.response.entries,
      ...REAL.logsUpstreamBlockedCached.response.entries,
    ]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 10)
    expect(entries.length).toBeGreaterThan(0)
    render(<Overview token="T" permissions={undefined} />)
    const panel = (await screen.findByRole('heading', { name: /Recently Blocked/ })).parentElement!.parentElement!
    const table = await within(panel).findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(entries.length)
    rows.forEach((row, i) => {
      expect(row).toHaveTextContent(entries[i].qname!)
      expect(row).toHaveTextContent(entries[i].clientIpAddress)
    })
  })
})
