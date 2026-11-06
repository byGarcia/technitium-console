import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Logs } from './Logs'
import * as api from '../../api/logs'

/*
View Logs laid out as the folder and the open file (deviation 20): the cards over
the list, the table, the open file as the page with its own header, what its text
holds, and the open file in the address bar.
*/

const FILES = [
  { fileName: '2026-11-06', size: '24.44 KB' },
  { fileName: '2026-11-05', size: '73.31 KB' },
  { fileName: '2026-11-04', size: '2.39 MB' },
]

const TEXT =
  '[2026-11-06 07:05:59 UTC] Logging started.\n' +
  '[2026-11-06 07:06:04 UTC] DNS Server auth config file was saved.\n' +
  '[2026-11-06 07:12:30 UTC] [172.17.0.1:41749] [admin] User logged in.\n'

beforeEach(() => window.history.replaceState(null, '', '/logs/view-logs/'))
afterEach(() => vi.restoreAllMocks())

function table() {
  return within(screen.getByRole('table'))
}

describe('View Logs: the folder', () => {
  it('opens with four cards read from the list, and a table with one line per file', async () => {
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    render(<Logs token="t" sub="View Logs" />)
    await screen.findByRole('table')

    for (const title of ['Log Files', 'Total Size', 'Newest', 'Oldest']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('2026-11-04 to 2026-11-06')).toBeInTheDocument()
    expect(screen.getByText('2.49 MB')).toBeInTheDocument()
    expect(table().getAllByRole('row')).toHaveLength(4)
    expect(table().getByText('73.31 KB')).toBeInTheDocument()
    expect(screen.getByText('3 log files')).toBeInTheDocument()
  })

  it('an empty folder says 0 and 0 B, and no newest or oldest', async () => {
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: [] })
    render(<Logs token="t" sub="View Logs" />)
    expect(await screen.findByText('No Log File Was Found')).toBeInTheDocument()
    expect(screen.getByText('0 B')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Newest' })).toBeNull()
  })

  it('a list that failed draws no cards and says it could not be read', async () => {
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'error', message: 'Access was denied.' } as never)
    render(<Logs token="t" sub="View Logs" />)
    expect(await screen.findByText('Unable to load the log files.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Log Files' })).toBeNull()
  })

  it('the Newest card opens its file, as its row does', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    const read = vi.spyOn(api, 'downloadLogText').mockResolvedValue(TEXT)
    render(<Logs token="t" sub="View Logs" />)
    await screen.findByRole('table')

    const newest = screen.getByRole('heading', { name: 'Newest' }).closest('div')!.parentElement!
    await user.click(within(newest).getByRole('button', { name: '2026-11-06' }))
    expect(read).toHaveBeenCalledWith('t', '2026-11-06', '')
    expect(await screen.findByRole('heading', { level: 1, name: '2026-11-06' })).toBeInTheDocument()
  })

  it('Refresh reads the list again with the same call', async () => {
    const user = userEvent.setup()
    const list = vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    render(<Logs token="t" sub="View Logs" />)
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenLastCalledWith('t', '')
  })
})

describe('View Logs: the open file', () => {
  async function openIt(text = TEXT) {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    const read = vi.spyOn(api, 'downloadLogText').mockResolvedValue(text)
    render(<Logs token="t" sub="View Logs" />)
    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: '2026-11-06' }))
    await screen.findByLabelText('2026-11-06 log file')
    return { user, read }
  }

  it('is the page: its name as the title, the way back in the trail, Download and Delete', async () => {
    const { user } = await openIt()
    expect(screen.getByRole('heading', { level: 1, name: '2026-11-06' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete All Logs' })).toBeNull()

    await user.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'View Logs' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete All Logs' })).toBeInTheDocument()
  })

  it('says what the text holds: the listed size, the entries, the first and the last', async () => {
    await openIt()
    const facts = screen.getByText('Entries').closest('dl')!
    expect(facts).toHaveTextContent('Size24.44 KB')
    expect(facts).toHaveTextContent('Entries3')
    expect(facts).toHaveTextContent('First2026-11-06 07:05:59 UTC')
    expect(facts).toHaveTextContent('Last2026-11-06 07:12:30 UTC')
    expect(screen.queryByText(/Showing the first 2 MB/)).toBeNull()
  })

  it('says so when the server stopped at the 2 MB the viewer asks for', async () => {
    await openIt('x'.repeat(2 * 1024 * 1024))
    expect(screen.getByText(/Showing the first 2 MB\. Download gives the whole file\./)).toBeInTheDocument()
  })

  it('draws no band over an error the server sent as the text', async () => {
    await openIt('{\n  "status": "error",\n  "errorMessage": "Access was denied."\n}')
    expect(screen.queryByText('Entries')).toBeNull()
  })

  it('Refresh reads the same 2 MB again', async () => {
    const { user, read } = await openIt()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(read).toHaveBeenCalledTimes(2)
    expect(read).toHaveBeenLastCalledWith('t', '2026-11-06', '')
  })
})

describe('View Logs: the open file in the address bar', () => {
  it('is written when a file opens and taken out when it closes', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    vi.spyOn(api, 'downloadLogText').mockResolvedValue(TEXT)
    render(<Logs token="t" sub="View Logs" />)
    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: '2026-11-05' }))
    expect(window.location.search).toBe('?file=2026-11-05')

    await user.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'View Logs' }))
    expect(window.location.search).toBe('')
  })

  it('opens on arrival the file the bar names, once the list has it', async () => {
    window.history.replaceState(null, '', '/logs/view-logs/?file=2026-11-05')
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    const read = vi.spyOn(api, 'downloadLogText').mockResolvedValue(TEXT)
    render(<Logs token="t" sub="View Logs" />)
    expect(await screen.findByRole('heading', { level: 1, name: '2026-11-05' })).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith('t', '2026-11-05', '')
  })

  it('stays on the list, and clears the bar, when the file is not there', async () => {
    window.history.replaceState(null, '', '/logs/view-logs/?file=2020-01-01')
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    const read = vi.spyOn(api, 'downloadLogText')
    render(<Logs token="t" sub="View Logs" />)
    await screen.findByRole('table')
    expect(read).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('leaves with the screen', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listLogFiles').mockResolvedValue({ kind: 'ok', data: FILES })
    vi.spyOn(api, 'downloadLogText').mockResolvedValue(TEXT)
    const { unmount } = render(<Logs token="t" sub="View Logs" />)
    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: '2026-11-05' }))
    expect(window.location.search).toBe('?file=2026-11-05')
    unmount()
    expect(window.location.search).toBe('')
  })
})
