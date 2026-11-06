import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from './CommandPalette'
import { actionItems, zoneItem, type PaletteItem } from './items'

afterEach(() => localStorage.clear())

const pages: PaletteItem[] = [
  { id: 'page:zones', group: 'Pages', label: 'Zones', hint: 'Page', icon: 'zones', target: { kind: 'route', section: 'zones', sub: null } },
  { id: 'page:settings/Recursion', group: 'Pages', label: 'Settings › Recursion', hint: 'Page', icon: 'settings', target: { kind: 'route', section: 'settings', sub: 'Recursion' } },
]
const items = (q: string) => [...actionItems(q, () => true), ...pages, zoneItem('example.net', 'Primary')]

describe('CommandPalette', () => {
  it('is a combobox over a listbox, with the first option active', () => {
    render(<CommandPalette open onOpenChange={() => {}} items={items} onRun={() => {}} />)
    const box = screen.getByRole('combobox', { name: 'Search' })
    expect(box).toHaveFocus()
    const first = screen.getAllByRole('option')[0]
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(box).toHaveAttribute('aria-activedescendant', first.id)
  })

  it('narrows as you type, moves with the arrows and runs with Enter', async () => {
    const onRun = vi.fn()
    const onOpenChange = vi.fn()
    render(<CommandPalette open onOpenChange={onOpenChange} items={items} onRun={onRun} />)
    await userEvent.type(screen.getByRole('combobox'), 'recur')
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('Settings › Recursion')
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowUp}{Enter}')
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'page:settings/Recursion' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('says so when nothing answers', async () => {
    render(<CommandPalette open onOpenChange={() => {}} items={() => pages} onRun={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'zzz')
    expect(screen.getByText('No matches for “zzz”.')).toBeInTheDocument()
  })

  it('remembers what was run and shows it first next time', async () => {
    const { rerender } = render(<CommandPalette open onOpenChange={() => {}} items={items} onRun={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'example.net{Enter}')
    rerender(<CommandPalette open={false} onOpenChange={() => {}} items={items} onRun={() => {}} />)
    rerender(<CommandPalette open onOpenChange={() => {}} items={items} onRun={() => {}} />)
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('example.net')
  })
})
