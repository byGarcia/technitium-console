import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Blocking } from './Blocking'

vi.mock('./Overview', () => ({ Overview: () => <p>overview</p> }))
vi.mock('./Rules', () => ({ Rules: () => <p>rules</p> }))
vi.mock('./BlockLists', () => ({
  BlockLists: ({ tabs, onDirty }: { tabs?: React.ReactNode; onDirty?: (dirty: boolean) => void }) => (
    <>
      {tabs}
      <button type="button" onClick={() => onDirty?.(true)}>edit</button>
      <button type="button" onClick={() => onDirty?.(false)}>discard</button>
    </>
  ),
}))

afterEach(() => window.history.replaceState(null, '', '/'))

describe('Blocking', () => {
  it('draws the tab it is given, and Overview for anything else', () => {
    const { rerender } = render(<Blocking token="T" sub="Rules" onSubChange={() => {}} permissions={undefined} />)
    expect(screen.getByText('rules')).toBeInTheDocument()
    rerender(<Blocking token="T" sub="zzz" onSubChange={() => {}} permissions={undefined} />)
    expect(screen.getByText('overview')).toBeInTheDocument()
  })

  it('leaving Rules drops ?rule= from the address bar', () => {
    window.history.replaceState(null, '', '/blocking/lists/?rule=blocked')
    render(<Blocking token="T" sub="Lists" onSubChange={() => {}} permissions={undefined} />)
    expect(window.location.search).toBe('')
  })

  it('leaving the section drops ?rule= too, and Rules keeps it while it is open', () => {
    window.history.replaceState(null, '', '/blocking/rules/?rule=blocked')
    const { unmount } = render(<Blocking token="T" sub="Rules" onSubChange={() => {}} permissions={undefined} />)
    expect(window.location.search).toBe('?rule=blocked')
    unmount()
    expect(window.location.pathname + window.location.search).toBe('/blocking/rules/')
  })

  it('marks the Lists tab while Lists has unsaved changes, in its accessible name', () => {
    render(<Blocking token="T" sub="Lists" onSubChange={() => {}} permissions={undefined} />)
    expect(screen.getByRole('link', { name: 'Lists' })).toBeInTheDocument()
    act(() => screen.getByRole('button', { name: 'edit' }).click())
    expect(screen.getByRole('link', { name: 'Lists, unsaved changes' })).toHaveAttribute('aria-current', 'page')
    act(() => screen.getByRole('button', { name: 'discard' }).click())
    expect(screen.getByRole('link', { name: 'Lists' })).toBeInTheDocument()
  })
})
