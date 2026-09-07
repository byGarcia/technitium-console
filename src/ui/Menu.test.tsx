import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Menu } from './Menu'

/*
For this piece, jsdom can only answer half: there is no layout, so
`getBoundingClientRect()` returns zeros and there is no point asserting here that
the menu flips when it does not fit —that is measured in the browser, with the
window at 900 and at 560 px—. What it can answer is the behaviour, and in
particular the bug the flipping introduced: the handler that closes the menu on
scroll is shared with `resize`, and there the `target` is `window`, which is not a
node.
*/
function Sample({ asRow = false }: { asRow?: boolean } = {}) {
  return (
    <Menu label="Options" text="Options" asRow={asRow}>
      {(close) => (
        <>
          <button onClick={close}>Uno</button>
          <button onClick={close}>Dos</button>
        </>
      )}
    </Menu>
  )
}

describe('Menu', () => {
  it('resizing the window with the menu open closes it, and does not blow up', async () => {
    render(<Sample />)
    await userEvent.click(screen.getByRole('button', { name: 'Options' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent(window, new Event('resize'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('it reports on opening, for whoever needs to check the state just before', async () => {
    const openOnes: number[] = []
    render(
      <Menu label="Options" text="Options" onOpen={() => openOnes.push(1)}>
        {() => <button role="menuitem">Uno</button>}
      </Menu>,
    )
    const b = screen.getByRole('button', { name: 'Options' })
    await userEvent.click(b)
    await userEvent.click(b) // cerrar no avisa
    await userEvent.click(b)
    expect(openOnes).toHaveLength(2)
  })

  it('Escape closes it and returns the focus to the trigger', async () => {
    render(<Sample />)
    const b = screen.getByRole('button', { name: 'Options' })
    await userEvent.click(b)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(b)
  })

  /*
  The row trigger is the account one, at the foot of the sidebar. It was written
  separately, with its own state, and it had forgotten precisely the three things
  you cannot see by looking at it open: it did not close on an outside click, nor
  on Escape, nor on scroll. Now it is this same menu, so it inherits them; this
  test is what stops it being written on its own again.
  */
  it('the row trigger closes on an outside click, just like the button one', async () => {
    render(
      <>
        <Sample asRow />
        <p>outside</p>
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Options' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  /*
  The keyboard pattern, which is what `role="menu"` promises. It was carried
  without any of it until 2026-09-07: the role was there and the items were loose
  buttons. These tests are the promise, and they are written against the
  primitive rather than against any call site, because the call sites render
  plain buttons and it is the menu that turns them into items.
  */
  describe('the keyboard the role promises', () => {
    function Three() {
      return (
        <Menu label="Options" text="Options">
          {() => (
            <>
              <button>One</button>
              <button disabled>Two</button>
              <button>Three</button>
            </>
          )}
        </Menu>
      )
    }

    it('the items are menu items, and a disabled one is not', async () => {
      const user = userEvent.setup()
      render(<Three />)
      await user.click(screen.getByRole('button', { name: 'Options' }))
      expect(screen.getAllByRole('menuitem').map((e) => e.textContent)).toEqual(['One', 'Three'])
      expect(screen.getByRole('button', { name: 'Two' })).toBeDisabled()
    })

    it('opening puts the focus on the first item', async () => {
      const user = userEvent.setup()
      render(<Three />)
      await user.click(screen.getByRole('button', { name: 'Options' }))
      expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
    })

    /* One tab stop for the whole menu, not one per item: that is the difference
       between a menu and a pile of buttons. */
    it('only the focused item is a tab stop', async () => {
      const user = userEvent.setup()
      render(<Three />)
      await user.click(screen.getByRole('button', { name: 'Options' }))
      expect(screen.getByRole('menuitem', { name: 'One' })).toHaveAttribute('tabindex', '0')
      expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveAttribute('tabindex', '-1')
    })

    it('the arrows move, they wrap, and they skip what is disabled', async () => {
      const user = userEvent.setup()
      render(<Three />)
      await user.click(screen.getByRole('button', { name: 'Options' }))
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus()
    })

    it('Home and End go to the ends', async () => {
      const user = userEvent.setup()
      render(<Three />)
      await user.click(screen.getByRole('button', { name: 'Options' }))
      await user.keyboard('{End}')
      expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus()
      await user.keyboard('{Home}')
      expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
    })

    it('the down arrow opens it from the trigger, without a click', async () => {
      const user = userEvent.setup()
      render(<Three />)
      screen.getByRole('button', { name: 'Options' }).focus()
      await user.keyboard('{ArrowDown}')
      expect(await screen.findByRole('menuitem', { name: 'One' })).toHaveFocus()
    })

    it('Tab leaves the menu instead of walking through it', async () => {
      const user = userEvent.setup()
      render(<Three />)
      await user.click(screen.getByRole('button', { name: 'Options' }))
      await user.keyboard('{Tab}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })
})
