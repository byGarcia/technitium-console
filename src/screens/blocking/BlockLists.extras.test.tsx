import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as settings from '../../api/settings'
import * as dashboard from '../../api/dashboard'
import * as quick from '../../lib/quick-lists'
import { minuteStamp } from '../../lib/dates'
import { ThisServerName } from '../../ui/ClusterNodeSelect'
import { BlockLists } from './BlockLists'
import { readReadings } from './list-history'

/*
Deviation 32 on the Lists tab: the last update worked out from the server's two values,
the Block List Domains readings kept in this browser, and Save and Update Now.
*/

const HOSTS = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'
const ok = (data: unknown) => ({ kind: 'ok' as const, data: data as never })
const stats = (block: number) => ok({ stats: { blockListZones: block, allowListZones: 0 } })
const NEXT = '2999-01-02T07:11:00.000Z'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

/** Every call in the order it was made. */
const order: string[] = []

function serve({ next = NEXT as string | undefined, interval = 24 } = {}) {
  order.length = 0
  vi.spyOn(quick, 'loadQuickList').mockResolvedValue([])
  const counts = vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue(stats(1000))
  const read = vi.spyOn(settings, 'readSettings').mockImplementation(async () => {
    order.push('settings/get')
    return ok({ blockListUrls: [HOSTS], blockListUpdateIntervalHours: interval, blockListNextUpdatedOn: next })
  })
  const force = vi.spyOn(settings, 'forceUpdateBlockLists').mockImplementation(async () => {
    order.push('settings/forceUpdateBlockLists')
    return true
  })
  return { counts, read, force }
}

function draw(server = 'dns1.test') {
  render(
    <ThisServerName.Provider value={server}>
      <BlockLists token="T" permissions={undefined} />
    </ThisServerName.Provider>,
  )
}

const nextCell = () => screen.getByRole('heading', { name: /^Next update/ }).parentElement!

describe('when the lists were last updated', () => {
  it('is the next update minus the interval, in the Next update cell', async () => {
    serve()
    draw()
    await screen.findByRole('table')
    const last = '2999-01-01T07:11:00.000Z'
    expect(within(nextCell()).getByText(new RegExp(`^Last updated ${minuteStamp(last)}, `))).toBeInTheDocument()
  })

  it('says nothing when the schedule is off', async () => {
    serve({ next: undefined, interval: 0 })
    draw()
    await screen.findByRole('table')
    expect(within(nextCell()).queryByText(/Last updated/)).toBeNull()
  })
})

describe('Domains over time', () => {
  it('keeps a reading when the count changes, per server, and shows the change', async () => {
    localStorage.setItem('blocking-list-domains:dns1.test', JSON.stringify([{ at: '2026-11-01T10:00:00.000Z', count: 900 }]))
    serve()
    draw()
    const card = (await screen.findByRole('heading', { name: 'Domains over time' })).parentElement!
    await within(card).findByText((1000).toLocaleString())
    expect(within(card).getByText('+100')).toBeInTheDocument()
    const figure = screen.getByRole('heading', { name: 'Block List Domains' }).parentElement!
    expect(within(figure).getByText(`+100 since ${minuteStamp('2026-11-01T10:00:00.000Z')}`)).toBeInTheDocument()
    expect(within(card).getByText('Kept in this browser when the count changes.'))
      .toBeInTheDocument()
    expect(readReadings('dns1.test').map((r) => r.count)).toEqual([900, 1000])
    expect(readReadings('other.test')).toEqual([])
  })

  it('the same count read again is not a new reading', async () => {
    localStorage.setItem('blocking-list-domains:dns1.test', JSON.stringify([{ at: '2026-11-01T10:00:00.000Z', count: 1000 }]))
    const { counts } = serve()
    draw()
    await vi.waitFor(() => expect(counts).toHaveBeenCalled())
    expect(readReadings('dns1.test')).toHaveLength(1)
  })

  it('without Dashboard: View it is locked and nothing is read', async () => {
    const { counts } = serve()
    render(
      <BlockLists token="T"
        permissions={{
          Settings: { canView: true, canModify: true, canDelete: true },
          Dashboard: { canView: false, canModify: false, canDelete: false },
        }} />,
    )
    await screen.findByRole('table')
    expect(screen.getAllByText('Requires Dashboard: View')).toHaveLength(3)
    expect(counts).not.toHaveBeenCalled()
  })
})

describe('Save and Update Now', () => {
  async function change() {
    await userEvent.click(await screen.findByRole('checkbox', { name: /Enabled/ }))
  }

  it('saves, then asks as Update Now asks, then updates: in that order, with each one its texts', async () => {
    serve()
    const save = vi.spyOn(settings, 'setSettings').mockImplementation(async () => {
      order.push('settings/set')
      return ok({ server: 'x', response: { blockListUrls: [`#${HOSTS}`, HOSTS], blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: NEXT } })
    })
    draw()
    await change()
    order.length = 0
    await userEvent.click(screen.getByRole('button', { name: 'Save and Update Now' }))
    expect(save).toHaveBeenCalledWith('T', { node: '', blockListUrls: `#${HOSTS}` })
    expect(await screen.findByText('Are you sure to force download and update the block lists?')).toBeInTheDocument()
    expect(order).toEqual(['settings/set'])
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(await screen.findByText('Block list update was triggered successfully.')).toBeInTheDocument()
    // Update Now's own sequence: the date to wait on, read just before its call.
    expect(order).toEqual(['settings/set', 'settings/get', 'settings/forceUpdateBlockLists'])
  })

  it('cancelling the confirmation leaves the save done and updates nothing', async () => {
    const { force } = serve()
    vi.spyOn(settings, 'setSettings').mockResolvedValue(
      ok({ server: 'x', response: { blockListUrls: [`#${HOSTS}`], blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: NEXT } }),
    )
    draw()
    await change()
    await userEvent.click(screen.getByRole('button', { name: 'Save and Update Now' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('DNS Server settings were saved successfully.')).toBeInTheDocument()
    expect(force).not.toHaveBeenCalled()
  })

  it('a failed save stops there: its message, no confirmation, no update', async () => {
    const { force } = serve()
    vi.spyOn(settings, 'setSettings').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    draw()
    await change()
    await userEvent.click(screen.getByRole('button', { name: 'Save and Update Now' }))
    expect(await screen.findByText('Access was denied.')).toBeInTheDocument()
    expect(screen.queryByText('Are you sure to force download and update the block lists?')).toBeNull()
    expect(force).not.toHaveBeenCalled()
    expect(screen.getByText(/^Unsaved changes/)).toBeInTheDocument()
  })

  it('a save that empties the lists stops there: there is nothing to update', async () => {
    const { force } = serve()
    vi.spyOn(settings, 'setSettings').mockResolvedValue(
      ok({ server: 'x', response: { blockListUrls: null, blockListUpdateIntervalHours: 24 } }),
    )
    draw()
    await userEvent.click(await screen.findByRole('button', { name: `Remove ${HOSTS}` }))
    await userEvent.click(screen.getByRole('button', { name: 'Save and Update Now' }))
    expect(await screen.findByText('DNS Server settings were saved successfully.')).toBeInTheDocument()
    expect(screen.queryByText('Are you sure to force download and update the block lists?')).toBeNull()
    expect(force).not.toHaveBeenCalled()
  })

  it('needs what Save and Update Now need: Settings: Modify', async () => {
    serve()
    render(
      <BlockLists token="T" permissions={{ Settings: { canView: true, canModify: false, canDelete: false } }} />,
    )
    await screen.findByRole('table')
    // No change can be made without it, so the bar never shows; the cell's Update Now is locked.
    expect(screen.queryByRole('button', { name: 'Save and Update Now' })).toBeNull()
  })
})
