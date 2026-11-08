import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'
import { applyStoredTheme } from './theme'
import { mockSystemTheme, resetTheme } from '../test/system-theme'

/*
`index.html` carries one `theme-color` per system preference, for the time before
any script runs. From then on the theme is the console's to decide, and a pick that
differs from the system has to reach the browser's bar as well. The tokens are
stand-ins here: what is under test is that the value is read from the theme in
force, not what the value is.
*/
const DARK = '#101010'
const LIGHT = '#fafafa'

let sheet: HTMLStyleElement

beforeEach(() => {
  sheet = document.createElement('style')
  sheet.textContent = `[data-theme='dark'] { --pan: ${DARK}; } [data-theme='light'] { --pan: ${LIGHT}; }`
  document.head.append(sheet)
  for (const media of ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.media = media
    meta.content = 'static'
    document.head.append(meta)
  }
})

afterEach(() => {
  sheet.remove()
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  resetTheme()
})

/** Every `theme-color`, so that whichever `media` matches says the same. */
const painted = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content)

function Picks() {
  const { setChoice } = useTheme()
  return (
    <>
      <button type="button" onClick={() => setChoice('system')}>pick system</button>
      <button type="button" onClick={() => setChoice('light')}>pick light</button>
      <button type="button" onClick={() => setChoice('dark')}>pick dark</button>
    </>
  )
}

const mount = () => render(<ThemeProvider><Picks /></ThemeProvider>)

describe('the theme-color of the browser bar', () => {
  it('follows the stored theme before React mounts, against the system', () => {
    mockSystemTheme(false)
    localStorage.setItem('theme', 'dark')
    applyStoredTheme()
    expect(painted()).toEqual([DARK, DARK])
  })

  it('draws a stored Amber as the dark theme it renders as', () => {
    mockSystemTheme(false)
    localStorage.setItem('theme', 'amber')
    applyStoredTheme()
    expect(painted()).toEqual([DARK, DARK])
  })

  it('changes when the user picks another theme', async () => {
    mockSystemTheme(true)
    mount()
    expect(painted()).toEqual([DARK, DARK])
    await userEvent.click(screen.getByRole('button', { name: 'pick light' }))
    expect(painted()).toEqual([LIGHT, LIGHT])
    await userEvent.click(screen.getByRole('button', { name: 'pick dark' }))
    expect(painted()).toEqual([DARK, DARK])
  })

  it('follows the system live while the choice is System', () => {
    const system = mockSystemTheme(false)
    mount()
    expect(painted()).toEqual([LIGHT, LIGHT])
    system.change(true)
    expect(painted()).toEqual([DARK, DARK])
  })

  it('does not follow the system while an explicit theme is chosen', () => {
    const system = mockSystemTheme(false)
    localStorage.setItem('theme', 'light')
    mount()
    system.change(true)
    expect(painted()).toEqual([LIGHT, LIGHT])
  })

  it('leaves the static values in place when no stylesheet declares the token', () => {
    sheet.remove()
    mockSystemTheme(true)
    applyStoredTheme()
    expect(painted()).toEqual(['static', 'static'])
  })
})
