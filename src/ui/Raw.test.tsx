/*
Raw output, and the three things it can lose.

All three are checked against the CSS and not against the render, because jsdom
does not apply CSS modules: `white-space` and `max-height` do not exist there.
Skipping them for that reason would leave exactly what this primitive comes to
decide without a guard — and it is the same reason `dev/master-switch-signal.test.mjs`
exists. What IS checked against the render is what the DOM does have: the
accessible name and the focus.
*/
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Raw } from './Raw'

describe('la salida cruda', () => {
  it('it can be focused, so it can be read with a keyboard', () => {
    render(<Raw text="DNS response">{'{ "a": 1 }'}</Raw>)
    expect(screen.getByLabelText('DNS response')).toHaveAttribute('tabindex', '0')
  })

  /*
  A tab stop that announces nothing is worse than none: the cursor lands inside a
  box and the screen reader does not say what of.
  */
  it('and it announces WHAT it is, not just that there is something', () => {
    render(<Raw text="2026-09-03 log file">text</Raw>)
    expect(screen.getByLabelText('2026-09-03 log file')).toBeInTheDocument()
  })

  it('the text travels intact, with its spaces', () => {
    render(<Raw text="x">{'{\n  "k": 1\n}'}</Raw>)
    expect(screen.getByLabelText('x').textContent).toBe('{\n  "k": 1\n}')
  })

  it('the height is a cap and can be set case by case', () => {
    render(<Raw text="x" height={140}>y</Raw>)
    expect(screen.getByLabelText('x')).toHaveStyle({ '--raw-height': '140px' })
  })

  /* The `--dan` frame is for the error the server returns as TEXT, which has
     nowhere else to go. It is not the normal state. */
  it('with no tone the box is not marked as an error', () => {
    const { container } = render(<Raw text="x">y</Raw>)
    expect(container.firstElementChild?.className).not.toMatch(/error/)
  })

  it('with the error tone, it is', () => {
    const { container } = render(<Raw text="x" tono="error">y</Raw>)
    expect(container.firstElementChild?.className).toMatch(/error/)
  })
})
