import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SectionIndex } from './SectionIndex'

afterEach(cleanup)

const SECTIONS = [
  { id: 'local-parameters', label: 'Local Parameters' },
  { id: 'zone-defaults', label: 'Zone Defaults' },
  { id: 'rate-limiting', label: 'Rate Limiting' },
]

describe('SectionIndex', () => {
  it('it draws one link per section, in order and pointing at its anchor', () => {
    render(<SectionIndex sections={SECTIONS} />)

    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual([
      'Local Parameters',
      'Zone Defaults',
      'Rate Limiting',
    ])
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#local-parameters',
      '#zone-defaults',
      '#rate-limiting',
    ])
  })

  /*
 `location` and not `selected`. The distinction is the whole primitive: `selected`
 asserts you have chosen one of several exclusive options, and here the ten
 sections are all still on the page.
  */
  it('it marks the active section with aria-current="location"', () => {
    render(<SectionIndex sections={SECTIONS} active="zone-defaults" />)

    expect(screen.getByRole('link', { name: 'Zone Defaults' })).toHaveAttribute(
      'aria-current',
      'location',
    )
  })

  it('it marks no other one, not even with "false"', () => {
    render(<SectionIndex sections={SECTIONS} active="zone-defaults" />)

    const others = screen
      .getAllByRole('link')
      .filter((a) => a.textContent !== 'Zone Defaults')
    expect(others).toHaveLength(2)
    for (const a of others) expect(a.hasAttribute('aria-current')).toBe(false)
  })

  it('with no active section it marks none', () => {
    render(<SectionIndex sections={SECTIONS} />)

    for (const a of screen.getAllByRole('link')) {
      expect(a.hasAttribute('aria-current')).toBe(false)
    }
  })

  /*
 It does not select. If an `aria-selected`, an `aria-pressed` or a `role="tab"`
 ever appeared here, this would be `Segmented` under another name, which is
 exactly what pilot 3 warned against.
  */
  it('it announces no selection of any kind', () => {
    const { container } = render(<SectionIndex sections={SECTIONS} active="rate-limiting" />)

    expect(container.querySelector('[aria-selected]')).toBeNull()
    expect(container.querySelector('[aria-pressed]')).toBeNull()
    expect(container.querySelector('[role="tab"]')).toBeNull()
    expect(container.querySelector('[role="tablist"]')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  /* Nor does it hide. It takes no children and owns no content: it moves the wheel. */
  it('it hides nothing', () => {
    const { container } = render(<SectionIndex sections={SECTIONS} active="rate-limiting" />)

    expect(container.querySelector('[hidden]')).toBeNull()
    expect(container.querySelector('[aria-hidden]')).toBeNull()
  })

  it('the index carries a name for whoever cannot see the screen', () => {
    render(<SectionIndex sections={SECTIONS} />)
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument()
  })

  it('the name can be changed', () => {
    render(<SectionIndex sections={SECTIONS} label="Settings sections" />)
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument()
  })

  /*
 Native navigation: they are links, so the tab key walks them in order without
 anyone setting a `tabIndex`. It is checked because the alternative —buttons with
 an `onClick` that scrolls— would have had to be reimplemented.
  */
  it('the tab key walks them in order, with no tabIndex of their own', async () => {
    const user = userEvent.setup()
    render(<SectionIndex sections={SECTIONS} />)

    const links = screen.getAllByRole('link')
    for (const a of links) expect(a.hasAttribute('tabindex')).toBe(false)

    await user.tab()
    expect(links[0]).toHaveFocus()
    await user.tab()
    expect(links[1]).toHaveFocus()
    await user.tab()
    expect(links[2]).toHaveFocus()
  })

  it('the mark follows the active section when it changes', () => {
    const { rerender } = render(<SectionIndex sections={SECTIONS} active="local-parameters" />)
    expect(screen.getByRole('link', { name: 'Local Parameters' })).toHaveAttribute(
      'aria-current',
      'location',
    )

    rerender(<SectionIndex sections={SECTIONS} active="rate-limiting" />)
    expect(screen.getByRole('link', { name: 'Local Parameters' }).hasAttribute('aria-current')).toBe(
      false,
    )
    expect(screen.getByRole('link', { name: 'Rate Limiting' })).toHaveAttribute(
      'aria-current',
      'location',
    )
  })

  /*
 Watching the scroll belongs to PHASE 3.

 `active` comes in as a prop and who works it out is screen wiring. This exists so
 that wiring does not creep in here over time: if it ever does,
 then the decision to bring it in is taken in the open, not by stealth.
  */
  it('it does not watch the scroll: that is wiring the screen does', () => {
    const onWindow = vi.spyOn(window, 'addEventListener')
    const onDocument = vi.spyOn(document, 'addEventListener')
    const observer = vi.fn()
    vi.stubGlobal('IntersectionObserver', observer)

    render(<SectionIndex sections={SECTIONS} active="zone-defaults" />)

    const events = [...onWindow.mock.calls, ...onDocument.mock.calls].map(([e]) => e)
    expect(events).not.toContain('scroll')
    expect(events).not.toContain('hashchange')
    expect(observer).not.toHaveBeenCalled()

    onWindow.mockRestore()
    onDocument.mockRestore()
    vi.unstubAllGlobals()
  })
})
