import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { installLeaveGuard, useLeaveGuard } from './leave-guard'

/*
Back with unsaved changes is stopped by the guard before any screen hears it,
whatever was mounted first. On `window` itself listeners run in the order they
were added, capture or not (Chromium 156 does so; jsdom runs the capture ones
first, as the DOM standard says), and a screen's effect (DHCP's Scopes, Zones)
runs before the Shell's when the screen is the first thing mounted: so the
guard's listener cannot be added by the Shell. The screen's listener is added in
both phases here, so that jsdom stands for Chromium too.
*/

const settle = () => new Promise((r) => setTimeout(r, 50))

let cleanup: (() => void)[] = []
afterEach(() => {
  for (const c of cleanup.reverse()) c()
  cleanup = []
})

describe('leave guard: Back', () => {
  it.each([false, true])('stops Back before a screen listener added before the Shell installed the guard (capture: %s)', async (capture) => {
    window.history.replaceState(null, '', '/dhcp/scopes/')
    window.history.pushState(null, '', '/dhcp/scopes/?scope=Default')

    /* The screen's own listener, as Scopes adds it in its effect, goes first. */
    const screenHeard = vi.fn()
    window.addEventListener('popstate', screenHeard, capture)
    cleanup.push(() => window.removeEventListener('popstate', screenHeard, capture))

    const ask = vi.fn()
    cleanup.push(installLeaveGuard(ask))
    const form = renderHook(() => useLeaveGuard(true, () => false))
    cleanup.push(form.unmount)

    window.history.back()
    await settle()

    expect(ask).toHaveBeenCalledTimes(1)
    expect(screenHeard).not.toHaveBeenCalled()
    expect(window.location.pathname + window.location.search).toBe('/dhcp/scopes/?scope=Default')

    /* Discard goes where Back was going, and the screen hears it then. */
    ask.mock.calls[0][0]()
    expect(window.location.pathname + window.location.search).toBe('/dhcp/scopes/')
    expect(screenHeard).toHaveBeenCalledTimes(1)
  })

  it('lets Back through to the screens when nothing would be lost', async () => {
    window.history.replaceState(null, '', '/zones/')
    window.history.pushState(null, '', '/zones/?zone=example.test')
    const screenHeard = vi.fn()
    window.addEventListener('popstate', screenHeard)
    cleanup.push(() => window.removeEventListener('popstate', screenHeard))
    const ask = vi.fn()
    cleanup.push(installLeaveGuard(ask))

    window.history.back()
    await settle()

    expect(ask).not.toHaveBeenCalled()
    expect(screenHeard).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('')
  })
})
