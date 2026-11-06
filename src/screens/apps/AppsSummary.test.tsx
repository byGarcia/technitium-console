import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Apps } from './Apps'
import { NO_STORE_WHY } from './app-kinds'
import * as api from '../../api/apps'
import type { DnsAppDetail, InstalledApp } from '../../api/apps'

/*
The four cards over the installed list and the Kind filter they drive (deviation
17 in CONVENTIONS.md). Everything here is read from the one `apps/list` the screen
already makes.
*/

afterEach(() => vi.restoreAllMocks())

function cls(classPath: string, flags: Partial<DnsAppDetail> = {}): DnsAppDetail {
  return {
    classPath,
    description: `${classPath} description`,
    recordDataTemplate: null,
    isAppRecordRequestHandler: false,
    isRequestController: false,
    isAuthoritativeRequestHandler: false,
    isRequestBlockingHandler: false,
    isQueryLogger: false,
    isQueryLogs: false,
    isPostProcessor: false,
    ...flags,
  }
}

const BLOCKING: InstalledApp = {
  name: 'Advanced Blocking',
  description: 'Blocks.',
  version: '11.2.1',
  updateVersion: '11.2.1',
  updateUrl: 'https://x/ab.zip',
  updateAvailable: false,
  dnsApps: [cls('AdvancedBlocking.App', { isRequestBlockingHandler: true })],
}

const NO_DATA: InstalledApp = {
  name: 'NO DATA',
  description: 'No data.',
  version: '5.0',
  updateVersion: '6.0',
  updateUrl: 'https://x/nd.zip',
  updateAvailable: true,
  dnsApps: [cls('NoData.App', { isAppRecordRequestHandler: true })],
}

const LOGS: InstalledApp = {
  name: 'Query Logs (Sqlite)',
  description: 'Logs.',
  version: '9.1.2',
  updateVersion: '9.1.2',
  updateUrl: 'https://x/ql.zip',
  updateAvailable: false,
  dnsApps: [cls('QueryLogsSqlite.App', { isQueryLogger: true, isQueryLogs: true })],
}

/* Installed from a file: the server writes none of the three update fields. */
const FROM_FILE: InstalledApp = {
  name: 'Split Horizon',
  description: 'Split.',
  version: '11.0',
  dnsApps: [
    cls('SplitHorizon.AddressTranslation', { isAuthoritativeRequestHandler: true, isPostProcessor: true }),
    cls('SplitHorizon.SimpleAddress', { isAppRecordRequestHandler: true }),
    cls('SplitHorizon.SimpleCNAME', { isAppRecordRequestHandler: true }),
    cls('SplitHorizon.Other', { isAppRecordRequestHandler: true }),
    cls('SplitHorizon.More', { isAppRecordRequestHandler: true }),
  ],
}

function withApps(apps: InstalledApp[]) {
  return vi
    .spyOn(api, 'listApps')
    .mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps } } } as never)
}

function cardOf(title: string) {
  // The card's panel: its title's header's parent.
  const heading = screen.getByRole('heading', { name: title, level: 2 })
  return within(heading.parentElement!.parentElement!)
}

function rowNames() {
  return screen
    .getAllByRole('row')
    .map((r) => r.getAttribute('aria-label'))
    .filter((n): n is string => n != null)
}

describe('Apps: the cards', () => {
  it('Installed Apps counts the apps and how they stand against the store', async () => {
    withApps([BLOCKING, NO_DATA, LOGS, FROM_FILE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'NO DATA' })

    const card = cardOf('Installed Apps')
    expect(card.getByRole('img', { name: 'Up to date 2, Update available 1, No store version 1' })).toBeInTheDocument()
    expect(card.getByText('Up to date')).toBeInTheDocument()
    expect(card.getByText('Update available')).toBeInTheDocument()
    expect(card.getByText('No store version')).toBeInTheDocument()
  })

  it('a zero is drawn as 0, not left out', async () => {
    withApps([BLOCKING])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })

    const card = cardOf('Installed Apps')
    const update = card.getByText('Update available').closest('div')!
    expect(within(update).getByText('0')).toBeInTheDocument()
    expect(cardOf('APP Records').getByText('0')).toBeInTheDocument()
    expect(cardOf('Query Logs').getByText('None installed')).toBeInTheDocument()
  })

  it('No store version explains itself on focus', async () => {
    withApps([FROM_FILE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Split Horizon' })

    const fact = cardOf('Installed Apps').getByText('No store version').closest('[tabindex]') as HTMLElement
    fact.focus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(NO_STORE_WHY)
  })

  it('Classes counts the classes by kind, as upstream labels them', async () => {
    withApps([BLOCKING, NO_DATA, LOGS, FROM_FILE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'NO DATA' })

    const kinds = within(screen.getByRole('group', { name: 'Classes by kind' }))
    expect(kinds.getByRole('button', { name: /^APP Record\s*5$/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^Blocking\s*1$/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^Query Logger\s*1$/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^Query Logs\s*1$/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^Authoritative\s*1$/ })).toBeInTheDocument()
    expect(kinds.getByRole('button', { name: /^Post Processor\s*1$/ })).toBeInTheDocument()
    expect(kinds.queryByRole('button', { name: /Generic/ })).not.toBeInTheDocument()
  })

  it('Query Logs names the apps that serve it', async () => {
    withApps([BLOCKING, LOGS])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })

    const list = within(screen.getByRole('list', { name: 'Apps that serve Query Logs' }))
    expect(list.getByText('Query Logs (Sqlite)')).toBeInTheDocument()
    expect(list.queryByText('Advanced Blocking')).not.toBeInTheDocument()
  })

  it('APP Records lists four classes by name and counts the rest', async () => {
    withApps([NO_DATA, FROM_FILE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'NO DATA' })

    const list = within(screen.getByRole('list', { name: 'APP record classes' }))
    expect(list.getByText('NoData.App')).toBeInTheDocument()
    expect(list.getByText('SplitHorizon.Other')).toBeInTheDocument()
    expect(list.queryByText('SplitHorizon.More')).not.toBeInTheDocument()
    expect(list.getByText('1 more')).toBeInTheDocument()
  })

  it('no cards when the list could not be read: a count of no answer would be invented', async () => {
    vi.spyOn(api, 'listApps').mockResolvedValue({ kind: 'error', message: 'Boom' })
    render(<Apps token="t" />)
    await screen.findByText(/Could not load the installed apps/)

    expect(screen.queryByRole('heading', { name: 'Installed Apps' })).not.toBeInTheDocument()
  })
})

describe('Apps: the Kind filter', () => {
  it('pressing a kind sets the Kind filter and narrows the table; pressing it again clears it', async () => {
    const spy = withApps([BLOCKING, NO_DATA, LOGS, FROM_FILE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'NO DATA' })

    const chip = screen.getByRole('button', { name: /^APP Record\s*5$/ })
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(rowNames()).toEqual(['NO DATA', 'Split Horizon'])
    // The toolbar says which kind is applied, and the foot still counts every app.
    expect(screen.getByRole('button', { name: /APP Record\s*Clear/ })).toBeInTheDocument()
    expect(screen.getByText('Total Apps: 4, 2 shown')).toBeInTheDocument()

    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(rowNames()).toHaveLength(4)
    // It narrows what is drawn and asks the server nothing.
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('each row writes the kinds of its classes once each, in upstream order', async () => {
    withApps([FROM_FILE])
    render(<Apps token="t" />)
    const row = within(await screen.findByRole('row', { name: 'Split Horizon' }))

    // The Kind column, the row's second cell.
    const cell = row.getAllByRole('cell')[1]
    expect([...cell.firstElementChild!.children].map((c) => c.textContent)).toEqual([
      'APP Record',
      'Authoritative',
      'Post Processor',
    ])
  })
})
