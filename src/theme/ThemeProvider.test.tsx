import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'
import { applyStoredTheme, readChoice } from './theme'
import { mockSystemTheme, resetTheme } from '../test/system-theme'

afterEach(() => {
  vi.restoreAllMocks()
  resetTheme()
})

const theme = () => document.documentElement.dataset.theme

/** Shows what the context says and offers the three picks, as the dialog does. */
function Probe() {
  const { choice, resolved, setChoice } = useTheme()
  return (
    <>
      <output aria-label="choice">{String(choice)}</output>
      <output aria-label="resolved">{resolved}</output>
      <button type="button" onClick={() => setChoice('system')}>pick system</button>
      <button type="button" onClick={() => setChoice('light')}>pick light</button>
      <button type="button" onClick={() => setChoice('dark')}>pick dark</button>
    </>
  )
}

const mount = () => render(<ThemeProvider><Probe /></ThemeProvider>)

describe('the stored theme (main.js:3208-3263)', () => {
  it('reads the four values upstream writes, under its own key', () => {
    for (const value of ['system', 'light', 'dark', 'amber']) {
      localStorage.setItem('theme', value)
      expect(readChoice()).toBe(value)
    }
  })

  it('treats a missing value, the string null and garbage as nothing stored', () => {
    expect(readChoice()).toBeNull()
    for (const value of ['null', 'Dark', 'blue', '']) {
      localStorage.setItem('theme', value)
      expect(readChoice()).toBeNull()
    }
  })

  it('draws light and dark as stored, whatever the system prefers', () => {
    mockSystemTheme(true)
    localStorage.setItem('theme', 'light')
    expect(applyStoredTheme()).toBe('light')
    expect(theme()).toBe('light')

    mockSystemTheme(false)
    localStorage.setItem('theme', 'dark')
    expect(applyStoredTheme()).toBe('dark')
    expect(theme()).toBe('dark')
  })

  it('draws a stored amber as dark and leaves the value alone', () => {
    mockSystemTheme(false)
    localStorage.setItem('theme', 'amber')
    mount()
    expect(theme()).toBe('dark')
    expect(screen.getByLabelText('choice')).toHaveTextContent('amber')
    expect(localStorage.getItem('theme')).toBe('amber')
  })

  it('follows the system for system, null and garbage', () => {
    for (const value of ['system', 'null', 'garbage']) {
      localStorage.setItem('theme', value)
      mockSystemTheme(true)
      expect(applyStoredTheme()).toBe('dark')
      mockSystemTheme(false)
      expect(applyStoredTheme()).toBe('light')
    }
  })

  it('sets color-scheme with the theme, for the browser parts of the page', () => {
    localStorage.setItem('theme', 'light')
    applyStoredTheme()
    expect(document.documentElement.style.colorScheme).toBe('light')
    localStorage.setItem('theme', 'dark')
    applyStoredTheme()
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('does not write on load, not even the null upstream writes by accident', () => {
    mockSystemTheme(true)
    applyStoredTheme()
    mount()
    expect(localStorage.getItem('theme')).toBeNull()

    localStorage.setItem('theme', 'garbage')
    applyStoredTheme()
    mount()
    expect(localStorage.getItem('theme')).toBe('garbage')
  })

  it('without matchMedia it draws light, as upstream with no class applied', () => {
    expect(applyStoredTheme()).toBe('light')
    mount()
    expect(theme()).toBe('light')
  })

  /* The spies go on the prototype of whatever `localStorage` is: jsdom's Storage
     turns a property defined on the instance into a stored item, so a spy there
     never runs (Node 22), and Node 25+ brings a native Storage of its own. */
  it('a storage that refuses access does not stop the page from drawing', () => {
    localStorage.setItem('theme', 'light')
    mockSystemTheme(true)
    const getItem = vi.spyOn(Object.getPrototypeOf(localStorage) as Storage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(applyStoredTheme()).toBe('dark')
    mount()
    expect(getItem).toHaveBeenCalledWith('theme')
    expect(theme()).toBe('dark')
  })

  it('a pick that cannot be stored still applies to the page', async () => {
    mockSystemTheme(true)
    const setItem = vi.spyOn(Object.getPrototypeOf(localStorage) as Storage, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'pick light' }))
    expect(setItem).toHaveBeenCalledWith('theme', 'light')
    expect(theme()).toBe('light')
  })
})

describe('the system theme, live', () => {
  it('follows a change of the system while nothing explicit is stored', () => {
    const system = mockSystemTheme(false)
    mount()
    expect(theme()).toBe('light')

    system.change(true)
    expect(theme()).toBe('dark')
    expect(screen.getByLabelText('resolved')).toHaveTextContent('dark')

    system.change(false)
    expect(theme()).toBe('light')
  })

  it('follows it for a stored system too', () => {
    localStorage.setItem('theme', 'system')
    const system = mockSystemTheme(true)
    mount()
    system.change(false)
    expect(theme()).toBe('light')
  })

  it('ignores it while light, dark or amber is stored', () => {
    for (const [value, drawn] of [['light', 'light'], ['dark', 'dark'], ['amber', 'dark']]) {
      localStorage.setItem('theme', value)
      const system = mockSystemTheme(drawn === 'light')
      const { unmount } = mount()
      system.change(drawn !== 'light')
      expect(theme()).toBe(drawn)
      unmount()
    }
  })

  it('stops listening when it unmounts', () => {
    const system = mockSystemTheme(false)
    const { unmount } = mount()
    expect(system.listeners.size).toBe(1)
    unmount()
    expect(system.listeners.size).toBe(0)
  })
})

describe('a pick', () => {
  it('is stored exactly as upstream stores it and applied at once', async () => {
    mockSystemTheme(true)
    mount()
    expect(theme()).toBe('dark')

    await userEvent.click(screen.getByRole('button', { name: 'pick light' }))
    expect(localStorage.getItem('theme')).toBe('light')
    expect(theme()).toBe('light')

    await userEvent.click(screen.getByRole('button', { name: 'pick dark' }))
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(theme()).toBe('dark')

    await userEvent.click(screen.getByRole('button', { name: 'pick system' }))
    expect(localStorage.getItem('theme')).toBe('system')
    expect(theme()).toBe('dark')
  })

  it('of light stops following the system, and system starts again', async () => {
    const system = mockSystemTheme(false)
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'pick light' }))
    system.change(true)
    expect(theme()).toBe('light')

    await userEvent.click(screen.getByRole('button', { name: 'pick system' }))
    expect(theme()).toBe('dark')
  })

  it('replaces a stored amber', async () => {
    localStorage.setItem('theme', 'amber')
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'pick light' }))
    expect(localStorage.getItem('theme')).toBe('light')
    expect(screen.getByLabelText('choice')).toHaveTextContent('light')
  })
})
