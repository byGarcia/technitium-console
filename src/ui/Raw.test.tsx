/*
Raw output, and the things it can lose.

All three are checked against the CSS and not against the render, because jsdom
does not apply CSS modules: `white-space` and `max-height` do not exist there.
Skipping them for that reason would leave exactly what this primitive comes to
decide without a guard, and it is the same reason `dev/master-switch-signal.test.mjs`
exists. What IS checked against the render is what the DOM does have: the
accessible name and the focus.
*/
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Raw } from './Raw'

describe('the raw output', () => {
  it('it can be focused, so it can be read with a keyboard', () => {
    render(<Raw text="DNS response">{'{ "a": 1 }'}</Raw>)
    expect(screen.getByLabelText('DNS response')).toHaveAttribute('tabindex', '0')
  })

  it('the text travels intact, with its spaces', () => {
    render(<Raw text="x">{'{\n  "k": 1\n}'}</Raw>)
    expect(screen.getByLabelText('x').textContent).toBe('{\n  "k": 1\n}')
  })

  /* DNS Client's JSON keeps its indentation: nothing wraps unless asked. */
  it('by default it neither wraps nor fills', () => {
    const { container } = render(<Raw text="x">y</Raw>)
    expect(container.firstElementChild?.className).not.toMatch(/fill/)
    expect(screen.getByLabelText('x').className).not.toMatch(/wrap/)
    expect(screen.getByLabelText('x').style.getPropertyValue('--raw-hang')).toBe('')
  })
})
