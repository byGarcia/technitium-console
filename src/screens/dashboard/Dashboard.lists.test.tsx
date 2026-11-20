/*
Which list blocks each of Top Blocked Domains' names (deviation 46, extended on
2026-11-20): asked only when Show lists is pressed, with Count lists' gate and
lookups (`list-hits.ts`), at most the five names on screen, and drawn beside each
name as the panel draws a client's domain.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'
import * as appsApi from '../../api/apps'
import * as dns from '../../api/dnsclient'
import * as settingsApi from '../../api/settings'
import type { DashboardStats } from '../../api/dashboard'
import { clearReportCache } from '../blocking/list-hits'
import styles from './Dashboard.module.css'

const emptyChart = { labels: ['a'], datasets: [{ label: 'Total', data: [0] }] }
const BLOCKED = ['ads.test', 'rule.test', 'clean.test', 'broken.test', 'app.test', 'sixth.test']
const DATA: DashboardStats = {
  stats: {
    totalQueries: 0, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0,
    totalRefused: 0, totalAuthoritative: 0, totalRecursive: 0, totalCached: 0,
    totalBlocked: 0, totalDropped: 0, totalClients: 0,
    zones: 0, cachedEntries: 0, allowedZones: 0, blockedZones: 0,
    allowListZones: 0, blockListZones: 0,
  },
  mainChartData: emptyChart,
  queryResponseChartData: emptyChart,
  queryTypeChartData: emptyChart,
  protocolTypeChartData: emptyChart,
  topClients: [],
  topDomains: [],
  topBlockedDomains: BLOCKED.map((name, i) => ({ name, hits: 60 - i })),
}

const OPEN = { enableBlocking: true, allowTxtBlockingReport: true, blockingBypassList: [] as string[] }

const txt = (text: string) => ({
  kind: 'ok',
  data: { response: { result: { RecursionAvailable: false, Question: [{ Name: 'x' }], Answer: [{ Type: 'TXT', RDATA: { Text: text } }] } } },
})

function serveLookups() {
  return vi.spyOn(dns, 'resolve').mockImplementation(async (_t, p) => {
    switch (p.domain) {
      case 'ads.test':
        return txt('source=block-list-zone; blockListUrl=file:///etc/dns/lists/list-a.txt; domain=ads.test') as never
      case 'rule.test':
        return txt('source=blocked-zone; domain=rule.test') as never
      case 'app.test':
        return txt('source=advanced-blocking-app; group=kids; domain=app.test') as never
      case 'broken.test':
        return { kind: 'error', message: 'timed out' } as never
      default:
        return { kind: 'ok', data: { response: { result: { RecursionAvailable: false, Question: [{ Name: p.domain }], Answer: [] } } } } as never
    }
  })
}

function settings(data: Record<string, unknown> = OPEN) {
  return vi.spyOn(settingsApi, 'readSettings').mockResolvedValue({ kind: 'ok', data: data as never })
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not stubbed' })
  vi.spyOn(appsApi, 'listApps').mockResolvedValue({ kind: 'ok', data: { response: { apps: [] } } } as never)
})

afterEach(() => {
  clearReportCache()
  vi.restoreAllMocks()
})

function panel() {
  return screen.getByRole('heading', { name: 'Top Blocked Domains' }).parentElement!.parentElement!
}

/* What each of the panel's rows draws after its name. */
function details() {
  return [...panel().querySelectorAll(`.${styles.toprow}`)].map((row) => row.querySelector(`.${styles.topDomain}`)?.textContent ?? null)
}

async function draw(props: Partial<Parameters<typeof Dashboard>[0]> = {}, data = DATA) {
  const stats = vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data })
  render(<Dashboard token="t" {...props} />)
  await screen.findByRole('button', { name: 'Actions for ads.test' })
  return { stats }
}

describe('Top Blocked Domains: which list, when asked', () => {
  it('reads nothing until Show lists is pressed, and draws the rows as before', async () => {
    const read = settings()
    const resolve = serveLookups()
    await draw()
    expect(within(panel()).getByRole('button', { name: 'Show lists' })).toBeEnabled()
    expect(details()).toEqual([null, null, null, null, null])
    expect(read).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('says before the press, beside the button, that its lookups are logged as blocked, as Count lists does', async () => {
    settings()
    serveLookups()
    await draw()
    const button = within(panel()).getByRole('button', { name: 'Show lists' })
    const foot = button.closest(`.${styles.listsFoot}`) as HTMLElement
    expect(foot).not.toBeNull()
    expect(within(foot).getByText(
      'One click asks this server about the names shown and sends at most 5 lookups. Each lookup is logged as blocked from this server.',
    )).toBeInTheDocument()
  })

  it('one press checks the settings, looks up the five names on screen and names what blocks each', async () => {
    const read = settings()
    const resolve = serveLookups()
    await draw()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Show lists' }))

    await waitFor(() => expect(details()).toEqual([
      'list-a.txt', 'Your rule', 'No list reported', 'Lookup failed', 'Advanced Blocking · kids',
    ]))
    expect(read).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledWith('t', '')
    expect(resolve.mock.calls.map((c) => c[1].domain).sort()).toEqual(BLOCKED.slice(0, 5).sort())
    for (const c of resolve.mock.calls) {
      expect(c[1]).toMatchObject({ server: 'this-server', type: 'TXT', protocol: 'UDP', node: '' })
    }
    expect(within(panel()).getByText(/Each lookup is logged as blocked from this server\./)).toBeInTheDocument()
    /* The whole name is on hover, with what blocks it. */
    expect(panel().querySelector(`.${styles.n}`)).toHaveAttribute('title', 'ads.test list-a.txt')
  })

  it('a second press, or a refresh of the figures, reuses what was read', async () => {
    settings()
    const resolve = serveLookups()
    const { stats } = await draw()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Show lists' }))
    await waitFor(() => expect(details()[0]).toBe('list-a.txt'))
    const sent = resolve.mock.calls.length

    await userEvent.click(within(panel()).getByRole('button', { name: 'Show lists' }))
    /* The failed lookup is remembered a minute, so the press asks for nothing. */
    expect(resolve.mock.calls.length).toBe(sent)

    stats.mockResolvedValue({ kind: 'ok', data: { ...DATA, topBlockedDomains: [{ name: 'ads.test', hits: 99 }, { name: 'new.test', hits: 1 }] } })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(details()).toEqual(['list-a.txt', null]))
    expect(resolve.mock.calls.length).toBe(sent)
  })

  it.each([
    ['the report is off', { ...OPEN, allowTxtBlockingReport: false }, /Allow TXT Blocking Report is off/],
    ['blocking is disabled', { ...OPEN, enableBlocking: false }, /Blocking is disabled, so nothing was looked up\./],
    ['the server bypasses itself', { ...OPEN, blockingBypassList: ['127.0.0.1'] }, /127\.0\.0\.1, is on the Blocking Bypass List/],
  ])('when %s it looks nothing up and says why', async (_what, data, said) => {
    settings(data)
    const resolve = serveLookups()
    await draw()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Show lists' }))
    expect(await within(panel()).findByText(said)).toBeInTheDocument()
    expect(within(panel()).getByRole('link', { name: 'Blocking › Settings' })).toBeInTheDocument()
    expect(resolve).not.toHaveBeenCalled()
    expect(details()).toEqual([null, null, null, null, null])
  })

  it('without DNS Client: View the button is locked; without Settings: View it says the settings were not checked', async () => {
    settings()
    const resolve = serveLookups()
    await draw({ permissions: { DnsClient: { canView: false, canModify: false, canDelete: false } } })
    expect(within(panel()).getByRole('button', { name: /Show lists/ })).toBeDisabled()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('without Settings: View it looks nothing up and names the permission', async () => {
    const read = settings()
    const resolve = serveLookups()
    await draw({ permissions: { Settings: { canView: false, canModify: false, canDelete: false } } })
    await userEvent.click(within(panel()).getByRole('button', { name: 'Show lists' }))
    expect(await within(panel()).findByText(/The blocking settings were not checked\. Requires Settings: View/)).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
  })
})
