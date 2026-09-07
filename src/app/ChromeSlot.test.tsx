/*
The chrome slot.

It exists because the design puts the node selector at the top, and the selector
**belongs to each screen**: the Dashboard remembers its choice in
`dashboardClusterNode` and `Settings` its own in `settingsClusterNode`, each with
its own options. A single selector in the chrome would have to invent a shared
memory and would change the behaviour of eight screens at a stroke.

So the chrome provides the PLACE and the screen provides the CONTROL. What these
tests protect is exactly that separation.
*/
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlotProvider, EnElCromo } from './ChromeSlot'

describe('the slot in the chrome', () => {
  it('what a screen puts in it shows up in the slot', () => {
    render(
      <SlotProvider>
        {(slot) => (
          <>
            <div data-testid="hueco" ref={slot} />
            <main>
              <EnElCromo>
                <button>Selector</button>
              </EnElCromo>
            </main>
          </>
        )}
      </SlotProvider>,
    )

    expect(screen.getByTestId('hueco')).toContainElement(screen.getByRole('button', { name: 'Selector' }))
  })

  /* With no slot yet it does not blow up: it simply draws nothing. */
  it('with no slot it draws nothing and does not throw', () => {
    render(
      <SlotProvider>
        {() => (
          <EnElCromo>
            <button>Selector</button>
          </EnElCromo>
        )}
      </SlotProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Selector' })).not.toBeInTheDocument()
  })

  /*
  And the slot stays EMPTY if nobody uses it — which is the case on seven of the
  eight screens. Without this, they would all gain a blank space at the top.
  */
  it('the slot stays empty when no screen uses it', () => {
    render(
      <SlotProvider>
        {(slot) => (
          <>
            <div data-testid="hueco" ref={slot} />
            <main>nothing to hang</main>
          </>
        )}
      </SlotProvider>,
    )

    expect(screen.getByTestId('hueco')).toBeEmptyDOMElement()
  })
})
