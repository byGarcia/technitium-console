import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as dashboard from '../../api/dashboard'
import * as settings from '../../api/settings'
import * as apps from '../../api/apps'
import * as zonelists from '../../api/zonelists'
import { SlotProvider } from '../../app/ChromeSlot'
import { Overview, blockingChart } from './Overview'

/* Every `data` the charts were handed, by chart: Chart.tsx rebuilds its canvas on a
   new reference, so identity across renders is what the tests look at. */
const drawn = vi.hoisted(() => new Map<string, unknown[]>())

vi.mock('../dashboard/Chart', () => ({
  Chart: ({ aria, data }: { aria: string; data: unknown }) => {
    const key = aria.startsWith('Blocked share') ? 'ring' : 'bars'
    drawn.set(key, [...(drawn.get(key) ?? []), data])
    return <div role="img" aria-label={aria} />
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  drawn.clear()
})

const STATS = {
  totalQueries: 20354, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
  totalAuthoritative: 0, totalRecursive: 0, totalCached: 0, totalBlocked: 5310, totalDropped: 0,
  totalClients: 11, zones: 5, cachedEntries: 0, allowedZones: 1, blockedZones: 1, allowListZones: 0, blockListZones: 74779,
}
const MAIN = { labels: ['a', 'b'], datasets: [
  { label: 'Total', data: [10, 30] }, { label: 'No Error', data: [5, 5] }, { label: 'Blocked', data: [4, 6] },
] }
const OK = {
  kind: 'ok' as const,
  data: {
    stats: STATS, mainChartData: MAIN, queryResponseChartData: MAIN, queryTypeChartData: MAIN,
    protocolTypeChartData: MAIN, topClients: [], topDomains: [], topBlockedDomains: [],
  },
}

function serve() {
  vi.spyOn(settings, 'getSettings').mockResolvedValue({ enableBlocking: true } as never)
  vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { response: { apps: [] } } } as never)
  return vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue(OK)
}

describe('blockingChart', () => {
  it('keeps only what got through and what was blocked, stacked', () => {
    expect(blockingChart(MAIN)).toEqual({
      labels: ['a', 'b'],
      datasets: [{ label: 'Allowed', data: [6, 24] }, { label: 'Blocked', data: [4, 6] }],
    })
  })
})

describe('Overview', () => {
  it('draws the four figures, Blocked with its share', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByText('20,354')).toBeInTheDocument()
    expect(screen.getByText('5,310')).toBeInTheDocument()
    /* The ring writes the same share in its hole: the figure is looked for in its card. */
    expect(within(screen.getByText('5,310').parentElement!).getByText('26.09%')).toBeInTheDocument()
    expect(screen.getByText('74,779')).toBeInTheDocument()
    expect(screen.getByText('1 · 1')).toBeInTheDocument()
  })

  it('draws the stacked bars and the blocked share', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByRole('img', { name: 'Allowed and blocked queries over time' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Blocked share: 26.09%' })).toBeInTheDocument()
  })

  it('the period asks the server again', async () => {
    const spy = serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    expect(spy).toHaveBeenLastCalledWith('T', 'LastDay', undefined, 'cluster')
  })

  it('offers the five fixed periods and not Custom', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    const group = screen.getByRole('group', { name: 'Period' })
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Last Hour', 'Last Day', 'Last Week', 'Last Month', 'Last Year',
    ])
  })

  it('reads the node the Dashboard remembers', async () => {
    localStorage.setItem('dashboardClusterNode', 'dns2.example')
    const spy = serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    expect(spy).toHaveBeenCalledWith('T', 'LastHour', undefined, 'dns2.example')
  })

  it('with the cluster aggregate, Recently Blocked names the node it reads', async () => {
    serve()
    render(
      <Overview
        token="T"
        permissions={undefined}
        nodes={[{ name: 'dns1.example', type: 'Primary' }]}
        clusterInitialised
        serverDomain="dns1.example"
      />,
    )
    await screen.findByText('20,354')
    expect(screen.getByRole('heading', { name: 'Recently Blocked on dns1.example' })).toBeInTheDocument()
  })

  it('without a cluster, Recently Blocked names no node', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} serverDomain="dns1.example" />)
    await screen.findByText('20,354')
    expect(screen.getByRole('heading', { name: 'Recently Blocked' })).toBeInTheDocument()
  })

  it('without Dashboard.canView the figures are locked and nothing is asked', () => {
    const spy = serve()
    render(<Overview token="T" permissions={{ Dashboard: { canView: false, canModify: false, canDelete: false } }} />)
    expect(screen.getAllByText('Requires Dashboard: View').length).toBeGreaterThan(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('while the figures travel the top tables do not claim there are no domains', () => {
    serve().mockReturnValue(new Promise(() => {}))
    render(<Overview token="T" permissions={undefined} />)
    expect(screen.queryByText('No domains for this period.')).not.toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBe(4)
  })

  it('a first read that fails says so with the message from the server', async () => {
    serve().mockResolvedValue({ kind: 'error', message: 'The server is busy.' })
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument()
    expect(screen.getAllByText('Could not load this data.').length).toBeGreaterThan(0)
    expect(screen.queryByText('No domains for this period.')).not.toBeInTheDocument()
    expect(screen.queryByText('Could not refresh.')).not.toBeInTheDocument()
  })

  it('a refresh that fails keeps the figures and says they are stale', async () => {
    const spy = serve()
    vi.spyOn(zonelists, 'addDomain').mockResolvedValue({ kind: 'ok', data: {} })
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    spy.mockResolvedValue({ kind: 'error', message: 'The server is busy.' })
    await userEvent.type(screen.getByLabelText('Domain'), 'ads.example.com{Enter}')
    expect(await screen.findByText('Could not refresh.')).toBeInTheDocument()
    expect(screen.getByText('20,354')).toBeInTheDocument()
    spy.mockResolvedValue(OK)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('20,354')).toBeInTheDocument()
    expect(screen.queryByText('Could not refresh.')).not.toBeInTheDocument()
  })

  it('a new period that fails does not keep the figures of the previous one', async () => {
    const spy = serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    spy.mockResolvedValue({ kind: 'error', message: 'The server is busy.' })
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument()
    expect(screen.queryByText('20,354')).not.toBeInTheDocument()
    expect(screen.queryByText('Could not refresh.')).not.toBeInTheDocument()
  })

  it('a render for another reason does not hand the charts new data', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    const bars = drawn.get('bars')!.at(-1)
    const ring = drawn.get('ring')!.at(-1)
    const renders = drawn.get('bars')!.length
    // An empty Block raises a notice: the screen renders again, the stats do not change.
    await userEvent.click(screen.getByRole('button', { name: 'Block' }))
    expect(await screen.findByText('Please enter a domain name to block.')).toBeInTheDocument()
    expect(drawn.get('bars')!.length).toBeGreaterThan(renders)
    expect(drawn.get('bars')!.at(-1)).toBe(bars)
    expect(drawn.get('ring')!.at(-1)).toBe(ring)
  })

  it('choosing a node asks that node and remembers it for the Dashboard', async () => {
    const spy = serve()
    render(
      <SlotProvider>
        {(slot) => (
          <>
            <div ref={slot} />
            <Overview
              token="T"
              permissions={undefined}
              nodes={[{ name: 'dns1.example', type: 'Primary' }, { name: 'dns2.example', type: 'Secondary' }]}
              clusterInitialised
            />
          </>
        )}
      </SlotProvider>,
    )
    await screen.findByText('20,354')
    await userEvent.click(screen.getByRole('combobox', { name: 'Node' }))
    await userEvent.click(screen.getByRole('option', { name: 'dns2.example (secondary)' }))
    expect(localStorage.getItem('dashboardClusterNode')).toBe('dns2.example')
    expect(spy).toHaveBeenLastCalledWith('T', 'LastHour', undefined, 'dns2.example')
  })

  it('a slow answer to an earlier period does not overwrite a later one', async () => {
    const spy = serve()
    let answerFirst: (v: typeof OK) => void = () => {}
    spy.mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve }))
    spy.mockResolvedValueOnce({ kind: 'ok', data: { ...OK.data, stats: { ...STATS, totalQueries: 99999 } } })
    render(<Overview token="T" permissions={undefined} />)
    await userEvent.click(screen.getByRole('button', { name: 'Last Day' }))
    expect(await screen.findByText('99,999')).toBeInTheDocument()
    await act(async () => answerFirst(OK))
    expect(screen.getByText('99,999')).toBeInTheDocument()
    expect(screen.queryByText('20,354')).not.toBeInTheDocument()
  })

  it('a period with no queries draws zero and no empty chart', async () => {
    const zero = { ...STATS, totalQueries: 0, totalBlocked: 0 }
    const flat = { labels: ['a'], datasets: [{ label: 'Total', data: [0] }, { label: 'Blocked', data: [0] }] }
    serve().mockResolvedValue({ kind: 'ok', data: { ...OK.data, stats: zero, mainChartData: flat } })
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByText('0%')).toBeInTheDocument()
    expect(screen.getAllByText('No queries for this period.').length).toBe(2)
    expect(screen.queryByRole('img', { name: 'Allowed and blocked queries over time' })).not.toBeInTheDocument()
  })
})
