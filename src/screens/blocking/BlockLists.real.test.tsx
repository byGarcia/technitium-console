import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { REAL, realServer } from '../../test/real-blocking'
import { nextUpdateText } from '../settings/panes/Blocking'
import { BlockLists } from './BlockLists'

/*
The Lists tab fed with the harness's real `settings/get` and `dashboard/stats/get`
(`test/real-blocking.ts`) and the real built-in Quick Add catalog. The harness's
`blockListUrls` carries every row kind of the grammar at once (a comment, a URL in
the catalog, an enabled `file://` list, a `#`-disabled one and a `!` allow list), so
each is checked as the server sent it.
*/

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(realServer())
})

afterEach(() => vi.restoreAllMocks())

const URLS = REAL.settings.response.blockListUrls
const STATS = REAL.statsLastHour.response.stats

/** The table row whose List cell shows `url`. */
function row(table: HTMLElement, url: string) {
  return within(table).getByText(url).closest('tr')!
}

describe('Lists against the harness', () => {
  it('draws one row per line the server keeps, each with its kind', async () => {
    render(<BlockLists token="T" permissions={undefined} />)
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(URLS.length)

    const hosts = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'
    expect(URLS).toContain(hosts)
    const named = row(table, hosts)
    expect(named).toHaveTextContent('Steven Black [adware + malware]')
    expect(within(named).getByRole('checkbox')).toBeChecked()

    expect(URLS).toContain('#file:///etc/dns/t15-lists/list-b.txt')
    const off = row(table, 'file:///etc/dns/t15-lists/list-b.txt')
    expect(within(off).getByRole('checkbox')).not.toBeChecked()
    expect(off).toHaveTextContent('Block')

    expect(URLS).toContain('!file:///etc/dns/t15-lists/allow.txt')
    const allow = row(table, 'file:///etc/dns/t15-lists/allow.txt')
    expect(allow).toHaveTextContent('Allow')
    expect(within(allow).getByRole('checkbox')).toBeChecked()

    const comment = row(table, '# T15 harness lists')
    expect(comment).toHaveTextContent('Comment')
    expect(within(comment).queryByRole('checkbox')).toBeNull()

    expect(screen.getByText('4 lists · 1 disabled · 1 comment')).toBeInTheDocument()
  })

  it('the figures and the next update are the server ones', async () => {
    render(<BlockLists token="T" permissions={undefined} />)
    await screen.findByRole('table')
    expect(await screen.findByText(STATS.blockListZones.toLocaleString())).toBeInTheDocument()
    expect(screen.getByText(STATS.allowListZones.toLocaleString())).toBeInTheDocument()
    expect(screen.getByText(nextUpdateText(REAL.settings.response.blockListNextUpdatedOn))).toBeInTheDocument()
    expect(screen.getByText(`Next update · every ${REAL.settings.response.blockListUpdateIntervalHours} h`))
      .toBeInTheDocument()
  })

  it('nothing is pending after reading: the rows are the saved lines', async () => {
    render(<BlockLists token="T" permissions={undefined} />)
    await screen.findByRole('table')
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })
})
