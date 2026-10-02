import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

/*
`searchable`, the console's own. Off, the dropdown is exactly what it was: no field,
the focus stays on the trigger, and typing jumps to an option. On, a field on top
filters the options and takes the keys a text field keeps.
*/
function Searchable({ onChange = () => {} }: { onChange?: (v: string) => void }) {
  return (
    <Select
      aria-label="Pick"
      value=""
      searchable
      searchLabel="Search lists"
      noMatchText="No lists match"
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" />
      <option value="none">None</option>
      <option value="sb" data-search="raw.githubusercontent.com">Steven Black</option>
      <option value="oisd" data-search="big.oisd.nl">OISD Big</option>
      <optgroup label="More lists">
        <option value="more:0" data-search="lists.example.org">Example Ads</option>
        <option value="more:1" data-search="trackers.example.net">Example Trackers</option>
      </optgroup>
    </Select>
  )
}

const shown = () => within(screen.getByRole('listbox')).queryAllByRole('option').map((o) => o.textContent)

describe('Select without searchable', () => {
  it('opens with no search field and keeps the focus on the trigger', async () => {
    render(<Sample />)
    const trigger = screen.getByRole('combobox', { name: 'Pick' })
    await userEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-activedescendant')
  })

  it('typing still jumps to the option starting with it, and Enter chooses it', async () => {
    const changed: string[] = []
    render(
      <Select aria-label="Pick" value="" onChange={(e) => changed.push(e.target.value)}>
        <option value="" />
        <option value="one">One</option>
        <option value="two">Two</option>
      </Select>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('t{Enter}')
    expect(changed).toEqual(['two'])
  })

  it('arrows, Home and End move over every option', async () => {
    const changed: string[] = []
    render(
      <Select aria-label="Pick" value="" onChange={(e) => changed.push(e.target.value)}>
        <option value="" />
        <option value="one">One</option>
        <option value="two">Two</option>
      </Select>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Pick' })
    await userEvent.click(trigger)
    await userEvent.keyboard('{End}{ArrowUp}{Enter}')
    await userEvent.click(trigger)
    await userEvent.keyboard('{Home}{ArrowDown}{ArrowDown}{ArrowDown} ')
    expect(changed).toEqual(['one', 'two'])
  })
})

describe('Select with searchable', () => {
  it('opens with the focus in the search field', async () => {
    render(<Searchable />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    const field = screen.getByRole('combobox', { name: 'Search lists' })
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-controls', screen.getByRole('listbox').id)
    expect(field).toHaveAttribute('aria-autocomplete', 'list')
  })

  it('filters by name, whatever the case', async () => {
    render(<Searchable />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('STEVEN')
    expect(shown()).toEqual(['Steven Black'])
  })

  it('filters by the host in data-search too', async () => {
    render(<Searchable />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('oisd.nl')
    expect(shown()).toEqual(['OISD Big'])
  })

  it('arrows move over the filtered options and Enter chooses', async () => {
    const changed: string[] = []
    render(<Searchable onChange={(v) => changed.push(v)} />)
    const trigger = screen.getByRole('combobox', { name: 'Pick' })
    await userEvent.click(trigger)
    await userEvent.keyboard('example')
    expect(shown()).toEqual(['Example Ads', 'Example Trackers'])
    const field = screen.getByRole('combobox', { name: 'Search lists' })
    expect(field.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Example Ads' }).id)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}{Enter}')
    expect(changed).toEqual(['more:1'])
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('Space, Home and End stay in the field', async () => {
    const changed: string[] = []
    render(<Searchable onChange={(v) => changed.push(v)} />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('steven{Home} {End}')
    expect(changed).toEqual([])
    expect(screen.getByRole('combobox', { name: 'Search lists' })).toHaveValue(' steven')
  })

  it('Escape closes, returns the focus and chooses nothing', async () => {
    const changed: string[] = []
    render(<Searchable onChange={(v) => changed.push(v)} />)
    const trigger = screen.getByRole('combobox', { name: 'Pick' })
    await userEvent.click(trigger)
    await userEvent.keyboard('oisd{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(changed).toEqual([])
  })

  it('a search that matches nothing says so, and Enter does nothing', async () => {
    const changed: string[] = []
    render(<Searchable onChange={(v) => changed.push(v)} />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('zzz')
    expect(shown()).toEqual([])
    expect(screen.getByRole('status')).toHaveTextContent('No lists match')
    expect(screen.getByRole('combobox', { name: 'Search lists' })).not.toHaveAttribute('aria-activedescendant')
    await userEvent.keyboard('{Enter}')
    expect(changed).toEqual([])
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('opens again with the search cleared', async () => {
    render(<Searchable />)
    const trigger = screen.getByRole('combobox', { name: 'Pick' })
    await userEvent.click(trigger)
    await userEvent.keyboard('zzz{Escape}')
    await userEvent.click(trigger)
    expect(screen.getByRole('combobox', { name: 'Search lists' })).toHaveValue('')
    expect(shown()).toHaveLength(6)
  })

  it('a click chooses a filtered option', async () => {
    const changed: string[] = []
    render(<Searchable onChange={(v) => changed.push(v)} />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('ads')
    await userEvent.click(screen.getByRole('option', { name: 'Example Ads' }))
    expect(changed).toEqual(['more:0'])
  })
})

describe('Select with an optgroup', () => {
  it('draws the group named by its label, and the label is not an option', async () => {
    render(<Searchable />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    const group = screen.getByRole('group', { name: 'More lists' })
    expect(within(group).getAllByRole('option').map((o) => o.textContent)).toEqual(['Example Ads', 'Example Trackers'])
    expect(screen.queryByRole('option', { name: 'More lists' })).toBeNull()
  })

  it('the arrows step from the last option before the group into it, over the label', async () => {
    const changed: string[] = []
    render(<Searchable onChange={(v) => changed.push(v)} />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')
    expect(changed).toEqual(['more:0'])
  })

  it('a group with no match left is not drawn', async () => {
    render(<Searchable />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pick' }))
    await userEvent.keyboard('steven')
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByText('More lists')).toBeNull()
  })
})
