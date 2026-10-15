/*
A domain name wraps at its dots and reads as the name the server sent.

jsdom does not lay text out, so what is checked here is the DOM that decides the
wrapping: one piece per label with its dot, a `<wbr>` after each dot and nowhere
else. And what a person or a screen reader gets out of it, which must be the
name untouched.
*/
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DomainName } from './DomainName'

describe('a domain name', () => {
  it('is one piece per label, with a break opportunity only after each dot', () => {
    const { container } = render(<DomainName name="0.30.172.in-addr.arpa" />)
    const pieces = [...container.querySelectorAll('span')].map((s) => s.textContent)
    expect(pieces).toEqual(['0.', '30.', '172.', 'in-addr.', 'arpa'])
    expect(container.querySelectorAll('wbr')).toHaveLength(4)
    expect(container.textContent).toBe('0.30.172.in-addr.arpa')
  })

  it('keeps the accessible name of the control that holds it', () => {
    render(
      <button type="button">
        <DomainName name="example.net" />
      </button>,
    )
    expect(screen.getByRole('button', { name: 'example.net' })).toBeInTheDocument()
  })

  it('leaves a name with no dot, and the root, as plain text', () => {
    for (const name of ['<root>', '@', 'localhost', '.']) {
      const { container, unmount } = render(<DomainName name={name} />)
      expect(container.querySelector('span')).toBeNull()
      expect(container.textContent).toBe(name)
      unmount()
    }
  })
})
