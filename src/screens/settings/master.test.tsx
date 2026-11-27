/*
 The master-switch signal, as the dense-form design settled it for this screen.

 It comes in THREE pieces and none is spare: an amber edge on the row's side (seen
 without reading), opacity, which already comes with the control's `disabled`, and
 **a pill that NAMES the switch**. Without the third, "this is off" makes you hunt
 the whole screen for the switch that turned it off; `General` has ten sections.

 Amber and not a padlock, which is the console's two-word distinction: *amber =
 you can*. The user can switch this on themselves. A permission, they cannot.
*/
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Row } from '../../ui/Form'

afterEach(() => vi.restoreAllMocks())

describe('a row switched off by its master', () => {
  const renderRow = (dependsOn?: string) =>
    render(
      <Row label="ECS IPv4 Prefix Length" dependsOn={dependsOn}>
        {(id) => <input id={id} disabled={dependsOn != null} />}
      </Row>,
    )

  it('it names the switch that turns it off', () => {
    renderRow('Enable EDNS Client Subnet')
    expect(screen.getByText(/Enable EDNS Client Subnet/)).toBeInTheDocument()
  })

  it('with no master there is neither pill nor mark', () => {
    renderRow()
    expect(screen.queryByText(/Needs/)).not.toBeInTheDocument()
  })

  /*
 THE ONE THAT MATTERS, and the one that was missing.

 The first version put the pill INSIDE the `<label>`, and the field's accessible
 name became "ECS IPv4 Prefix Length**Needs Enable EDNS Client Subnet**": the
 control stopped being findable by its own label. It is what the design rules forbid
 for the tooltip ("it never replaces the accessible name") happening with the pill.

 And it did not fire because the test next door only looked at the case WITHOUT a
 master: a test that exercises the good branch says nothing about the bad one.
  */
  it('WITH a master, the field is still found by its label and only by it', () => {
    renderRow('Enable EDNS Client Subnet')

    expect(screen.getByLabelText('ECS IPv4 Prefix Length')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('ECS IPv4 Prefix LengthNeeds Enable EDNS Client Subnet'),
    ).not.toBeInTheDocument()
  })
})
