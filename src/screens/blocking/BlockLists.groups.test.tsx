import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as settings from '../../api/settings'
import * as dashboard from '../../api/dashboard'
import * as quick from '../../lib/quick-lists'
import { chooseIn } from '../../test/dropdown'
import { BlockLists } from './BlockLists'

/*
Groups in the Lists tab: a comment line is a heading, and every change to them is a
change to `lines`, kept until Save like the rest (`list-lines.ts`, GROUPS).
*/

afterEach(() => vi.restoreAllMocks())

const A = 'https://a.test/a'
const B = 'https://b.test/b'
const C = 'https://c.test/c'
const ok = (data: unknown) => ({ kind: 'ok' as const, data: data as never })

function serve(urls: string[]) {
  vi.spyOn(dashboard, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'n/a' })
  vi.spyOn(quick, 'loadQuickList').mockResolvedValue([{ name: 'Cee list', urls: [C] }])
  vi.spyOn(settings, 'readSettings').mockResolvedValue(ok({
    blockListUrls: urls, blockListUpdateIntervalHours: 24, blockListNextUpdatedOn: null,
  }))
  return vi.spyOn(settings, 'setSettings').mockImplementation(async (_t, body) => ({
    kind: 'ok',
    data: { server: 'x', response: { blockListUrls: body.blockListUrls.split(','), blockListUpdateIntervalHours: 24 } as never },
  }))
}

async function draw(urls: string[], permissions?: Parameters<typeof BlockLists>[0]['permissions']) {
  const save = serve(urls)
  render(<BlockLists token="T" permissions={permissions} />)
  const table = await screen.findByRole('table')
  return { save, table }
}

/** The List cell texts and the headings, in table order. */
function order(table: HTMLElement): string[] {
  return within(table).getAllByRole('row').slice(1).map((r) => {
    const head = within(r).queryByRole('columnheader')
    return head != null ? `[${head.querySelector('span')?.textContent}]` : (r.querySelectorAll('td')[1]?.querySelector('div:last-of-type')?.textContent ?? '')
  })
}

async function saved(save: ReturnType<typeof serve>) {
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  return save.mock.calls.at(-1)![1].blockListUrls
}

describe('Lists groups', () => {
  it('Add group writes a heading last, as "# Name", and only on Save', async () => {
    const { save, table } = await draw([A])
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }))
    await userEvent.type(within(table).getByLabelText('Group name'), 'Ads{Enter}')
    expect(order(table)).toEqual(['[No group]', A, '[Ads]'])
    expect(screen.getByText('1 list · 0 disabled · 1 group')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes to the block list URLs: 1 group added')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
    expect(await saved(save)).toBe(`${A},# Ads`)
  })

  it('refuses a comma, a URL and an empty name under the field, and saves nothing', async () => {
    const { table } = await draw([A])
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }))
    const field = within(table).getByLabelText('Group name')
    await userEvent.click(within(table).getByRole('button', { name: 'Add group' }))
    expect(screen.getByText('Enter a group name.')).toBeInTheDocument()
    await userEvent.type(field, 'Ads, trackers{Enter}')
    expect(field).toHaveAccessibleDescription('A group name cannot contain a comma: the server splits the list at commas.')
    await userEvent.clear(field)
    await userEvent.type(field, `${B}{Enter}`)
    expect(field).toHaveAccessibleDescription('A group name cannot be a list URL.')
    await userEvent.keyboard('{Escape}')
    expect(within(table).queryByLabelText('Group name')).toBeNull()
    expect(screen.queryByText(/Unsaved changes/)).toBeNull()
  })

  it('renames a heading as one change', async () => {
    const { save, table } = await draw(['# Ads', A])
    await userEvent.click(screen.getByRole('button', { name: 'Rename group Ads' }))
    const field = within(table).getByLabelText('Group name')
    expect(field).toHaveValue('Ads')
    await userEvent.clear(field)
    await userEvent.type(field, 'Adverts{Enter}')
    expect(order(table)).toEqual(['[Adverts]', A])
    expect(screen.getByText('Unsaved changes to the block list URLs: 1 group renamed')).toBeInTheDocument()
    expect(await saved(save)).toBe(`# Adverts,${A}`)
  })

  it('closing the editor gives the focus back to the button that opened it', async () => {
    const { table } = await draw(['# Ads', A])
    await userEvent.click(screen.getByRole('button', { name: 'Rename group Ads' }))
    await userEvent.type(within(table).getByLabelText('Group name'), 's{Enter}')
    expect(screen.getByRole('button', { name: 'Rename group Adss' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Add group' })).toHaveFocus()
  })

  it('Ungroup removes only the heading: its lists join the group above', async () => {
    const { save, table } = await draw(['# One', A, '# Two', B])
    await userEvent.click(screen.getByRole('button', { name: 'Ungroup Two' }))
    expect(order(table)).toEqual(['[One]', A, B])
    expect(within(table).getByRole('columnheader', { name: /^One/ })).toHaveTextContent('2 lists')
    expect(await saved(save)).toBe(`# One,${A},${B}`)
  })

  it('adds a URL into the chosen group', async () => {
    const { save, table } = await draw([A, '# One', B, '# Two'])
    await chooseIn(userEvent.setup(), 'Add to group', 'One')
    await userEvent.type(screen.getByLabelText('List URL'), 'https://e.test/e')
    await userEvent.click(screen.getByRole('button', { name: 'Add allow list' }))
    expect(order(table)).toEqual(['[No group]', A, '[One]', B, 'https://e.test/e', '[Two]'])
    expect(await saved(save)).toBe(`${A},# One,${B},!https://e.test/e,# Two`)
  })

  it('Quick Add puts its lists into the chosen group', async () => {
    const { table } = await draw([A, '# One', '# Two', B])
    await chooseIn(userEvent.setup(), 'Add to group', 'One')
    await chooseIn(userEvent.setup(), 'Quick Add', 'Cee list')
    expect(order(table)).toEqual(['[No group]', A, '[One]', C, '[Two]', B])
  })

  it('a new group becomes the group lists go into', async () => {
    const { table } = await draw([A])
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }))
    await userEvent.type(within(table).getByLabelText('Group name'), 'Ads{Enter}')
    expect(screen.getByLabelText('Add to group')).toHaveTextContent('Ads')
    await userEvent.type(screen.getByLabelText('List URL'), B)
    await userEvent.click(screen.getByRole('button', { name: 'Add block list' }))
    expect(order(table)).toEqual(['[No group]', A, '[Ads]', B])
  })

  it('moves a list up and down, across headings, keeping the focus on the button', async () => {
    const { save, table } = await draw([A, '# One', B, '# Two', C])
    const up = screen.getByRole('button', { name: `Move up block list ${B}` })
    await userEvent.click(up)
    expect(order(table)).toEqual(['[No group]', A, B, '[One]', '[Two]', C])
    expect(up).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: `Move down block list ${A}` }))
    expect(order(table)).toEqual(['[No group]', B, A, '[One]', '[Two]', C])
    expect(screen.getByRole('button', { name: `Move up block list ${B}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: `Move down block list ${C}` })).toBeDisabled()
    expect(screen.getByText('Unsaved changes to the block list URLs: 1 moved')).toBeInTheDocument()
    expect(await saved(save)).toBe(`${B},${A},# One,# Two,${C}`)
  })

  it('Discard brings the headings back as they were', async () => {
    const { table } = await draw(['# One', A])
    await userEvent.click(screen.getByRole('button', { name: 'Ungroup One' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(order(table)).toEqual(['[One]', A])
  })

  it('without Settings.canModify every group control is off', async () => {
    const perms = { Settings: { canView: true, canModify: false, canDelete: false } }
    await draw(['# One', A, B], perms)
    expect(screen.getByRole('button', { name: /Add group/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rename group One' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ungroup One' })).toBeDisabled()
    expect(screen.getByRole('button', { name: `Move down block list ${A}` })).toBeDisabled()
    expect(screen.getByLabelText('Add to group')).toBeDisabled()
  })
})
