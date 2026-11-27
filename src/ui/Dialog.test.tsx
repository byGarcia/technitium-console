import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Dialog } from './Dialog'

/*
Enter submits a dialog, as in the stock console: every one of its modals is a
`<form>` whose primary button is `type="submit"` (index.html, e.g. `btnAddZone` at
4232), so Enter in one of its text fields runs that button and nothing else. A
textarea keeps Enter for a new line, a disabled primary means Enter does nothing,
and the dialog's submit never reaches a form around it.
*/

function Harness({
  onSave,
  disabled = false,
  busyAfterSave = false,
  extra,
}: {
  onSave: () => void
  disabled?: boolean
  busyAfterSave?: boolean
  extra?: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open
      onOpenChange={() => {}}
      title="Add Thing"
      actions={
        <Button
          type="submit"
          variant="primary"
          disabled={disabled || busy}
          onClick={() => {
            onSave()
            if (busyAfterSave) setBusy(true)
          }}
        >
          Add
        </Button>
      }
    >
      {extra}
      <label>
        Name
        <input />
      </label>
      <label>
        Notes
        <textarea />
      </label>
    </Dialog>
  )
}

describe('Dialog: Enter submits', () => {
  it('Enter in a text field runs the primary action once', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Harness onSave={onSave} />)
    await user.type(screen.getByLabelText('Name'), 'x{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('Enter in a textarea is a new line, not a submit', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Harness onSave={onSave} />)
    await user.type(screen.getByLabelText('Notes'), 'a{Enter}b')
    expect(screen.getByLabelText('Notes')).toHaveValue('a\nb')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('with the primary disabled, Enter does nothing', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Harness onSave={onSave} disabled />)
    await user.type(screen.getByLabelText('Name'), 'x{Enter}')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('while the action it started is busy, a second Enter does nothing', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Harness onSave={onSave} busyAfterSave />)
    await user.type(screen.getByLabelText('Name'), 'x{Enter}{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('a button in the body is not the one Enter presses, and neither is Close', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onOther = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        title="Add Thing"
        actions={
          <Button type="submit" variant="primary" onClick={onSave}>
            Add
          </Button>
        }
      >
        <Button onClick={onOther}>Use This Server</Button>
        <label>
          Name
          <input />
        </label>
      </Dialog>,
    )
    await user.type(screen.getByLabelText('Name'), 'x{Enter}')
    expect(onOther).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('a dialog with no primary action submits nothing on Enter', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Dialog open onOpenChange={onOpenChange} title="Top Stats">
        <label>
          Search
          <input />
        </label>
      </Dialog>,
    )
    await user.type(screen.getByLabelText('Search'), 'x{Enter}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('its submit does not reach a form the dialog is drawn from', async () => {
    const user = userEvent.setup()
    const outer = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onSave = vi.fn()
    render(
      <form onSubmit={outer}>
        <Harness onSave={onSave} />
      </form>,
    )
    await user.type(screen.getByLabelText('Name'), 'x{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })
})
