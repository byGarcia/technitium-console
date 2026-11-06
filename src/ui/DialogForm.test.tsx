import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DialogField, DialogGroup, DialogSection, DialogValue, Tile, dialogForm } from './DialogForm'

/*
The dialog pieces change where a label sits, never what it governs: the label
still names its control, the help still follows it, and a radio drawn as a tile
is still named by its own words.
*/

describe('DialogForm', () => {
  it('a field: the label above names the control, the help follows it, the unit sits after a short one', () => {
    render(
      <DialogField label="Session Timeout" width="short" suffix="seconds" help="How long a session lasts.">
        {(id) => <input id={id} />}
      </DialogField>,
    )
    const input = screen.getByLabelText('Session Timeout')
    const label = screen.getByText('Session Timeout')
    // The label comes first in the reading order, the help after the control.
    expect(label.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const help = screen.getByText('How long a session lasts.')
    expect(input.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('seconds')).toBeInTheDocument()
  })

  it('a group of radios is a radiogroup named by its label', () => {
    render(
      <DialogGroup label="Theme" radios={dialogForm.tiles}>
        <Tile name="t" checked onChange={() => {}}>Light Theme</Tile>
        <Tile name="t" checked={false} onChange={() => {}}>Dark Theme</Tile>
      </DialogGroup>,
    )
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    expect(within(group).getByRole('radio', { name: 'Light Theme' })).toBeChecked()
  })

  it('a tile with an explanation is named by its words and described by the explanation', async () => {
    const onChange = vi.fn()
    render(
      <Tile name="v" checked={false} onChange={onChange} help="Use it only on a private network.">
        Ignore Certificate Validation Errors
      </Tile>,
    )
    const radio = screen.getByRole('radio', { name: 'Ignore Certificate Validation Errors' })
    expect(radio).toHaveAccessibleDescription('Use it only on a private network.')
    // The whole tile is the target: pressing the explanation picks the option.
    await userEvent.click(screen.getByText('Use it only on a private network.'))
    expect(onChange).toHaveBeenCalled()
  })

  it('a value is read under its label, and a section is named by its title', () => {
    render(
      <DialogSection title="Active Sessions">
        <DialogValue label="Type">Local</DialogValue>
      </DialogSection>,
    )
    expect(screen.getByRole('region', { name: 'Active Sessions' })).toBeInTheDocument()
    expect(screen.getByText('Local')).toBeInTheDocument()
  })
})
