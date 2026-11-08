import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GeneralPanel } from './GeneralPanel'
import type { Problem } from './validate'

function problem(field: string, message: string, severity: Problem['severity'] = 'error'): Problem {
  return { target: 'general', field, message, severity, section: 'General' }
}

function draw(over: Partial<Parameters<typeof GeneralPanel>[0]> = {}) {
  const props = { enabled: true, ttl: '30', hours: '24', minutes: '0', problems: [] as Problem[], showProblems: false, onChange: vi.fn(), ...over }
  return { props, ...render(<GeneralPanel {...props} />) }
}

describe('GeneralPanel', () => {
  it('has the panel and its help', () => {
    draw()
    expect(screen.getByRole('group', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByText('Turns the whole app on or off. With it off, no group blocks anything.')).toBeInTheDocument()
    expect(screen.getByText('How long clients may keep a blocked answer.')).toBeInTheDocument()
    expect(screen.getByText('How often the app downloads the list URLs of every group again.')).toBeInTheDocument()
  })

  it('shows the values it is given, each with its unit', () => {
    draw({ enabled: false, ttl: '60', hours: '12', minutes: '30' })
    expect(screen.getByLabelText('Enable Blocking')).not.toBeChecked()
    expect(screen.getByLabelText('Blocked Answer TTL')).toHaveValue('60')
    expect(screen.getByLabelText('Hours')).toHaveValue('12')
    expect(screen.getByLabelText('Minutes')).toHaveValue('30')
    expect(screen.getByText('seconds (default 30)')).toBeInTheDocument()
    expect(screen.getByText('hours')).toBeInTheDocument()
    expect(screen.getByText('minutes (default 24 hours)')).toBeInTheDocument()
  })

  it('lets the row label reach the hours field', () => {
    draw()
    expect(screen.getByLabelText('Update Lists Every')).toBe(screen.getByLabelText('Hours'))
  })

  it('reports each edit as a patch of that field alone', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByLabelText('Enable Blocking'))
    expect(props.onChange).toHaveBeenLastCalledWith({ enabled: false })
    fireEvent.change(screen.getByLabelText('Blocked Answer TTL'), { target: { value: '45' } })
    expect(props.onChange).toHaveBeenLastCalledWith({ ttl: '45' })
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '6' } })
    expect(props.onChange).toHaveBeenLastCalledWith({ hours: '6' })
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '15' } })
    expect(props.onChange).toHaveBeenLastCalledWith({ minutes: '15' })
  })

  it('passes on what was typed as it is, leaving the verdict to the checks', () => {
    const { props } = draw()
    fireEvent.change(screen.getByLabelText('Blocked Answer TTL'), { target: { value: '1.5x' } })
    expect(props.onChange).toHaveBeenLastCalledWith({ ttl: '1.5x' })
  })

  it('gives each control its id, with no message or invalid state without problems', () => {
    draw()
    const expected = [['Blocked Answer TTL', 'ab-general-ttl'], ['Hours', 'ab-general-hours'], ['Minutes', 'ab-general-minutes']]
    for (const [label, id] of expected) {
      const c = screen.getByLabelText(label)
      expect(c).toHaveAttribute('id', id)
      expect(c).not.toHaveAttribute('aria-invalid')
      expect(c).not.toHaveAttribute('aria-describedby')
    }
  })

  it('holds errors back until showProblems', () => {
    draw({ problems: [problem('ttl', 'Enter a whole number.')] })
    expect(screen.queryByText('Enter a whole number.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Blocked Answer TTL')).not.toHaveAttribute('aria-invalid')
  })

  it.each([
    ['ttl', 'Blocked Answer TTL'],
    ['hours', 'Hours'],
    ['minutes', 'Minutes'],
  ])('draws an error of %s under its control and ties them together', (field, label) => {
    draw({ showProblems: true, problems: [problem(field, 'Enter a whole number.')] })
    const control = screen.getByLabelText(label)
    const message = document.getElementById(`ab-general-${field}-error`)
    expect(message).toHaveTextContent('Enter a whole number.')
    expect(control.parentElement?.nextElementSibling).toBe(message)
    expect(control).toHaveAttribute('aria-describedby', `ab-general-${field}-error`)
    expect(control).toHaveAttribute('aria-invalid', 'true')
  })

  it('always shows a warning, without marking the control invalid', () => {
    draw({ problems: [problem('minutes', 'The lists would be downloaded every minute.', 'warning')] })
    const control = screen.getByLabelText('Minutes')
    expect(document.getElementById('ab-general-minutes-error')).toHaveTextContent('The lists would be downloaded every minute.')
    expect(control).toHaveAttribute('aria-describedby', 'ab-general-minutes-error')
    expect(control).not.toHaveAttribute('aria-invalid')
  })

  it('ignores the problems of another target', () => {
    draw({ showProblems: true, problems: [{ target: 'r1', field: 'ttl', message: 'Not mine.', severity: 'error', section: 'Clients' }] })
    expect(screen.queryByText('Not mine.')).not.toBeInTheDocument()
  })
})
