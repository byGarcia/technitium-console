/*
The `Settings` blocks: what their header carries, how a row reads, and the order of
their notices.

**No count in the header** (2026-11-06). The header used to carry how many controls
the block held ("4", "9"); beside a title it read as a quantity of something the
server holds, and it was only the number of rows under it.

**A row reads label, help, control** (deviation 22): the help is under the label and
before the control in the document, so it is read in the order it is drawn.

**`Warning!` before the controls, `Note!` after.** One can change your decision and
the other explains it, so reading the warning after having touched the control
arrives late by definition. The seventeen notice blocks on this screen all went
below, the seven `Warning!` included.
*/
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Block, TextRow, Notices, Note, Warning } from '../../ui/PanelForm'

describe('a block header', () => {
  it('carries its title and no figure', () => {
    render(
      <Block title="Rate Limiting">
        <TextRow label="One" value="" onChange={() => {}} />
        <TextRow label="Two" value="" onChange={() => {}} />
        <TextRow label="Three" value="" onChange={() => {}} />
      </Block>,
    )
    const header = screen.getByRole('heading', { name: 'Rate Limiting' }).parentElement!
    expect(header.textContent).toBe('Rate Limiting')
  })

  it('is marked as a block, for a search to hide it when it is left empty', () => {
    const { container } = render(
      <Block title="Rate Limiting">
        <TextRow label="One" value="" onChange={() => {}} help="What one is." />
      </Block>,
    )
    expect(container.querySelector('[data-block]')).not.toBeNull()
    expect(container.querySelectorAll('[data-unit]')).toHaveLength(1)
  })
})

describe('a page row', () => {
  it('reads label, help, control, in that order', () => {
    render(<TextRow label="Default Record TTL" value="3600" onChange={() => {}} help="The default TTL value." />)
    const field = screen.getByLabelText('Default Record TTL')
    const label = screen.getByText('Default Record TTL')
    const help = screen.getByText('The default TTL value.')
    expect(label.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(help.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    `indexOf` returns **-1**, which is less than any position, so "it comes
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
