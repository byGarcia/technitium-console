import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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

  it('the index carries a name for whoever cannot see the screen', () => {
    render(<SectionIndex sections={SECTIONS} />)
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument()
  })

  it('the name can be changed', () => {
    render(<SectionIndex sections={SECTIONS} label="Settings sections" />)
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument()
  })
})

/*
As a strip wider than the screen, the entry you are in can be out of sight: the
strip rolls itself to it, and only itself, never the page.
*/
describe('SectionIndex: the strip keeps the active entry in view', () => {
  function overflowing(nav: HTMLElement) {
    Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: 1000 })
    Object.defineProperty(nav, 'clientWidth', { configurable: true, value: 300 })
    nav.getBoundingClientRect = () => ({ left: 0 }) as DOMRect
    for (const [i, a] of [...nav.querySelectorAll('a')].entries()) {
      Object.defineProperty(a, 'offsetWidth', { configurable: true, value: 100 })
      a.getBoundingClientRect = () => ({ left: i * 120 }) as DOMRect
    }
    const roll = vi.fn()
    nav.scrollTo = roll as unknown as HTMLElement['scrollTo']
    return roll
  }

  it('rolls the strip, centred, smoothly, and does not move the page', () => {
    const page = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { rerender } = render(<SectionIndex sections={SECTIONS} active={SECTIONS[0].id} strip />)
    const roll = overflowing(screen.getByRole('navigation'))
    const last = SECTIONS[SECTIONS.length - 1]
    rerender(<SectionIndex sections={SECTIONS} active={last.id} strip />)
    const left = (SECTIONS.length - 1) * 120 - (300 - 100) / 2
    expect(roll).toHaveBeenCalledWith({ left, behavior: 'smooth' })
    expect(page).not.toHaveBeenCalled()
    page.mockRestore()
  })

  it('does not move for an entry already in view, and moves instantly with reduced motion', () => {
    const { rerender } = render(<SectionIndex sections={SECTIONS} active={SECTIONS[2].id} strip />)
    const roll = overflowing(screen.getByRole('navigation'))
    rerender(<SectionIndex sections={SECTIONS} active={SECTIONS[1].id} strip />)
    expect(roll).not.toHaveBeenCalled()

    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    rerender(<SectionIndex sections={SECTIONS} active={SECTIONS[SECTIONS.length - 1].id} strip />)
    expect(roll).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
    vi.unstubAllGlobals()
  })
})
