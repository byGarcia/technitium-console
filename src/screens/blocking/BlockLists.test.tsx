import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as settings from '../../api/settings'
import * as dashboard from '../../api/dashboard'
import * as quick from '../../lib/quick-lists'
import { chooseIn } from '../../test/dropdown'
import { BlockLists } from './BlockLists'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const HOSTS = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'

function serve(urls: string[] | null) {
  vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'n/a' })
  vi.spyOn(quick, 'loadQuickList').mockResolvedValue([{ name: 'Steven Black [adware + malware]', urls: [HOSTS] }])
  return vi.spyOn(settings, 'getSettings').mockResolvedValue({
    blockListUrls: urls, blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: null,
  } as never)
}

function draw(clusterInitialised = false) {
  render(<BlockLists token="T" permissions={undefined} clusterInitialised={clusterInitialised} />)
}

describe('BlockLists', () => {
  it('draws one row per line, with its readable name and kind', async () => {
    serve([HOSTS, '#!https://a.test/x', '# my lists'])
    draw()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Steven Black [adware + malware]')).toBeInTheDocument()
    expect(within(table).getByText('Allow')).toBeInTheDocument()
    expect(within(table).getByText('Comment')).toBeInTheDocument()
  })

  it('a comment and an enabled line that is not a list URL get no switch', async () => {
    serve([HOSTS, 'not-a-url', '# my lists'])
    draw()
    await screen.findByRole('table')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: `Enabled block list ${HOSTS}` })).toBeChecked()
  })

  it('nothing is saved until Save, and Save sends only blockListUrls on the cluster', async () => {
    serve([HOSTS])
    const save = vi.spyOn(settings, 'setSettings').mockResolvedValue({
      kind: 'ok', data: { server: 'x', response: { blockListUrls: [`#${HOSTS}`] } as never },
    })
    draw(true)
    await userEvent.click(await screen.findByRole('checkbox', { name: /Enabled/ }))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText('1 unsaved change to the block list URLs')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save).toHaveBeenCalledWith('T', { node: 'cluster', blockListUrls: `#${HOSTS}` })
    expect(await screen.findByText('DNS Server settings were saved successfully.')).toBeInTheDocument()
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument()
  })

  it('counts every line that changed, not just whether something did', async () => {
    serve([HOSTS])
    draw()
    await userEvent.click(await screen.findByRole('checkbox', { name: /Enabled/ }))
    await userEvent.type(screen.getByLabelText('List URL'), 'https://a.test/block.txt')
    await userEvent.click(screen.getByRole('button', { name: 'Add block list' }))
    expect(screen.getByText('2 unsaved changes to the block list URLs')).toBeInTheDocument()
    // Switching the first one back leaves only the addition.
    await userEvent.click(screen.getByRole('checkbox', { name: `Enabled block list ${HOSTS}` }))
    expect(screen.getByText('1 unsaved change to the block list URLs')).toBeInTheDocument()
  })

  it('the same URL as a block and an allow list gets two distinct switch names', async () => {
    serve([HOSTS, `#!${HOSTS}`])
    draw()
    await screen.findByRole('table')
    expect(screen.getByRole('checkbox', { name: `Enabled block list ${HOSTS}` })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: `Enabled allow list ${HOSTS}` })).not.toBeChecked()
  })

  it('on a standalone server Save sends node empty', async () => {
    serve([HOSTS])
    const save = vi.spyOn(settings, 'setSettings').mockResolvedValue({
      kind: 'ok', data: { server: 'x', response: { blockListUrls: null, blockListUpdateIntervalHours: 24 } as never },
    })
    draw(false)
    await screen.findByRole('table')
    await chooseIn(userEvent.setup(), 'Quick Add', 'None')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save).toHaveBeenCalledWith('T', { node: '', blockListUrls: 'false' })
  })

  it('after a save the next update is the one the server answers', async () => {
    vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'n/a' })
    vi.spyOn(quick, 'loadQuickList').mockResolvedValue([])
    vi.spyOn(settings, 'getSettings').mockResolvedValue({
      blockListUrls: [HOSTS], blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: '2999-01-01T00:00:00Z',
    } as never)
    // Emptying the lists stops the server's timer: the key comes back omitted.
    vi.spyOn(settings, 'setSettings').mockResolvedValue({
      kind: 'ok', data: { server: 'x', response: { blockListUrls: null, blockListUpdateIntervalHours: 12 } as never },
    })
    draw()
    await screen.findByRole('table')
    expect(screen.queryByText('Not Scheduled')).not.toBeInTheDocument()
    await chooseIn(userEvent.setup(), 'Quick Add', 'None')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('DNS Server settings were saved successfully.')
    expect(screen.getByText('Not Scheduled')).toBeInTheDocument()
    expect(screen.getByText('Next update · every 12 h')).toBeInTheDocument()
  })

  it('a failed count read says so on both figures', async () => {
    serve([HOSTS])
    draw()
    await screen.findByRole('table')
    expect(await screen.findAllByText('Could not read the counts.')).toHaveLength(2)
  })

  it('the counts are drawn when the stats arrive, zero included', async () => {
    serve([HOSTS])
    vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({
      kind: 'ok', data: { stats: { blockListZones: 1234, allowListZones: 0 } } as never,
    })
    draw()
    expect(await screen.findByText((1234).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByText('Could not read the counts.')).not.toBeInTheDocument()
  })

  it('Quick Add None empties the table and Discard brings it back', async () => {
    serve([HOSTS])
    draw()
    await screen.findByRole('table')
    await chooseIn(userEvent.setup(), 'Quick Add', 'None')
    expect(screen.getByText('No lists')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByText('Steven Black [adware + malware]')).toBeInTheDocument()
  })

  it('adds an allow list with !', async () => {
    serve([])
    draw()
    await userEvent.type(await screen.findByLabelText('List URL'), 'https://a.test/allow.txt')
    await userEvent.click(screen.getByRole('button', { name: 'Add allow list' }))
    expect(within(screen.getByRole('table')).getByText('Allow')).toBeInTheDocument()
    expect(screen.getByLabelText('List URL')).toHaveValue('')
  })

  it('an empty field adds nothing and says nothing', async () => {
    serve([])
    draw()
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Add block list' }))
    expect(screen.getByText('No lists')).toBeInTheDocument()
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument()
  })

  it('rejects a URL typed with # or !, under the field', async () => {
    serve([])
    draw()
    const field = await screen.findByLabelText('List URL')
    await userEvent.type(field, '!https://a.test/allow.txt')
    await userEvent.click(screen.getByRole('button', { name: 'Add allow list' }))
    const msg = 'Enter the URL without # or !; use the buttons to choose block or allow.'
    expect(screen.getByText(msg)).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(msg)
    expect(field).toHaveValue('!https://a.test/allow.txt')
    expect(screen.getByText('No lists')).toBeInTheDocument()
    // Typing again clears the message.
    await userEvent.clear(field)
    expect(screen.queryByText(msg)).not.toBeInTheDocument()
    await userEvent.type(field, '#https://a.test/x')
    await userEvent.click(screen.getByRole('button', { name: 'Add block list' }))
    expect(screen.getByText(msg)).toBeInTheDocument()
  })

  it('does not add a list already in the table, in any form', async () => {
    serve([`#!${HOSTS}`])
    draw()
    const field = await screen.findByLabelText('List URL')
    await userEvent.type(field, ` ${HOSTS} `)
    await userEvent.click(screen.getByRole('button', { name: 'Add block list' }))
    expect(screen.getByText('This list is already in the table.')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument()
  })

  it('Update Now is off when no list was ever saved', async () => {
    serve(null)
    draw()
    expect(await screen.findByRole('button', { name: 'Update Now' })).toBeDisabled()
  })

  it('a next update the server omits reads Not Scheduled', async () => {
    vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'n/a' })
    vi.spyOn(quick, 'loadQuickList').mockResolvedValue([])
    // `settings/get` drops null keys: a fresh server sends no blockListNextUpdatedOn at all.
    vi.spyOn(settings, 'getSettings').mockResolvedValue({
      blockListUrls: [HOSTS], blockListUpdateIntervalHours: 24,
    } as never)
    draw()
    await screen.findByRole('table')
    expect(screen.getByText('Not Scheduled')).toBeInTheDocument()
    expect(screen.getByText('Next update · every 24 h')).toBeInTheDocument()
  })

  it('a failed read says so instead of loading for ever', async () => {
    vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'n/a' })
    vi.spyOn(quick, 'loadQuickList').mockResolvedValue([])
    vi.spyOn(settings, 'getSettings').mockResolvedValue(null)
    draw()
    expect(await screen.findByText('Could not read the block list settings.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('Update Now asks first, then forces the update', async () => {
    serve([HOSTS])
    const force = vi.spyOn(settings, 'forceUpdateBlockLists').mockResolvedValue(true)
    draw()
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Update Now' }))
    expect(force).not.toHaveBeenCalled()
    expect(screen.getByText('Are you sure to force download and update the block lists?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(force).toHaveBeenCalledWith('T')
    expect(await screen.findByText('Block list update was triggered successfully.')).toBeInTheDocument()
    expect(screen.getByText('Updating Now')).toBeInTheDocument()
  })

  /*
  Spec, «Qué se refresca»: Block List Domains changes when the server finishes
  reloading, not at once, and the figure says so. What the real server (v15.5.1) gives
  to tell: `blockListNextUpdatedOn` is the last SUCCESSFUL update plus the interval
  (WebServiceSettingsApi.cs:384), and the last update only moves when a download ends
  well (BlockListZoneManager.cs:674-692). So while it reloads it keeps answering the
  OLD date, and the reload has finished when the date differs from the one captured
  when the action was taken. The mocks below answer exactly that way.
  */
  describe('the figures after a change', () => {
    const OLD = '2999-01-01T00:00:00Z'
    const NEW = '2999-01-02T00:00:00Z'
    const stats = (block: number) => ({ kind: 'ok' as const, data: { stats: { blockListZones: block, allowListZones: 0 } } as never })
    const answer = (next: string | undefined, urls: string[] | null = [HOSTS]) =>
      ({ blockListUrls: urls, blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: next }) as never

    function setup(urls: string[] | null = [HOSTS]) {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.spyOn(quick, 'loadQuickList').mockResolvedValue([])
      const read = vi.spyOn(settings, 'getSettings').mockResolvedValue(answer(OLD, urls))
      const counts = vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue(stats(74771))
      const force = vi.spyOn(settings, 'forceUpdateBlockLists').mockResolvedValue(true)
      return { read, counts, force, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
    }

    async function updateNow(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Update Now' }))
      await user.click(screen.getByRole('button', { name: 'Update' }))
    }

    it('after Update Now the figures say they are updating while the server still answers the old date', async () => {
      const { read, counts, user } = setup()
      draw()
      expect(await screen.findByText((74771).toLocaleString())).toBeInTheDocument()
      await updateNow(user)
      expect(await screen.findAllByText('Updating…')).toHaveLength(2)
      expect(screen.getByText('Updating Now')).toBeInTheDocument()

      // Reloading: the server still says OLD, a date in the future. Not finished.
      await act(() => vi.advanceTimersByTimeAsync(3000))
      await act(() => vi.advanceTimersByTimeAsync(3000))
      expect(screen.getAllByText('Updating…')).toHaveLength(2)
      expect(screen.getByText('Updating Now')).toBeInTheDocument()

      counts.mockResolvedValue(stats(74763))
      read.mockResolvedValue(answer(NEW))
      await act(() => vi.advanceTimersByTimeAsync(3000))
      expect(await screen.findByText((74763).toLocaleString())).toBeInTheDocument()
      expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
      expect(screen.queryByText('Updating Now')).not.toBeInTheDocument()
    })

    it('the wait is bounded: after two minutes the figures are read once more and the mark goes', async () => {
      const { read, counts, user } = setup()
      draw()
      await screen.findByText((74771).toLocaleString())
      await updateNow(user)
      await screen.findAllByText('Updating…')
      const statsBefore = counts.mock.calls.length

      await act(() => vi.advanceTimersByTimeAsync(121_000))
      expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
      expect(counts.mock.calls.length).toBe(statsBefore + 1)
      const settled = read.mock.calls.length
      await act(() => vi.advanceTimersByTimeAsync(30_000))
      expect(read.mock.calls.length).toBe(settled)
    })

    it('a second Update Now while waiting captures again and starts the two minutes again', async () => {
      const { user } = setup()
      draw()
      await screen.findByText((74771).toLocaleString())
      await updateNow(user)
      await screen.findAllByText('Updating…')
      await act(() => vi.advanceTimersByTimeAsync(100_000))
      await updateNow(user)
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      // 160 s after the first, 60 s after the second: still waiting.
      expect(screen.getAllByText('Updating…')).toHaveLength(2)
      await act(() => vi.advanceTimersByTimeAsync(65_000))
      expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
    })

    it('after a Save that changes the URLs the figures wait for the date to move, from the one the save answered', async () => {
      const { read, counts, user } = setup()
      vi.spyOn(settings, 'setSettings').mockResolvedValue({
        kind: 'ok', data: { server: 'x', response: answer(OLD, [`#${HOSTS}`]) },
      })
      draw()
      await screen.findByText((74771).toLocaleString())
      await user.click(screen.getByRole('checkbox', { name: /Enabled/ }))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findAllByText('Updating…')).toHaveLength(2)

      await act(() => vi.advanceTimersByTimeAsync(3000))
      expect(screen.getAllByText('Updating…')).toHaveLength(2)

      counts.mockResolvedValue(stats(11))
      read.mockResolvedValue(answer(NEW, [`#${HOSTS}`]))
      await act(() => vi.advanceTimersByTimeAsync(3000))
      expect(await screen.findByText('11')).toBeInTheDocument()
      expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
    })

    it('a Save that leaves the same set of URLs arms nothing: the server does not reload', async () => {
      const B = 'https://b.test/hosts'
      const { read, user } = setup([HOSTS, B])
      // Removed and added back: last now, a new order, the same items (HasSameItems).
      vi.spyOn(settings, 'setSettings').mockResolvedValue({
        kind: 'ok', data: { server: 'x', response: answer(OLD, [B, HOSTS]) },
      })
      draw()
      await screen.findByText((74771).toLocaleString())
      await user.click(screen.getByRole('button', { name: `Remove ${HOSTS}` }))
      await user.type(screen.getByRole('textbox', { name: 'List URL' }), HOSTS)
      await user.click(screen.getByRole('button', { name: 'Add block list' }))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText('DNS Server settings were saved successfully.')
      expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
      const reads = read.mock.calls.length
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      expect(read.mock.calls.length).toBe(reads)
    })

    it('a Save that empties the lists reads the figures at once: the server flushes them there and then', async () => {
      const { counts, user } = setup()
      vi.spyOn(settings, 'setSettings').mockResolvedValue({
        kind: 'ok', data: { server: 'x', response: answer(undefined, null) },
      })
      draw()
      await screen.findByText((74771).toLocaleString())
      counts.mockResolvedValue(stats(0))
      await chooseIn(user, 'Quick Add', 'None')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findAllByText('0')).toHaveLength(2)
      expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
    })
  })

  it('without Settings.canModify, Save and the switches are disabled', async () => {
    serve([HOSTS])
    render(
      <BlockLists token="T" clusterInitialised={false}
        permissions={{ Settings: { canView: true, canModify: false, canDelete: false } }} />,
    )
    expect(await screen.findByRole('checkbox', { name: /Enabled/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Add block list/ })).toBeDisabled()
  })

  it('without Settings.canView the lists are locked and nothing is read', async () => {
    const get = serve([HOSTS])
    render(
      <BlockLists token="T" clusterInitialised={false}
        permissions={{ Settings: { canView: false, canModify: false, canDelete: false } }} />,
    )
    expect(await screen.findByText('Requires Settings: View')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
})
