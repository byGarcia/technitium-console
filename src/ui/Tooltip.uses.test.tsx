import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RowAction } from './Table'
import { Pagination } from './Pagination'
import { Menu } from './Menu'
import { useCountUp } from './useCountUp'

/*
Where the console's tooltip went on 2026-11-05: the icon-only controls that used to
carry `title`, or nothing. Each shows its OWN name, so each bubble is drawn for the
eye only (`describe={false}`): it must never become a second announcement of the
name, nor take it.
*/
describe('icon-only controls show their name in the tooltip', () => {
  it('a row action shows its name on hover, keeps it in aria-label and has no title', async () => {
    const user = userEvent.setup()
    render(<RowAction icon="edit" name="Edit Record" />)
    const button = screen.getByRole('button', { name: 'Edit Record' })
    expect(button).not.toHaveAttribute('title')

    await user.hover(button)
    const bubble = screen.getByRole('tooltip', { hidden: true })
    expect(bubble).toHaveTextContent('Edit Record')
    expect(bubble).toHaveAttribute('aria-hidden', 'true')
    /* Its text is the name: it does not describe the button as well. */
    expect(button).not.toHaveAttribute('aria-describedby')
  })

  it('a disabled row action still shows its name', async () => {
    const user = userEvent.setup()
    render(<RowAction icon="power" name="Disable Record" disabled />)
    /* The wrapper is the hover target: a disabled button takes no pointer events. */
    await user.hover(screen.getByRole('button', { name: 'Disable Record' }).parentElement!)
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Disable Record')
  })

  it('a row action opens with the keyboard too', async () => {
    const user = userEvent.setup()
    render(<RowAction icon="refresh" name="Refresh" />)
    await user.tab()
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Refresh')
  })

  it('the pagination arrows show their names, the page numbers do not', async () => {
    const user = userEvent.setup()
    render(
      <Pagination
        window={{ pages: [1, 2, 3], first: true, previous: 1, next: 3, last: true }}
        current={2}
        last={-1}
        onGoTo={() => {}}
      />,
    )
    for (const name of ['First', 'Previous', 'Next', 'Last']) {
      await user.hover(screen.getByRole('button', { name }))
      expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(name)
      await user.unhover(screen.getByRole('button', { name }))
    }
    await user.hover(screen.getByRole('button', { name: '3' }))
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
  })

  it('the row menu trigger shows its name, and not while its menu is open', async () => {
    const user = userEvent.setup()
    render(<Menu label="Actions for casa.test">{() => <button type="button">Delete Zone</button>}</Menu>)
    const trigger = screen.getByRole('button', { name: 'Actions for casa.test' })

    await user.hover(trigger)
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Actions for casa.test')

    await user.click(trigger)
    expect(screen.getByRole('menu', { name: 'Actions for casa.test' })).toBeInTheDocument()
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
  })

  it('a menu with a visible label shows no tooltip', async () => {
    const user = userEvent.setup()
    render(<Menu label="Options" text="Options">{() => <button type="button">Export</button>}</Menu>)
    await user.hover(screen.getByRole('button', { name: 'Options' }))
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
  })
})

function Figure({ value }: { value: number }) {
  return <span data-testid="figure">{useCountUp(value)}</span>
}

describe('useCountUp', () => {
  /* jsdom has no `matchMedia`, which is read as "do not animate": the same path a
     reduced-motion user takes. The value is drawn whole on the first frame. */
  it('without motion it draws the value at once', () => {
    render(<Figure value={42} />)
    expect(screen.getByTestId('figure')).toHaveTextContent('42')
  })

  it('and a later value is drawn as it is', () => {
    const { rerender } = render(<Figure value={3} />)
    rerender(<Figure value={7} />)
    expect(screen.getByTestId('figure')).toHaveTextContent('7')
  })
})
