import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RouteLink } from './RouteLink'
import { forgetRoot } from '../app/route'

afterEach(() => {
  window.history.replaceState(null, '', '/')
  forgetRoot()
  vi.restoreAllMocks()
})

/*
What the browser would have done with the click once React is through with it.
jsdom does not navigate on its own, so whether the application took the click is
read from `defaultPrevented`, at the window, after React's handler ran.
*/
function clickAndSee(link: HTMLElement, init: MouseEventInit = {}): boolean {
  let prevented = false
  const seen = (e: Event) => {
    prevented = e.defaultPrevented
    e.preventDefault()
  }
  window.addEventListener('click', seen)
  fireEvent.click(link, init)
  window.removeEventListener('click', seen)
  return prevented
}

describe('RouteLink', () => {
  it('is a real link, with the address it goes to', () => {
    render(<RouteLink to={{ section: 'logs', sub: 'Query Logs' }}>Open Query Logs</RouteLink>)
    expect(screen.getByRole('link', { name: 'Open Query Logs' })).toHaveAttribute('href', '/logs/query-logs/')
  })

  it('a plain click navigates inside the console and fires popstate', () => {
    const heard = vi.fn()
    window.addEventListener('popstate', heard)
    render(<RouteLink to={{ section: 'logs', sub: 'Query Logs' }}>Open Query Logs</RouteLink>)
    const prevented = clickAndSee(screen.getByRole('link', { name: 'Open Query Logs' }))
    window.removeEventListener('popstate', heard)
    expect(prevented).toBe(true)
    expect(window.location.pathname).toBe('/logs/query-logs/')
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('a ctrl-click is left to the browser', () => {
    const heard = vi.fn()
    window.addEventListener('popstate', heard)
    render(<RouteLink to={{ section: 'logs', sub: 'Query Logs' }}>Open Query Logs</RouteLink>)
    const prevented = clickAndSee(screen.getByRole('link', { name: 'Open Query Logs' }), { ctrlKey: true })
    window.removeEventListener('popstate', heard)
    expect(prevented).toBe(false)
    expect(window.location.pathname).toBe('/')
    expect(heard).not.toHaveBeenCalled()
  })
})
