import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as blocking from '../../api/blocking'
import * as zonelists from '../../api/zonelists'
import { Rules } from './Rules'

const OK = { kind: 'ok' as const, data: {} }
const P = (v: boolean, m = true, d = true) => ({ canView: v, canModify: m, canDelete: d })

beforeEach(() => window.history.replaceState(null, '', '/blocking/rules/'))
afterEach(() => vi.restoreAllMocks())

function exports(blocked: string[], allowed: string[]) {
  return vi.spyOn(blocking, 'readRuleExport').mockImplementation(async (list) => ({
    kind: 'ok', data: list === 'blocked' ? blocked : allowed,
  }))
}

function draw(permissions?: Parameters<typeof Rules>[0]['permissions']) {
  return render(<Rules token="T" permissions={permissions} />)
}

const NODES = [
  { name: 'node2.cluster.test', type: 'Secondary' },
  { name: 'dev.cluster.test', type: 'Primary' },
]

function emptyTree() {
  return vi.spyOn(zonelists, 'listNode').mockResolvedValue({
    kind: 'ok',
    data: { domain: '', zones: [], records: [] },
  })
}

describe('Rules', () => {
  it('draws both lists in one table with their kind', async () => {
    exports(['ads.example.com'], ['s.youtube.com'])
    draw()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('ads.example.com')).toBeInTheDocument()
    expect(within(table).getByText('Allowed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reads the filter from ?rule= and writes it back', async () => {
    window.history.replaceState(null, '', '/blocking/rules/?rule=allowed')
    exports(['ads.example.com'], ['s.youtube.com'])
    draw()
    const table = await screen.findByRole('table')
    expect(within(table).queryByText('ads.example.com')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Blocked 1' }))
    expect(window.location.search).toBe('?rule=blocked')
  })

  it('searches the whole set and pages 10,000 rules by 50', async () => {
    exports(Array.from({ length: 10_000 }, (_, i) => `d${String(i).padStart(5, '0')}.test`), [])
    draw()
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(51)
    await userEvent.type(screen.getByLabelText('Filter domains'), 'd09999')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)
  })

  it('Delete asks with upstream sentence and deletes from its own list', async () => {
    exports(['ads.example.com'], [])
    const remove = vi.spyOn(zonelists, 'deleteDomain').mockResolvedValue(OK)
    draw()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete ads.example.com' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent("Are you sure you want to delete the blocked zone 'ads.example.com'?")
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(remove).toHaveBeenCalledWith('blocked', 'T', 'ads.example.com')
    expect(await screen.findByText("Blocked zone 'ads.example.com' was deleted successfully.")).toBeInTheDocument()
  })

  it('without Allowed.canView it reads only Blocked and locks the Allowed filter', async () => {
    const read = exports(['ads.example.com'], ['never.test'])
    draw({ Blocked: P(true), Allowed: P(false) })
    await screen.findByRole('table')
    expect(read).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledWith('blocked', 'T')
    expect(screen.getByRole('button', { name: /Allowed/ })).toBeDisabled()
  })

  it('a locked filter shows no count: an unread list is not zero', async () => {
    exports(['ads.example.com'], ['never.test'])
    draw({ Blocked: P(true), Allowed: P(false) })
    await screen.findByRole('table')
    expect(screen.getByRole('button', { name: 'Allowed' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Blocked 1' })).toBeEnabled()
  })

  it('Export downloads at once, with no dialog', async () => {
    exports([], [])
    const exp = vi.spyOn(zonelists, 'exportDomains').mockResolvedValue({ ok: true })
    draw()
    await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Blocked zones' }))
    expect(exp).toHaveBeenCalledWith('blocked', 'T')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Flush asks with upstream sentence', async () => {
    exports([], [])
    vi.spyOn(zonelists, 'flushList').mockResolvedValue(OK)
    draw()
    await userEvent.click(await screen.findByRole('button', { name: 'Flush' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Allowed zones' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Are you sure you want to flush the entire Allowed zone?')
  })

  it('a menu entry without its permission stays, disabled, and names the permission', async () => {
    exports([], [])
    draw({ Blocked: P(true), Allowed: P(true, true, false) })
    await userEvent.click(await screen.findByRole('button', { name: 'Flush' }))
    const menu = screen.getByRole('menu')
    const locked = within(menu).getByRole('button', { name: 'Allowed zones' })
    expect(locked).toBeDisabled()
    expect(within(menu).getByRole('menuitem', { name: 'Blocked zones' })).toBeEnabled()
    await userEvent.hover(locked.parentElement!)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Requires Allowed: Delete')
  })

  it('the tree of a list the session cannot view is locked, not hidden', async () => {
    exports(['ads.example.com'], [])
    vi.spyOn(zonelists, 'listNode').mockResolvedValue({
      kind: 'ok',
      data: { domain: '', zones: [], records: [] },
    })
    draw({ Blocked: P(true), Allowed: P(false) })
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Tree' }))
    await userEvent.click(screen.getByRole('button', { name: 'Allowed' }))
    expect(screen.getByText('Requires Allowed: View')).toBeInTheDocument()
  })

  it('coming back from the tree reads the rules again', async () => {
    const read = exports(['ads.example.com'], [])
    vi.spyOn(zonelists, 'listNode').mockResolvedValue({
      kind: 'ok',
      data: { domain: '', zones: [], records: [] },
    })
    draw()
    await screen.findByRole('table')
    expect(read).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByRole('button', { name: 'Tree' }))
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    await screen.findByRole('table')
    expect(read).toHaveBeenCalledTimes(4)
  })

  it('a failed first read says so instead of drawing an empty table', async () => {
    vi.spyOn(blocking, 'readRuleExport').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    draw()
    expect(await screen.findByText('Access was denied.')).toBeInTheDocument()
    expect(screen.queryByText('No rules')).toBeNull()
  })

  it('?rule= naming a list the session cannot view opens on All and rewrites the bar', async () => {
    window.history.replaceState(null, '', '/blocking/rules/?rule=allowed&x=1')
    exports(['ads.example.com'], ['never.test'])
    draw({ Blocked: P(true), Allowed: P(false) })
    const table = await screen.findByRole('table')
    expect(within(table).getByText('ads.example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.search).toBe('?x=1')
  })

  it('the tree reads from the connected node first, and from the primary after a Flush', async () => {
    exports(['ads.example.com'], [])
    vi.spyOn(zonelists, 'flushList').mockResolvedValue(OK)
    const list = emptyTree()
    render(<Rules token="T" permissions={undefined} nodes={NODES} clusterInitialised />)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Tree' }))
    await screen.findByText('0 zones')
    expect(list).toHaveBeenLastCalledWith('blocked', 'T', '', undefined, '')

    await userEvent.click(screen.getByRole('button', { name: 'Flush' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Blocked zones' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Flush' }))
    await screen.findByText('Blocked zone was flushed successfully.')
    expect(list).toHaveBeenLastCalledWith('blocked', 'T', '', undefined, 'dev.cluster.test')

    await userEvent.click(screen.getByRole('button', { name: 'Allowed' }))
    await screen.findByText('0 zones')
    expect(list).toHaveBeenLastCalledWith('allowed', 'T', '', undefined, '')
  })

  it('the tree field is named apart from the add bar field', async () => {
    exports([], [])
    emptyTree()
    draw()
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Tree' }))
    expect(await screen.findByRole('textbox', { name: 'Browse domain' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox', { name: 'Domain' })).toHaveLength(1)
  })

  it('with neither list viewable it draws the padlock, not zeros it never read', async () => {
    const read = exports([], [])
    draw({ Blocked: P(false), Allowed: P(false) })
    expect(await screen.findByText('Requires Blocked: View')).toBeInTheDocument()
    expect(screen.getByText('Requires Allowed: View')).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('No rules')).toBeNull()
    expect(screen.queryByText('0 rules')).toBeNull()
  })

  it('Import opens the upstream dialog of the chosen list', async () => {
    exports([], [])
    draw()
    await userEvent.click(await screen.findByRole('button', { name: 'Import' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Blocked zones' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Import Blocked Zones' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Enter domain names one below other to import into blocked zone:')
  })

  it('Delete on an allowed rule uses the Allowed sentences and list', async () => {
    exports([], ['s.youtube.com'])
    const remove = vi.spyOn(zonelists, 'deleteDomain').mockResolvedValue(OK)
    draw()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete s.youtube.com' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Delete Allowed Zone' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent("Are you sure you want to delete the allowed zone 's.youtube.com'?")
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(remove).toHaveBeenCalledWith('allowed', 'T', 's.youtube.com')
    expect(await screen.findByText("Domain 's.youtube.com' was deleted from Allowed Zone successfully.")).toBeInTheDocument()
  })

  it('the foot count belongs to the list view, not the tree', async () => {
    exports(['ads.example.com'], [])
    emptyTree()
    draw()
    await screen.findByRole('table')
    expect(screen.getByText('1 rule')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tree' }))
    await screen.findByText('0 zones')
    expect(screen.queryByText('1 rule')).toBeNull()
  })

  it('a ?rule= value that means nothing is taken out of the bar', async () => {
    window.history.replaceState(null, '', '/blocking/rules/?rule=garbage&x=1')
    exports(['ads.example.com'], [])
    draw()
    await screen.findByRole('table')
    expect(window.location.search).toBe('?x=1')
  })
})
