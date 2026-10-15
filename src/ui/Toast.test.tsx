import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Toast } from './Toast'

afterEach(() => vi.useRealTimers())

function Host({ returnFocus, duration }: { returnFocus?: () => void; duration?: number }) {
  const [open, setOpen] = useState(true)
  const [done, setDone] = useState(false)
  return (
    <>
      <input aria-label="Elsewhere" />
      <Toast
        message={open ? (done ? 'Done.' : 'Deleted.') : null}
        action={open && !done ? { label: 'Undo', onClick: () => setDone(true) } : undefined}
        duration={duration}
        returnFocus={returnFocus}
        onDismiss={() => setOpen(false)}
      />
    </>
  )
}

describe('Toast', () => {
  it('its live region is in the page while closed, and empty', () => {
    render(<Toast message={null} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says its message in the region, with a focusable action and a close button', async () => {
    const run = vi.fn()
    render(<Toast message="Deleted." action={{ label: 'Undo', onClick: run }} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Deleted.')
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(run).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('an action without its permission carries the padlock and is off', () => {
    render(<Toast message="Deleted." action={{ label: 'Undo', onClick: () => {}, permission: 'Blocked.canModify' }} onDismiss={() => {}} />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('goes by itself after its duration, and holds while the focus is inside', () => {
    vi.useFakeTimers()
    render(<Host duration={1000} />)
    act(() => screen.getByRole('button', { name: 'Undo' }).focus())
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByRole('status')).toHaveTextContent('Deleted.')
    act(() => screen.getByLabelText('Elsewhere').focus())
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('Escape dismisses it, and the focus goes where the page says', async () => {
    const back = vi.fn(() => screen.getByLabelText('Elsewhere').focus())
    render(<Host returnFocus={back} />)
    act(() => screen.getByRole('button', { name: 'Undo' }).focus())
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(back).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Elsewhere')).toHaveFocus()
  })

  it('losing its action while focused gives the focus back too', async () => {
    const back = vi.fn(() => screen.getByLabelText('Elsewhere').focus())
    render(<Host returnFocus={back} />)
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('status')).toHaveTextContent('Done.')
    expect(back).toHaveBeenCalledOnce()
  })
})
