import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as dashboard from '../../api/dashboard'
import * as settings from '../../api/settings'
import * as apps from '../../api/apps'
import * as zonelists from '../../api/zonelists'
import * as blocking from '../../api/blocking'
import { SAMPLE } from './blocked-sample'
import { SlotProvider } from '../../app/ChromeSlot'
import { Overview, blockingChart } from './Overview'

/** Your Rules: each number with the word over it, in the strip's cell. */
function rulePairs() {
  const facts = screen.getByLabelText('Your Rules')
  return [...facts.children].map((pair) => [pair.querySelector('dd')!.textContent, pair.querySelector('dt')!.textContent])
}

/* Every `data` the charts were handed, by chart: Chart.tsx rebuilds its canvas on a
   new reference, so identity across renders is what the tests look at. */
const drawn = vi.hoisted(() => new Map<string, unknown[]>())

const legends = vi.hoisted(() => new Map<string, unknown>())
/* What each chart was told to hide, and whether it was told not to draw its own legend. */
const hiddenOf = vi.hoisted(() => new Map<string, { hidden?: ReadonlySet<string>; separate?: boolean }>())

vi.mock('../dashboard/Chart', () => ({
  Chart: ({ aria, data, legendOrder, hidden, separateLegend }: {
    aria: string; data: unknown; legendOrder?: readonly string[]; hidden?: ReadonlySet<string>; separateLegend?: boolean
  }) => {
    const key = 'bars'
    drawn.set(key, [...(drawn.get(key) ?? []), data])
    legends.set(key, legendOrder)
    hiddenOf.set(key, { hidden, separate: separateLegend })
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
  /* Chart.js stacks in dataset order from the axis up: Blocked first puts it on the
     baseline, as drawn, where its own series reads off a common zero. */
  it('keeps only what got through and what was blocked, Blocked at the bottom of the stack', () => {
    expect(blockingChart(MAIN)).toEqual({
      labels: ['a', 'b'],
      datasets: [{ label: 'Blocked', data: [4, 6] }, { label: 'Allowed', data: [6, 24] }],
    })
  })
})

describe('Overview', () => {
  it('the bars read Allowed, then Blocked, in their legend', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByRole('img', { name: 'Allowed and blocked queries over time' })
    expect(legends.get('bars')).toEqual(['Allowed', 'Blocked'])
  })

  it('the bars carry the Dashboard legend: each series with its total, and a click switches it off', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByRole('img', { name: 'Allowed and blocked queries over time' })
    expect(hiddenOf.get('bars')?.separate).toBe(true)
    /* MAIN: Total 10 + 30, Blocked 4 + 6, so 30 got through. In BAR_LEGEND's order. */
    const allowed = screen.getByRole('button', { name: 'Allowed 30' })
    const blocked = screen.getByRole('button', { name: 'Blocked 10' })
    expect(allowed.compareDocumentPosition(blocked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(allowed).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(blocked)
    expect(blocked).toHaveAttribute('aria-pressed', 'false')
    expect([...(hiddenOf.get('bars')?.hidden ?? [])]).toEqual(['Blocked'])
  })

  it('draws the four figures, Blocked with its share', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByText('20,354')).toBeInTheDocument()
    expect(screen.getByText('5,310')).toBeInTheDocument()
    /* The ring writes the same share in its hole: the figure is looked for in its card. */
    expect(within(screen.getByText('5,310').parentElement!).getByText('26.09% of total')).toBeInTheDocument()
    expect(screen.getByText('74,779')).toBeInTheDocument()
    expect(rulePairs()).toEqual([['1', 'Blocked'], ['1', 'Allowed']])
  })

  /* The ring beside the chart said the strip's share a second time (2026-11-06). */
  it('draws the stacked bars, and the share only once, in the strip', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByRole('img', { name: 'Allowed and blocked queries over time' })).toBeInTheDocument()
    expect(screen.getAllByText(/26\.09%/)).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Blocked share' })).toBeNull()
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

  /* A panel without its view permission keeps its place and its title, with the padlock,
     so the screen does not change shape with who looks. */
  it('without Dashboard.canView the charts and both tops keep their place, locked', () => {
    serve()
    render(<Overview token="T" permissions={{ Dashboard: { canView: false, canModify: false, canDelete: false } }} />)
    for (const title of ['Statistics', 'Queries over time', 'Top Blocked Domains', 'Top Domains']) {
      /* The heading sits in the panel's header; the panel is the header's parent. */
      const panel = screen.getByRole('heading', { name: title }).parentElement!.parentElement!
      expect(within(panel).getByText('Requires Dashboard: View')).toBeInTheDocument()
    }
    expect(screen.queryByRole('table')).toBeNull()
  })

  /* Every figure is localised; 10,000 rules are not drawn `10000`. */
  it('Your Rules is localised like the other figures', async () => {
    serve().mockResolvedValue({ ...OK, data: { ...OK.data, stats: { ...STATS, blockedZones: 10000, allowedZones: 1234 } } })
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText((10000).toLocaleString())
    expect(rulePairs()).toEqual([[(10000).toLocaleString(), 'Blocked'], [(1234).toLocaleString(), 'Allowed']])
  })

  it('while the figures travel the top tables do not claim there are no domains', () => {
    serve().mockReturnValue(new Promise(() => {}))
    render(<Overview token="T" permissions={undefined} />)
    expect(screen.queryByText('No domains for this period.')).not.toBeInTheDocument()
    // Total Queries, Blocked, Block List Domains, and Your Rules' figure and two counts.
    expect(screen.getAllByText('—').length).toBe(6)
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
    const renders = drawn.get('bars')!.length
    // An empty Block raises a notice: the screen renders again, the stats do not change.
    await userEvent.click(screen.getByRole('button', { name: 'Block' }))
    expect(await screen.findByText('Please enter a domain name to block.')).toBeInTheDocument()
    expect(drawn.get('bars')!.length).toBeGreaterThan(renders)
    expect(drawn.get('bars')!.at(-1)).toBe(bars)
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
    expect(await screen.findByText('0% of total')).toBeInTheDocument()
    expect(screen.getAllByText('No queries for this period.').length).toBe(1)
    expect(screen.queryByRole('img', { name: 'Allowed and blocked queries over time' })).not.toBeInTheDocument()
  })
})

/* Last Hour in real time, as on the Dashboard: the same `stats/get`, the same live
   figures over it (dashboard/useLive.ts), the same minute reload. */
describe('Overview: Last Hour in real time', () => {
  const counters = (q: number, blocked: number) => ({
    kind: 'ok' as const,
    data: {
      uptimestamp: 'u1',
      lifetimeCounters: {
        totalQueries: q, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0, totalRefused: 0,
        totalAuthoritative: 0, totalRecursive: 0, totalCached: 0, totalBlocked: blocked, totalDropped: 0,
        totalClients: 1,
      },
    },
  })

  afterEach(() => vi.useRealTimers())

  it('Total Queries and Blocked move with the server between reloads', async () => {
    vi.useFakeTimers()
    serve()
    vi.spyOn(dashboard, 'getMetrics').mockResolvedValueOnce(counters(1000, 50)).mockResolvedValue(counters(1004, 52))
    render(<Overview token="T" permissions={undefined} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText((20354).toLocaleString())).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(screen.getByText((20358).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText((5312).toLocaleString())).toBeInTheDocument()
  })

  it('reloads a minute after each answer, waits while the tab is hidden, and reloads on return', async () => {
    vi.useFakeTimers()
    let hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    const spy = serve()
    vi.spyOn(dashboard, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not here' })
    render(<Overview token="T" permissions={undefined} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(spy).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(spy).toHaveBeenCalledTimes(2)

    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000) })
    expect(spy).toHaveBeenCalledTimes(2)

    hidden = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('other periods neither reload nor read the counters', async () => {
    vi.useFakeTimers()
    const spy = serve()
    const live = vi.spyOn(dashboard, 'getMetrics').mockResolvedValue(counters(1, 0))
    render(<Overview token="T" permissions={undefined} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { screen.getByRole('button', { name: 'Last Day' }).click() })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    spy.mockClear()
    live.mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(130_000) })
    expect(spy).not.toHaveBeenCalled()
    expect(live).not.toHaveBeenCalled()
  })
})

describe('the strip (2026-11-06)', () => {
  it('Your Rules counts every rule, then each list, and Blocked says its share', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    const rules = screen.getByRole('heading', { level: 2, name: 'Your Rules' }).parentElement!
    expect(rules.children[1].firstElementChild).toHaveTextContent('2')
    expect(screen.getAllByRole('img', { name: /^Blocked [\d,]+, Allowed [\d,]+$/ })).toHaveLength(2)
  })
})

describe('the layout of 2026-11-06', () => {
  const LOGGER = {
    name: 'Query Logs (Sqlite)', description: null, version: '1', dnsApps: [{
      classPath: 'QueryLogsSqlite.App', description: '', isAppRecordRequestHandler: false, recordDataTemplate: null,
      isRequestController: false, isAuthoritativeRequestHandler: false, isRequestBlockingHandler: false,
      isQueryLogger: true, isQueryLogs: true, isPostProcessor: false,
    }],
  }

  it('the blocking status and its menu sit in the header, before the period', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    const pill = await screen.findByText('Blocking is enabled')
    const header = screen.getByRole('heading', { level: 1, name: 'Overview' }).closest('div')!.parentElement!.parentElement!
    const menu = within(header).getByRole('button', { name: 'Blocking options' })
    const period = within(header).getByRole('group', { name: 'Period' })
    expect(header).toContainElement(pill)
    expect(menu).toHaveTextContent('Disable')
    expect(pill.compareDocumentPosition(period) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the check, block or allow bar comes before the figures', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    const bar = screen.getByRole('heading', { name: 'Check, block or allow a domain' })
    const strip = screen.getByRole('heading', { level: 2, name: 'Total Queries' })
    expect(bar.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByLabelText('Domain')).toBeInTheDocument()
  })

  it('without a query logging app there is no Blocked by client, and the reason is said once', async () => {
    serve()
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByText('No query logging app')).toBeInTheDocument()
    expect(screen.getAllByText(/Please install the 'Query Logs \(Sqlite\)' DNS App/)).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Blocked by client' })).toBeNull()
  })

  it('with a query logging app, Blocked by client sits beside the chart and counts the sample', async () => {
    serve()
    vi.mocked(apps.listApps).mockResolvedValue({ kind: 'ok', data: { response: { apps: [LOGGER] } } } as never)
    const sample = vi.spyOn(blocking, 'recentBlocked').mockResolvedValue({
      kind: 'ok',
      data: { partial: false, entries: [{
        rowNumber: 1, timestamp: '2026-11-06T10:00:00Z', clientIpAddress: '10.0.0.5', protocol: 'Udp',
        responseType: 'Blocked', rcode: 'NxDomain', qname: 'ads.example', qtype: 'A', qclass: 'IN', answer: null,
      }] },
    })
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByRole('img', { name: '10.0.0.5: 1 blocked' })).toBeInTheDocument()
    expect(screen.getByText('In the last blocked query')).toBeInTheDocument()
    const row = screen.getByRole('heading', { name: 'Queries over time' }).parentElement!.parentElement!.parentElement!
    expect(within(row).getByRole('heading', { name: 'Blocked by client' })).toBeInTheDocument()
    expect(sample).toHaveBeenCalledWith('T', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, 'cluster', SAMPLE)
  })

  it('without Logs.canView, Blocked by client keeps its place, locked, and no log is read', async () => {
    serve()
    const sample = vi.spyOn(blocking, 'recentBlocked')
    render(<Overview token="T" permissions={{ Logs: { canView: false, canModify: false, canDelete: false } }} />)
    await screen.findByText('20,354')
    const panel = screen.getByRole('heading', { name: 'Blocked by client' }).parentElement!.parentElement!
    expect(within(panel).getByText('Requires Logs: View')).toBeInTheDocument()
    expect(sample).not.toHaveBeenCalled()
  })
})

describe('the strip compares with the previous period', () => {
  const MIN = 60_000
  const LAST = Date.UTC(2026, 10, 6, 11, 0)
  /* A Last Hour answer whose minutes end at `last`: `total` queries a minute, `blocked` of them blocked. */
  function hour(last: number, total: number, blocked: number) {
    const instants = Array.from({ length: 60 }, (_, i) => new Date(last - (59 - i) * MIN).toISOString())
    return {
      ...OK.data,
      stats: { ...STATS, totalQueries: 60 * total, totalBlocked: 60 * blocked },
      mainChartData: {
        labelFormat: 'HH:mm', labels: instants, instants,
        /* Every counted series: the comparison sums them all, bucket by bucket. */
        datasets: ['Total', 'No Error', 'Server Failure', 'NX Domain', 'Refused', 'Authoritative', 'Recursive',
          'Cached', 'Blocked', 'Dropped', 'Clients'].map((label) => ({
          label,
          data: instants.map(() => (label === 'Total' ? total : label === 'Blocked' ? blocked : 0)),
        })),
      },
    }
  }

  it('Total Queries says what it is measured against, Blocked only its change', async () => {
    vi.spyOn(settings, 'getSettings').mockResolvedValue({ enableBlocking: true } as never)
    vi.spyOn(apps, 'listApps').mockResolvedValue({ kind: 'ok', data: { response: { apps: [] } } } as never)
    vi.spyOn(dashboard, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not here' })
    const spy = vi.spyOn(dashboard, 'getDashboardStats').mockImplementation(async (_t, type) =>
      ({ kind: 'ok', data: type === 'Custom' ? hour(LAST - 60 * MIN, 1, 1) : hour(LAST, 2, 1) }) as never)
    render(<Overview token="T" permissions={undefined} />)
    expect(await screen.findByText('+100.0% vs previous hour')).toBeInTheDocument()
    const total = screen.getByRole('heading', { level: 2, name: 'Total Queries' }).parentElement!
    expect(within(total).getByText('vs previous hour', { exact: false, selector: '[aria-hidden="true"]' })).toBeInTheDocument()
    const blocked = screen.getByRole('heading', { level: 2, name: 'Blocked' }).parentElement!
    expect(within(blocked).getByText('0.0% vs previous hour')).toBeInTheDocument()
    expect(within(blocked).queryByText(/vs previous hour/, { selector: '[aria-hidden="true"]' })).toBeNull()
    expect(spy.mock.calls.find((c) => c[1] === 'Custom')?.[3]).toBe('cluster')
  })

  it('without labels to measure from, no change is drawn and nothing more is asked', async () => {
    const spy = serve()
    render(<Overview token="T" permissions={undefined} />)
    await screen.findByText('20,354')
    expect(screen.queryByText(/vs previous/)).toBeNull()
    expect(spy.mock.calls.some((c) => c[1] === 'Custom')).toBe(false)
  })
})
