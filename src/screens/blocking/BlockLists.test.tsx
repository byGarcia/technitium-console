import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as settings from '../../api/settings'
import * as dashboard from '../../api/dashboard'
import * as quick from '../../lib/quick-lists'
import { chooseIn } from '../../test/dropdown'
import { BlockLists } from './BlockLists'

afterEach(() => vi.restoreAllMocks())

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
