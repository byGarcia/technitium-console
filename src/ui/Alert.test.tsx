import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Alert } from './Alert'
import { Note, Warning } from './PanelForm'

/* common.js:213-217 — only success alerts dismiss themselves, and after 5 s. */

afterEach(() => vi.useRealTimers())

describe('self-dismissal of the alert', () => {
  it('a success dismisses itself after five seconds', () => {
    vi.useFakeTimers()
    const close = vi.fn()
    render(<Alert type="success" title="Saved!" onDismiss={close} />)

    vi.advanceTimersByTime(4999)
    expect(close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('an error does NOT dismiss itself: the user has to read it', () => {
    vi.useFakeTimers()
    const close = vi.fn()
    render(<Alert type="danger" title="Error!" onDismiss={close} />)

    vi.advanceTimersByTime(30000)
    expect(close).not.toHaveBeenCalled()
  })

  it('a success that cannot be closed does not go away by itself either', () => {
    vi.useFakeTimers()
    render(<Alert type="success" title="Saved!" />)
    vi.advanceTimersByTime(30000)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('a new alert restarts the clock', () => {
    vi.useFakeTimers()
    const close = vi.fn()
    const { rerender } = render(<Alert type="success" title="Saved!" onDismiss={close} />)

    vi.advanceTimersByTime(4000)
    rerender(<Alert type="success" title="Flushed!" onDismiss={close} />)
    vi.advanceTimersByTime(4000)
    expect(close).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(close).toHaveBeenCalledTimes(1)
  })
})

/*
The difference between `Note!` and `Warning!`, and why it is tested here and not
in `PanelForm`.

They are drawn by TWO routes —42 notices through the form kit's `Note`/`Warning`
and 36 with `<Alert>` directly in the modals— so the treatment has to live where
the two share code. These tests fix exactly that: that both routes come out the
same.

What jsdom CANNOT answer, said so nobody reads more into it than there is: there is
no CSS here, so **filled against outlined is not checked in these tests**. That is
measured by `dev/uniformity.js` against the real page, with the `notice-<type>`
family that takes the fill in precisely because the previous signature did not see
it. The division is the usual one: the unit test watches structure and semantics,
the sweep watches the treatment.
*/
describe('Note! against Warning!', () => {
  it('each type brings its icon, and it is decorative', () => {
    const { container, rerender } = render(
      <Alert type="info" title="Note!">
        text
      </Alert>,
    )
    const iconoNote = container.querySelector('svg')
    expect(iconoNote).toBeTruthy()
    expect(iconoNote).toHaveAttribute('aria-hidden', 'true')
    expect(iconoNote).toHaveAttribute('focusable', 'false')
    /* The STRING is kept, not the node: React reuses the same `svg` on
       re-render, so a live reference would end up compared with itself and the
       test would always pass. */
    const dibujoNote = iconoNote!.innerHTML

    rerender(
      <Alert type="warning" title="Warning!">
        text
      </Alert>,
    )
    /* It is not the same drawing: if it were, the icon would tell nothing apart. */
    expect(container.querySelector('svg')!.innerHTML).not.toBe(dibujoNote)
  })

  /*
  The icon must NOT replace or repeat the word. `Note!` and `Warning!` are
  upstream literals and they are still in the text.
  */
  it('the icon does not touch the accessible text', () => {
    render(
      <Alert type="warning" title="Warning!">
        Enable IPv6 support only if this DNS Server has native IPv6 Internet access
      </Alert>,
    )
    const notice = screen.getByRole('alert')
    expect(notice).toHaveTextContent(
      'Warning! Enable IPv6 support only if this DNS Server has native IPv6 Internet access',
    )
    /* The svg adds no text: the accessible content is the same with and without it. */
    expect(notice.querySelector('svg')?.textContent).toBe('')
  })

  it('it keeps the role, the title and the close button', () => {
    const onDismiss = vi.fn()
    render(
      <Alert type="info" title="Note!" onDismiss={onDismiss}>
        text
      </Alert>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  /*
  THE ONE THAT MATTERS: the two routes have to give the same thing. If `PanelForm`
  went back to treating its notices on its own, the same `Note!` would weigh
  differently in a panel and in a modal — which is the defect `Alert.module.css`'s
  header records having already fixed once.
  */
  it('the PanelForm route and the direct Alert route draw the same', () => {
    const { container: viaKit } = render(<Note>text</Note>)
    const { container: viaAlert } = render(
      <Alert type="info" title="Note!">
        text
      </Alert>,
    )
    const a = viaKit.querySelector('[role=alert]')!
    const b = viaAlert.querySelector('[role=alert]')!

    expect(a.className).toBe(b.className)
    expect(a.querySelector('svg')?.innerHTML).toBe(b.querySelector('svg')?.innerHTML)
    expect(a.textContent).toBe(b.textContent)
  })

  it('and the same for Warning', () => {
    const { container: viaKit } = render(<Warning>text</Warning>)
    const { container: viaAlert } = render(
      <Alert type="warning" title="Warning!">
        text
      </Alert>,
    )
    const a = viaKit.querySelector('[role=alert]')!
    const b = viaAlert.querySelector('[role=alert]')!

    expect(a.className).toBe(b.className)
    expect(a.querySelector('svg')?.innerHTML).toBe(b.querySelector('svg')?.innerHTML)
  })
})
