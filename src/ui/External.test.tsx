import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { External } from './External'

/* Some destinations come from the server, such as the update feed's links. Only
   the web's own schemes become a link; anything else is shown, not followed. */
describe('External', () => {
  it('links an https destination in a new tab', () => {
    render(<External href="https://example.test/notes">Read Change Logs</External>)
    const link = screen.getByRole('link', { name: 'Read Change Logs' })
    expect(link).toHaveAttribute('href', 'https://example.test/notes')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('links an http destination', () => {
    render(<External href="http://example.test/">Download Now!</External>)
    expect(screen.getByRole('link', { name: 'Download Now!' })).toHaveAttribute('href', 'http://example.test/')
  })

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'file:///etc/passwd'])(
    'does not link %s',
    (href) => {
      render(<External href={href}>Download Now!</External>)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByText('Download Now!')).toBeInTheDocument()
    },
  )
})
