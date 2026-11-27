import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangeTimezone } from './ChangeTimezone'
import { DEFAULT_TIMEZONE, TIMEZONE_KEY, getTimezone, setTimezone } from '../../lib/timezone'

beforeEach(() => {
  localStorage.clear()
  setTimezone(DEFAULT_TIMEZONE)
})

function open(onOpenChange: (o: boolean) => void = () => {}) {
  return render(<ChangeTimezone open onOpenChange={onOpenChange} />)
}

const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(name) })

describe('ChangeTimezone modal', () => {
  it('renders title, group label, and timezone options', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Display Timezone' })
    expect(dialog).toBeInTheDocument()

    const group = within(dialog).getByRole('radiogroup', { name: 'Timezone' })
    expect(group).toBeInTheDocument()

    const radios = within(group).getAllByRole('radio')
    expect(radios.length).toBeGreaterThanOrEqual(13)
  })

  it('defaults to Browser Local Time checked', () => {
    open()
    expect(radio('Browser Local Time')).toBeChecked()
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1)
  })

  it('clicking a timezone radio updates active selection and localStorage', async () => {
    open()
    const istRadio = radio('IST - India Standard Time')
    await userEvent.click(istRadio)

    expect(istRadio).toBeChecked()
    expect(getTimezone()).toBe('Asia/Kolkata')
    expect(localStorage.getItem(TIMEZONE_KEY)).toBe('Asia/Kolkata')

    const utcRadio = radio('UTC - Coordinated Universal Time')
    await userEvent.click(utcRadio)

    expect(utcRadio).toBeChecked()
    expect(getTimezone()).toBe('UTC')
    expect(localStorage.getItem(TIMEZONE_KEY)).toBe('UTC')
  })

  it('reflects previously stored timezone on open', () => {
    localStorage.setItem(TIMEZONE_KEY, 'America/New_York')
    setTimezone('America/New_York')
    open()

    expect(radio('US Eastern - New York')).toBeChecked()
  })
})
