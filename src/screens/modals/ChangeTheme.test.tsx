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

describe('Change Theme', () => {
  it('offers all 6 system and custom themes', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Change Theme' })
    const group = within(dialog).getByRole('radiogroup', { name: 'Theme' })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(6)
    expect(within(dialog).getByText('Use System Theme (default)')).toBeInTheDocument()
    expect(within(dialog).getByText('Dark Theme')).toBeInTheDocument()
    expect(within(dialog).getByText('Light Theme')).toBeInTheDocument()
    expect(within(dialog).getByText('Dark Grey Theme')).toBeInTheDocument()
    expect(within(dialog).getByText('Amber Theme')).toBeInTheDocument()
    expect(within(dialog).getByText('Glassmorphism Theme')).toBeInTheDocument()
  })

  it('has no Save: its only action is Close', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Change Theme' })
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

  describe('checks what is stored', () => {
    it.each([
      [null, 'Use System Theme (default)'],
      ['system', 'Use System Theme (default)'],
      ['null', 'Use System Theme (default)'],
      ['garbage', 'Use System Theme (default)'],
      ['light', 'Light Theme'],
      ['dark', 'Dark Theme'],
      ['dark-grey', 'Dark Grey Theme'],
      ['amber', 'Amber Theme'],
      ['glassmorphism', 'Glassmorphism Theme'],
    ])('stored %s checks %s', (stored, label) => {
      if (stored != null) localStorage.setItem('theme', stored)
      open()
      expect(radio(label)).toBeChecked()
      expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1)
    })
  })

  describe('clicking a theme applies and stores it immediately', () => {
    it('Light Theme', async () => {
      mockSystemTheme(true)
      open()
      await userEvent.click(radio('Light Theme'))
      expect(localStorage.getItem('theme')).toBe('light')
      expect(document.documentElement.dataset.theme).toBe('light')
      expect(radio('Light Theme')).toBeChecked()
    })

    it('Dark Grey Theme', async () => {
      open()
      await userEvent.click(radio('Dark Grey Theme'))
      expect(localStorage.getItem('theme')).toBe('dark-grey')
      expect(document.documentElement.dataset.theme).toBe('dark-grey')
      expect(radio('Dark Grey Theme')).toBeChecked()
    })

    it('Amber Theme', async () => {
      open()
      await userEvent.click(radio('Amber Theme'))
      expect(localStorage.getItem('theme')).toBe('amber')
      expect(document.documentElement.dataset.theme).toBe('amber')
      expect(radio('Amber Theme')).toBeChecked()
    })

    it('Glassmorphism Theme', async () => {
      open()
      await userEvent.click(radio('Glassmorphism Theme'))
      expect(localStorage.getItem('theme')).toBe('glassmorphism')
      expect(document.documentElement.dataset.theme).toBe('glassmorphism')
      expect(radio('Glassmorphism Theme')).toBeChecked()
    })

    it('Use System Theme (default) stores system and follows the system', async () => {
      localStorage.setItem('theme', 'light')
      mockSystemTheme(true)
      open()
      await userEvent.click(radio('Use System Theme (default)'))
      expect(localStorage.getItem('theme')).toBe('system')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
  })
})
