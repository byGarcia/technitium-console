import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from './Select'

/*
jsdom has no layout, so the list's width and its pull-back from the window's edge
are measured in the browser. What it can answer is which scrolls close the list:
with more options than the height cap, the list scrolls itself (the wheel, and the
arrow keys through `scrollIntoView`), and that scroll used to close it.
*/
function Sample() {
  return (
    <Select aria-label="Pick" value="">
      <option value="" />
      <option value="one">One</option>
      <option value="two">Two</option>
    </Select>
  )
}

describe('Select', () => {
  it('scrolling the list itself keeps it open', async () => {
    render(<Sample />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    const list = screen.getByRole('listbox')

    fireEvent.scroll(list)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('scrolling the page closes it', async () => {
    render(<Sample />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))

    fireEvent.scroll(document)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('resizing the window closes it, and does not blow up', async () => {
    render(<Sample />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))

    fireEvent(window, new Event('resize'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
