/*
The `Settings` sections: their count and the order of their notices.

Two of the six decisions phase 2 deferred to this screen.

**The count is counted, not written.** Pilot 3 puts on every label how many
controls the section has, and its ten figures add up to 39 —the screen's total— so
the drawing checks itself. That property only survives if the number comes from
the content: ten hand-written numbers part company with the content on the first
control anyone adds, and they do it silently.

**`Warning!` before the controls, `Note!` after.** One can change your decision and
the other explains it, so reading the warning after having touched the control
arrives late by definition. The seventeen notice blocks on this screen all went
below, the seven `Warning!` included.
*/
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Block, TextRow, Notices, Note, Warning } from '../../ui/PanelForm'

describe('a section count', () => {
  it('it counts the controls it holds', async () => {
    render(
      <Block title="Rate Limiting">
        <TextRow label="Uno" value="" onChange={() => {}} />
        <TextRow label="Dos" value="" onChange={() => {}} />
        <TextRow label="Tres" value="" onChange={() => {}} />
      </Block>,
    )

    const header = screen.getByRole('heading', { name: 'Rate Limiting' }).parentElement!
    expect(await within(header).findByText('3')).toBeInTheDocument()
  })

  /* It is counted from the content: adding a control moves the figure by itself. */
  it('the figure follows the content, not a constant', async () => {
    const { rerender } = render(
      <Block title="Rate Limiting">
        <TextRow label="Uno" value="" onChange={() => {}} />
      </Block>,
    )
    const header = screen.getByRole('heading', { name: 'Rate Limiting' }).parentElement!
    expect(await within(header).findByText('1')).toBeInTheDocument()

    rerender(
      <Block title="Rate Limiting">
        <TextRow label="Uno" value="" onChange={() => {}} />
        <TextRow label="Dos" value="" onChange={() => {}} />
      </Block>,
    )

    expect(await within(header).findByText('2')).toBeInTheDocument()
  })

  /* A section with no controls does not hang a "0" off its label. */
  it('with no controls it draws no count', () => {
    render(<Block title="Prose only"><p>nothing to count</p></Block>)
    const header = screen.getByRole('heading', { name: 'Prose only' }).parentElement!
    expect(within(header).queryByText('0')).not.toBeInTheDocument()
  })
})

describe('the order of the notices', () => {
  it('the Warning goes BEFORE the controls and the Note after', () => {
    const { container } = render(
      <Block title="UDP Socket Pool" notices={<Warning>Careful with this.</Warning>}>
        <TextRow label="Excluded Ports" value="" onChange={() => {}} />
        <Notices>
          <Note>This explains it.</Note>
        </Notices>
      </Block>,
    )

    /*
    First that all three are THERE, and only then the order.

    Without this check the test was worthless: if the warning is not drawn,
    `indexOf` returns **-1**, which is less than any position — so "it comes
    before" stayed true with the warning absent. Proven by removing the render
    and watching it pass green.
    */
    expect(screen.getByText('Careful with this.')).toBeInTheDocument()
    expect(screen.getByText('This explains it.')).toBeInTheDocument()

    const text = container.textContent ?? ''
    expect(text.indexOf('Careful with this.')).toBeLessThan(text.indexOf('Excluded Ports'))
    expect(text.indexOf('Excluded Ports')).toBeLessThan(text.indexOf('This explains it.'))
  })
})
