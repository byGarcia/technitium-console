import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'
import type { DashboardStats } from '../../api/dashboard'
import styles from './Dashboard.module.css'

const emptyChart = { labels: ['a'], datasets: [{ label: 'Total', data: [0] }] }
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
  topClients: [{ name: '10.0.0.1', domain: 'pc.home.test', hits: 100, rateLimited: true }],
  topDomains: [60, 120, 30, 0, 12, 9999].map((hits, i) => ({ name: `domain${i}.test`, hits })),
  topBlockedDomains: [{ name: 'ads.test', hits: 0 }],
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, 'getMetrics').mockResolvedValue({ kind: 'error', message: 'not stubbed' })
})

afterEach(() => vi.restoreAllMocks())

async function draw(data = DATA) {
  vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data })
  render(<Dashboard token="t" />)
  await screen.findByRole('button', { name: 'Actions for domain0.test' })
}

function panel(title: string) {
  return screen.getByRole('heading', { name: title }).parentElement!.parentElement!
}

describe('Dashboard Top five presentation', () => {
  it('numbers the five displayed entries in the server order and retains their counts and actions', async () => {
    await draw()
    const top = panel('Top Domains')
    const rows = [...top.querySelectorAll(`.${styles.toprow}`)]
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.querySelector(`.${styles.topRank}`)?.textContent)).toEqual(['1', '2', '3', '4', '5'])
    expect(rows.map((row) => row.querySelector(`.${styles.topLabel}`)?.textContent)).toEqual([
      'domain0.test', 'domain1.test', 'domain2.test', 'domain3.test', 'domain4.test',
    ])
    expect(rows.map((row) => row.querySelector(`.${styles.c}`)?.textContent)).toEqual(['60', '120', '30', '0', '12'])
    for (let i = 0; i < 5; i++) {
      expect(within(top).getByRole('button', { name: `Actions for domain${i}.test` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Actions for domain5.test' })).not.toBeInTheDocument()
  })

  it('scales decorative bars to the largest displayed count, without counting an undisplayed entry', async () => {
    await draw()
    const bars = [...panel('Top Domains').querySelectorAll<HTMLElement>(`.${styles.topBar}`)]
    expect(bars.map((bar) => bar.style.width)).toEqual(['50%', '100%', '25%', '0%', '10%'])
    for (const bar of bars) expect(bar).toHaveAttribute('aria-hidden', 'true')
  })

  it('preserves client details and draws a true zero with an empty bar', async () => {
    await draw()
    const clients = panel('Top Clients')
    expect(within(clients).getByText('10.0.0.1 (rate limited)')).toBeInTheDocument()
    expect(within(clients).getByText('pc.home.test')).toBeInTheDocument()
    expect(clients.querySelector(`.${styles.topRank}`)).toHaveTextContent('1')
    const blocked = panel('Top Blocked Domains')
    expect(within(blocked).getByText('0')).toBeInTheDocument()
    expect(blocked.querySelector<HTMLElement>(`.${styles.topBar}`)?.style.width).toBe('0%')
    expect(within(blocked).getByRole('button', { name: 'Actions for ads.test' })).toBeInTheDocument()
  })
})
