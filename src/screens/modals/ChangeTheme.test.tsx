import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangeTheme } from './ChangeTheme'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { mockSystemTheme, resetTheme } from '../../test/system-theme'

afterEach(() => {
  vi.restoreAllMocks()
  resetTheme()
})

function open(onOpenChange: (o: boolean) => void = () => {}) {
  return render(
    <ThemeProvider>
      <ChangeTheme open onOpenChange={onOpenChange} />
    </ThemeProvider>,
  )
}

const radio = (name: string) => screen.getByRole('radio', { name })

describe('Change Theme (index.html:3818-3862)', () => {
  it('has upstream title, group label and radio texts, without Amber', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Change Theme' })
    const group = within(dialog).getByRole('radiogroup', { name: 'Theme' })
    expect(within(group).getAllByRole('radio').map((r) => r.closest('label')?.textContent?.trim())).toEqual([
      'Use System Theme (default)',
      'Light Theme',
      'Dark Theme',
    ])
    expect(within(dialog).queryByText('Amber Theme')).not.toBeInTheDocument()
  })

  it('has no Save: its only action is Close', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Change Theme' })
    /* The corner cross and the footer button are both named Close. */
    expect(within(dialog).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Close',
      'Close',
    ])
  })

  it('Close closes it', async () => {
    const onOpenChange = vi.fn()
    open(onOpenChange)
    const dialog = screen.getByRole('dialog', { name: 'Change Theme' })
    const footer = within(dialog).getAllByRole('button', { name: 'Close' }).find((b) => b.textContent === 'Close')!
    await userEvent.click(footer)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  describe('checks what is stored, as showChangeThemeModal does', () => {
    it.each([
      [null, 'Use System Theme (default)'],
      ['system', 'Use System Theme (default)'],
      ['null', 'Use System Theme (default)'],
      ['garbage', 'Use System Theme (default)'],
      ['light', 'Light Theme'],
      ['dark', 'Dark Theme'],
    ])('stored %s checks %s', (stored, label) => {
      if (stored != null) localStorage.setItem('theme', stored)
      open()
      expect(radio(label)).toBeChecked()
      expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1)
    })

    it('a stored amber checks none, since Amber is not offered', () => {
      localStorage.setItem('theme', 'amber')
      open()
      for (const r of screen.getAllByRole('radio')) expect(r).not.toBeChecked()
    })
  })

  describe('a click applies at once and stores it', () => {
    it('Light Theme', async () => {
      mockSystemTheme(true)
      open()
      await userEvent.click(radio('Light Theme'))
      expect(localStorage.getItem('theme')).toBe('light')
      expect(document.documentElement.dataset.theme).toBe('light')
      expect(radio('Light Theme')).toBeChecked()
      expect(screen.getByRole('dialog', { name: 'Change Theme' })).toBeInTheDocument()
    })

    it('Dark Theme', async () => {
      mockSystemTheme(false)
      open()
      await userEvent.click(radio('Dark Theme'))
      expect(localStorage.getItem('theme')).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('Use System Theme (default) stores system and follows the system', async () => {
      localStorage.setItem('theme', 'light')
      mockSystemTheme(true)
      open()
      await userEvent.click(radio('Use System Theme (default)'))
      expect(localStorage.getItem('theme')).toBe('system')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('from a stored amber, any pick replaces it', async () => {
      localStorage.setItem('theme', 'amber')
      open()
      await userEvent.click(radio('Dark Theme'))
      expect(localStorage.getItem('theme')).toBe('dark')
      expect(radio('Dark Theme')).toBeChecked()
    })
  })
})
