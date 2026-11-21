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
import styles from './DomainName.module.css'

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

  it('keeps a name with no dot whole, hyphens included, as one piece', () => {
    for (const name of ['<root>', '@', 'localhost', 'living-room-tv']) {
      const { container, unmount } = render(<DomainName name={name} />)
      const pieces = [...container.querySelectorAll('span')].map((s) => s.textContent)
      expect(pieces).toEqual([name])
      expect(container.querySelector('wbr')).toBeNull()
      unmount()
    }
  })

  it('lets only a label too long for a line wrap inside itself, at its hyphens first', () => {
    const long = 'a-very-long-hostname-for-the-living-room-television-in-the-hall'
    const { container } = render(<DomainName name={`${long}.example.net`} />)
    const pieces = [...container.querySelectorAll('span')]
    expect(pieces.map((s) => s.textContent)).toEqual([`${long}.`, 'example.', 'net'])
    expect(pieces[0]).toHaveClass(styles.long)
    expect(pieces[0]).not.toHaveClass(styles.label)
    for (const short of pieces.slice(1)) expect(short).toHaveClass(styles.label)
    expect(container.textContent).toBe(`${long}.example.net`)

    const { container: one } = render(<DomainName name={long} />)
    expect(one.querySelector('span')).toHaveClass(styles.long)
    /* Up to 32 characters a label is still one piece: `in-addr` is never cut. */
    const { container: edge } = render(<DomainName name={'x'.repeat(32)} />)
    expect(edge.querySelector('span')).toHaveClass(styles.label)
  })

  it('leaves the root and an empty name as plain text', () => {
    for (const name of ['.', '']) {
      const { container, unmount } = render(<DomainName name={name} />)
      expect(container.querySelector('span')).toBeNull()
      expect(container.textContent).toBe(name)
      unmount()
    }
  })
})
