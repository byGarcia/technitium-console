import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as settings from '../../api/settings'
import * as dashboard from '../../api/dashboard'
import * as quick from '../../lib/quick-lists'
import { BlockLists } from './BlockLists'

/*
Quick Add on the Lists tab with the console's own catalogue (`extra-lists.ts`) next
to Technitium's. The bundled file is replaced by a fixture, so these tests do not
move when its content does.
*/

const SB = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'
const ADS = 'https://lists.example.org/ads.txt'

vi.mock('./extra-lists.json', () => ({
  default: [
    { name: 'Example Ads', urls: ['https://lists.example.org/ads.txt'] },
    { name: 'A copy of Steven Black', urls: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'] },
    { name: 'Example Trackers', urls: ['https://trackers.example.net/list.txt'] },
  ],
}))

afterEach(() => vi.restoreAllMocks())

function serve(urls: string[]) {
  vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'n/a' })
  vi.spyOn(quick, 'loadQuickList').mockResolvedValue([{ name: 'Steven Black [adware + malware]', urls: [SB] }])
  vi.spyOn(settings, 'readSettings').mockResolvedValue({
    kind: 'ok',
    data: { blockListUrls: urls, blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: null } as never,
  })
  render(<BlockLists token="T" permissions={undefined} />)
}

async function openQuickAdd() {
  await screen.findByRole('table')
  await userEvent.click(screen.getByLabelText('Quick Add'))
  return screen.findByRole('listbox')
}

describe('Quick Add with the console catalogue', () => {
  it('offers Technitium entries first, then ours under More lists, without repeats', async () => {
    serve([])
    const list = await openQuickAdd()
    const all = within(list).getAllByRole('option').map((o) => o.textContent)
    expect(all).toEqual(['—', 'None', 'Steven Black [adware + malware]', 'Example Ads', 'Example Trackers'])
    const group = within(list).getByRole('group', { name: 'More lists' })
    expect(within(group).getAllByRole('option').map((o) => o.textContent)).toEqual(['Example Ads', 'Example Trackers'])
  })

  it('choosing one of ours adds its row, named, as one of theirs does', async () => {
    serve([SB])
    await openQuickAdd()
    await userEvent.click(screen.getByRole('option', { name: 'Example Ads' }))
    const table = screen.getByRole('table')
    const row = within(table).getByText(ADS).closest('tr')!
    expect(row).toHaveTextContent('Example Ads')
    expect(row).toHaveTextContent('Block')
    expect(screen.getByText('1 unsaved change to the block list URLs')).toBeInTheDocument()
  })

  it('a saved URL of ours is named in the table', async () => {
    serve([ADS])
    const table = await screen.findByRole('table')
    expect(within(table).getByText(ADS).closest('tr')).toHaveTextContent('Example Ads')
  })

  it('the search filters both catalogues, by name or host, and Enter picks', async () => {
    serve([])
    await openQuickAdd()
    const field = screen.getByRole('combobox', { name: 'Search lists' })
    expect(field).toHaveFocus()
    await userEvent.keyboard('trackers.example')
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Example Trackers'])
    await userEvent.keyboard('{Enter}')
    expect(within(screen.getByRole('table')).getByText('https://trackers.example.net/list.txt')).toBeInTheDocument()
  })

  it('a search with no match says No lists match', async () => {
    serve([])
    await openQuickAdd()
    await userEvent.keyboard('nothing like this')
    expect(screen.getByRole('status')).toHaveTextContent('No lists match')
  })
})
