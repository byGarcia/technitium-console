/*
 The master-switch signal, which pilot 3 closed and phase 2 deferred to this screen.

 It comes in THREE pieces and none is spare: an amber edge on the row's side —seen
 without reading—, opacity, which already comes with the control's `disabled`, and
 **a pill that NAMES the switch**. Without the third, "this is off" makes you hunt
 the whole screen for the switch that turned it off; `General` has ten sections.

 Amber and not a padlock, which is the two-word distinction of phase 1: *amber =
 you can*. The user can switch this on themselves. A permission, they cannot.
*/
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Row } from '../../ui/Form'

afterEach(() => vi.restoreAllMocks())

describe('a row switched off by its master', () => {
  const pintar = (dependeDe?: string) =>
    render(
      <Row label="ECS IPv4 Prefix Length" dependeDe={dependeDe}>
        {(id) => <input id={id} disabled={dependeDe != null} />}
      </Row>,
    )

  it('it names the switch that turns it off', () => {
    pintar('Enable EDNS Client Subnet')
    expect(screen.getByText(/Enable EDNS Client Subnet/)).toBeInTheDocument()
  })

  /*
 The pill goes in the SAME CELL as the label, not loose on the row: it is about
 the control and has to be seen next to its name.

 "In the same cell" and not "inside the `<label>`", which is what this test
 asserted before: inside the label it ate the field's accessible name. Closeness
 is layout; the name belongs to the control.
  */
  it('the pill goes in the same cell as the label', () => {
    pintar('Enable EDNS Client Subnet')
    const celda = screen.getByText('ECS IPv4 Prefix Length').parentElement!
    expect(within(celda).getByText(/Enable EDNS Client Subnet/)).toBeInTheDocument()
  })

  it('with no master there is neither pill nor mark', () => {
    pintar()
    expect(screen.queryByText(/Needs/)).not.toBeInTheDocument()
  })

  /*
 THE ONE THAT MATTERS, and the one that was missing.

 The first version put the pill INSIDE the `<label>`, and the field's accessible
 name became "ECS IPv4 Prefix Length**Needs Enable EDNS Client Subnet**": the
 control stopped being findable by its own label. It is what phase 1 forbids for
 the tooltip —"it never replaces the accessible name"— happening with the pill.

 And it did not fire because the test next door only looked at the case WITHOUT a
 master: a test that exercises the good branch says nothing about the bad one.
  */
  it('WITH a master, the field is still found by its label and only by it', () => {
    pintar('Enable EDNS Client Subnet')

    expect(screen.getByLabelText('ECS IPv4 Prefix Length')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('ECS IPv4 Prefix LengthNeeds Enable EDNS Client Subnet'),
    ).not.toBeInTheDocument()
  })

  it('and clicking the label still takes you to the control', async () => {
    const user = userEvent.setup()
    pintar()

    const campo = screen.getByLabelText('ECS IPv4 Prefix Length')
    await user.click(screen.getByText('ECS IPv4 Prefix Length'))
    expect(document.activeElement).toBe(campo)
  })
})
