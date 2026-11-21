import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell, type ShellSession } from './Shell'
import * as client from '../api/client'
import { forgetRoot } from './route'

/* The side panel as a drawer, on a narrow screen: where the focus goes and how it leaves. */

const SESSION: ShellSession = {
  token: 't',
  displayName: 'Administrator',
  username: 'admin',
  type: 'Local',
  info: { version: '15.6.1', uptimestamp: '2026-11-06T00:00:00Z', dnsServerDomain: 'ns1.test' },
}

function served(path: string, route: string) {
  window.history.replaceState(null, '', path)
  document.head.querySelector('meta[name="route"]')?.remove()
  const meta = document.createElement('meta')
  meta.name = 'route'
  meta.content = route
  document.head.append(meta)
  forgetRoot()
}

/* A narrow window: `(max-width: 900px)` matches, as on a phone. */
function narrow() {
  const matchMedia = (media: string) => ({
    matches: media.includes('max-width: 900px'),
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true, writable: true })
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  delete (window as { matchMedia?: unknown }).matchMedia
  document.head.querySelector('meta[name="route"]')?.remove()
  forgetRoot()
})

function api() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async () => {
    return { kind: 'ok', data: { status: 'ok', response: {} } } as never
  })
}

function setup() {
  served('/about/', 'about')
  narrow()
  api()
  const { container } = render(<Shell session={SESSION} onLogout={() => {}} />)
  const drawer = container.querySelector('aside')!
  const menu = screen.getByRole('button', { name: 'Menu' })
  return { drawer, menu }
}

const tabbable = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(
    (el) => el.tabIndex >= 0,
  )

describe('the drawer', () => {
  it('is out of reach while closed', () => {
    const { drawer } = setup()
    expect(drawer).toHaveAttribute('inert')
  })

  it('takes the focus when it opens', async () => {
    const { drawer, menu } = setup()
    await userEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(drawer).not.toHaveAttribute('inert')
    await waitFor(() => expect(drawer).toContainElement(document.activeElement as HTMLElement))
  })

  it('keeps Tab and Shift+Tab inside it', async () => {
    const { drawer, menu } = setup()
    await userEvent.click(menu)
    await waitFor(() => expect(drawer).toContainElement(document.activeElement as HTMLElement))
    const els = tabbable(drawer)
    els[els.length - 1].focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(els[0])
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(els[els.length - 1])
  })

  it('closes on Escape and gives the focus back to the Menu button', async () => {
    const { menu } = setup()
    await userEvent.click(menu)
    await userEvent.keyboard('{Escape}')
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(menu)
  })

  it('gives the focus back to the Menu button when the veil closes it', async () => {
    const { menu } = setup()
    await userEvent.click(menu)
    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(menu)
  })

  it('leaves an Escape in the account menu to that menu', async () => {
    const { drawer, menu } = setup()
    await userEvent.click(menu)
    const account = screen.getByRole('button', { name: 'Administrator' })
    await userEvent.click(account)
    expect(account).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(account).toHaveAttribute('aria-expanded', 'false')
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(drawer).toContainElement(document.activeElement as HTMLElement)
  })
})
