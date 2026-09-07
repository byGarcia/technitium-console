import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from './Tooltip'
import { Button } from './Button'

/*
What jsdom can and cannot answer here, said up front so nobody reads more into
these than there is: there is no layout, so `getBoundingClientRect()` returns
zeros and WHERE the bubble lands is not asserted — that is measured in the
browser. What it answers is everything that matters for it not to be a trap: that
it opens by pointer AND by keyboard, that Escape closes it, that it is associated
by description, and — the one that would make it harmful — that it never becomes
the trigger's name.
*/
function Rail() {
  return (
    <Tooltip text="Zones">
      <Button aria-label="Zones" icon>
        ▣
      </Button>
    </Tooltip>
  )
}

describe('Tooltip', () => {
  it('it opens with the pointer and closes on leaving', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.hover(screen.getByRole('button', { name: 'Zones' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Zones')

    await user.unhover(screen.getByRole('button', { name: 'Zones' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  /*
  The reason the 60 px rail exists. If it only answered the mouse, twelve icons
  with no label would be useless with a keyboard.
  */
  it('it opens with focus, not only with the pointer', async () => {
    const user = userEvent.setup()
    render(<Rail />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Zones' })).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Zones')
  })

  it('it closes on losing focus', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Rail />
        <button>other</button>
      </>,
    )
    await user.tab()
    expect(screen.getByRole('tooltip')).toBeTruthy()

    await user.tab()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('Escape closes it without taking focus off the trigger', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    await user.tab()
    expect(screen.getByRole('tooltip')).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
    /* The focus stays where it was: Escape closes the bubble, it does not navigate. */
    expect(screen.getByRole('button', { name: 'Zones' })).toHaveFocus()
  })

  it('it associates the bubble with the trigger by description', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    await user.tab()

    const disparador = screen.getByRole('button', { name: 'Zones' })
    const burbuja = screen.getByRole('tooltip')
    expect(disparador).toHaveAttribute('aria-describedby', burbuja.id)
    expect(burbuja.id).toBeTruthy()
  })

  /*
  THE ONE THAT MATTERS. A tooltip carrying the name would leave the control
  nameless as soon as the pointer left —and for whoever uses no pointer, always.
  So the accessible name has to be the same with the bubble open and closed, and
  the association has to be `describedby` and never `labelledby`.
  */
  it('it never replaces the trigger accessible name', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip text="Esto describe, no nombra">
        <Button aria-label="Delete Zones">✕</Button>
      </Tooltip>,
    )

    const disparador = screen.getByRole('button', { name: 'Delete Zones' })
    await user.hover(disparador)

    /* With the bubble open, the name has not moved... */
    expect(screen.getByRole('button', { name: 'Delete Zones' })).toBe(disparador)
    expect(screen.queryByRole('button', { name: 'Esto describe, no nombra' })).toBeNull()
    /* ...and it is not named with it. */
    expect(disparador).not.toHaveAttribute('aria-labelledby')
    expect(disparador).toHaveAttribute('aria-label', 'Delete Zones')
  })

  it('unopened it leaves no dangling `aria-describedby`', () => {
    render(<Rail />)
    expect(screen.getByRole('button', { name: 'Zones' })).not.toHaveAttribute('aria-describedby')
  })

  /*
  ── The three defects it carried, each with its regression ──────────────────
  */

  /*
  1. It overwrote whatever `aria-describedby` the trigger already had. A control
  described by its own help lost that description the moment you pointed at it —
  and the attribute is a LIST of ids, not a slot for one.
  */
  it('it concatenates an existing `aria-describedby` instead of overwriting it', async () => {
    const user = userEvent.setup()
    render(
      <>
        <span id="existing-help">The help it already had</span>
        <Tooltip text="Zones">
          <Button aria-label="Zones" aria-describedby="help-previa" icon>
            ▣
          </Button>
        </Tooltip>
      </>,
    )
    const disparador = screen.getByRole('button', { name: 'Zones' })
    await user.hover(disparador)

    const ids = disparador.getAttribute('aria-describedby')!.split(' ')
    expect(ids).toContain('help-previa')
    expect(ids).toContain(screen.getByRole('tooltip').id)
    expect(ids).toHaveLength(2)
  })

  it('and it gives it back intact on closing', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip text="Zones">
        <Button aria-label="Zones" aria-describedby="help-previa" icon>
          ▣
        </Button>
      </Tooltip>,
    )
    const disparador = screen.getByRole('button', { name: 'Zones' })
    await user.hover(disparador)
    await user.unhover(disparador)

    expect(disparador).toHaveAttribute('aria-describedby', 'help-previa')
  })

  /*
  2. The pointer and the focus did not compose: they were a single boolean, so
  leaving with the mouse closed a bubble the keyboard was still holding open, and
  the other way round. It stays open while EITHER cause exists.
  */
  it('it stays open when the pointer leaves if the trigger keeps focus', async () => {
    const user = userEvent.setup()
    render(<Rail />)
    const disparador = screen.getByRole('button', { name: 'Zones' })

    await user.tab() // foco
    await user.hover(disparador) // and the pointer as well
    expect(screen.getByRole('tooltip')).toBeTruthy()

    await user.unhover(disparador) // se va el puntero, queda el foco
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('it stays open on losing focus if the pointer is still over it', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Rail />
        <button>other</button>
      </>,
    )
    const disparador = screen.getByRole('button', { name: 'Zones' })

    await user.hover(disparador)
    await user.tab()
    expect(screen.getByRole('tooltip')).toBeTruthy()

    await user.tab() // focus moves to the other button; the pointer is still over it
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('it only closes when both are gone', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Rail />
        <button>other</button>
      </>,
    )
    const disparador = screen.getByRole('button', { name: 'Zones' })
    await user.hover(disparador)
    await user.tab()
    await user.tab()
    await user.unhover(disparador)

    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
