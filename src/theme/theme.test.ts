import { beforeEach, describe, expect, it } from 'vitest'
import {
  KNOWN,
  THEME_KEY,
  applyTheme,
  readChoice,
  resolveTheme,
  writeChoice,
} from './theme'

describe('theme library', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('KNOWN includes all system and custom themes', () => {
    expect(KNOWN).toEqual([
      'system',
      'light',
      'dark',
      'dark-grey',
      'amber',
      'glassmorphism',
    ])
  })

  it('readChoice reads valid stored themes and returns null for unrecognized ones', () => {
    expect(readChoice()).toBeNull()

    for (const t of KNOWN) {
      localStorage.setItem(THEME_KEY, t)
      expect(readChoice()).toBe(t)
    }

    localStorage.setItem(THEME_KEY, 'unknown-theme')
    expect(readChoice()).toBeNull()
  })

  it('writeChoice saves theme to localStorage', () => {
    writeChoice('dark-grey')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark-grey')

    writeChoice('glassmorphism')
    expect(localStorage.getItem(THEME_KEY)).toBe('glassmorphism')
  })

  describe('resolveTheme', () => {
    it('resolves explicit choices regardless of system preference', () => {
      expect(resolveTheme('light', true)).toBe('light')
      expect(resolveTheme('light', false)).toBe('light')

      expect(resolveTheme('dark', true)).toBe('dark')
      expect(resolveTheme('dark', false)).toBe('dark')

      expect(resolveTheme('dark-grey', true)).toBe('dark-grey')
      expect(resolveTheme('amber', false)).toBe('amber')
      expect(resolveTheme('glassmorphism', true)).toBe('glassmorphism')
    })

    it('resolves system or null to system preference', () => {
      expect(resolveTheme('system', true)).toBe('dark')
      expect(resolveTheme('system', false)).toBe('light')

      expect(resolveTheme(null, true)).toBe('dark')
      expect(resolveTheme(null, false)).toBe('light')
    })
  })

  describe('applyTheme', () => {
    it('sets dataset.theme and colorScheme on documentElement', () => {
      applyTheme('light')
      expect(document.documentElement.dataset.theme).toBe('light')
      expect(document.documentElement.style.colorScheme).toBe('light')

      applyTheme('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(document.documentElement.style.colorScheme).toBe('dark')

      applyTheme('dark-grey')
      expect(document.documentElement.dataset.theme).toBe('dark-grey')
      expect(document.documentElement.style.colorScheme).toBe('dark')

      applyTheme('amber')
      expect(document.documentElement.dataset.theme).toBe('amber')
      expect(document.documentElement.style.colorScheme).toBe('dark')

      applyTheme('glassmorphism')
      expect(document.documentElement.dataset.theme).toBe('glassmorphism')
      expect(document.documentElement.style.colorScheme).toBe('dark')
    })
  })
})
