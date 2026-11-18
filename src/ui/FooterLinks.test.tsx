import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeContext } from '../theme/useTheme'
import { FooterLinks } from './FooterLinks'
import { GARCIA_THEME_CREDIT, VARUN_THEME_CREDIT, getThemeCredit } from '../app/footer'

describe('FooterLinks theme credit', () => {
  it('correctly maps theme choice to theme credit author', () => {
    expect(getThemeCredit('system')).toEqual(GARCIA_THEME_CREDIT)
    expect(getThemeCredit('dark')).toEqual(GARCIA_THEME_CREDIT)
    expect(getThemeCredit('light')).toEqual(GARCIA_THEME_CREDIT)
    expect(getThemeCredit('dark-grey')).toEqual(VARUN_THEME_CREDIT)
    expect(getThemeCredit('amber')).toEqual(VARUN_THEME_CREDIT)
    expect(getThemeCredit('glassmorphism')).toEqual(VARUN_THEME_CREDIT)
    expect(getThemeCredit(null)).toEqual(GARCIA_THEME_CREDIT)
  })

  it('renders byGarcia credit when standard dark theme is active', () => {
    render(
      <ThemeContext.Provider value={{ choice: 'dark', resolved: 'dark', setChoice: () => {} }}>
        <FooterLinks />
      </ThemeContext.Provider>,
    )

    const creditLink = screen.getByRole('link', { name: 'byGarcia on GitHub' })
    expect(creditLink).toHaveAttribute('href', 'https://github.com/byGarcia')
    expect(creditLink).toHaveTextContent('byGarcia')
  })

  it('renders byVarun credit when custom dark-grey theme is active', () => {
    render(
      <ThemeContext.Provider value={{ choice: 'dark-grey', resolved: 'dark-grey', setChoice: () => {} }}>
        <FooterLinks />
      </ThemeContext.Provider>,
    )

    const creditLink = screen.getByRole('link', { name: 'byVarun on GitHub' })
    expect(creditLink).toHaveAttribute('href', 'https://github.com/varunagarwal-pro')
    expect(creditLink).toHaveTextContent('byVarun')
  })

  it('renders byVarun credit when custom amber theme is active', () => {
    render(
      <ThemeContext.Provider value={{ choice: 'amber', resolved: 'amber', setChoice: () => {} }}>
        <FooterLinks />
      </ThemeContext.Provider>,
    )

    const creditLink = screen.getByRole('link', { name: 'byVarun on GitHub' })
    expect(creditLink).toHaveAttribute('href', 'https://github.com/varunagarwal-pro')
    expect(creditLink).toHaveTextContent('byVarun')
  })

  it('renders byVarun credit when custom glassmorphism theme is active', () => {
    render(
      <ThemeContext.Provider value={{ choice: 'glassmorphism', resolved: 'glassmorphism', setChoice: () => {} }}>
        <FooterLinks />
      </ThemeContext.Provider>,
    )

    const creditLink = screen.getByRole('link', { name: 'byVarun on GitHub' })
    expect(creditLink).toHaveAttribute('href', 'https://github.com/varunagarwal-pro')
    expect(creditLink).toHaveTextContent('byVarun')
  })
})
