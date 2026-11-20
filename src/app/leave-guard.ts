import { useEffect, useRef } from 'react'

/*
LEAVING WITH UNSAVED CHANGES (deviation 51, Adrián's decision, 2026-11-20). OURS.

Upstream asks nothing: its Settings, its block list URLs and its DHCP scope form
lose what was typed as soon as another tab is clicked. Here a form with unsaved
changes (Settings, Blocking › Lists, the DHCP scope form) declares a guard, and
every way out asks first, through this one module:

  · the console's own moves: the sidebar, `RouteLink` and `navigateTo`, the
    command palette, the jumps between screens (`app/handoff.ts`), My Profile and
    Logout. They call `guardedLeave` with where they go before going;
  · Back and Forward: the browser has already moved the address bar when it says
    so, with `popstate`. The guard's listener on `window` runs before every
    screen's own `popstate` listener (the Shell's, Zones', DHCP's), stops the
    event there, puts the bar back where the screen still is and asks. Discarding
    walks to where the browser was going. It is added when this module loads,
    before React mounts anything, and not by the Shell: on `window` itself
    Chromium runs the listeners in the order they were added, capture or not, and
    a screen mounted first (a direct load of `/dhcp/scopes/`) adds its own in an
    effect that runs before the Shell's;
  · a reload or closing the tab: the browser's own `beforeunload` prompt, the only
    one a page may show there;
  · a screen's own step that would throw the form away (Settings' node selector)
    calls `guardedLeave(null, …)`.

The question is the console's confirmation (`ui/Confirm`, drawn by
`LeaveConfirm.tsx`), never `window.confirm`.

A guard says which addresses keep the form on screen (`keeps`): moving between
Settings' sub-sections keeps its one form, so that is no way out. Where the console
stands is followed through `history.pushState` and `replaceState`, wrapped while
the Shell is mounted, so that Back can be undone to the exact address, search
included.
*/

type Keeps = (to: string) => boolean

const guards = new Set<{ keeps: { current: Keeps } }>()
let asker: ((go: () => void) => void) | null = null
/* Set while a move that was asked about, or needed no asking, goes ahead. */
let passing = false
/* The address the console stands on: what Back is undone to. */
let here = ''

const address = () => window.location.pathname + window.location.search

/*
The one `popstate` listener, added once per page however many times this module
is evaluated (a hot reload evaluates it again): it hands the event to whatever
`installLeaveGuard` put in `pop`, and does nothing while no Shell is mounted.
*/
type PopHold = { pop: ((e: PopStateEvent) => void) | null }
const POP_HOLD = Symbol.for('technitium-console.leave-guard.popstate')

function popHold(): PopHold {
  const w = window as Window & { [POP_HOLD]?: PopHold }
  let hold = w[POP_HOLD]
  if (hold == null) {
    const created: PopHold = { pop: null }
    window.addEventListener('popstate', (e) => created.pop?.(e), true)
    w[POP_HOLD] = hold = created
  }
  return hold
}

const hold = popHold()

/** Whether going to `to` (`null`: the screen goes whatever the address) would
 *  throw away an unsaved form. */
export function wouldLose(to: string | null): boolean {
  for (const g of guards) if (to == null || !g.keeps.current(to)) return true
  return false
}

function pass(go: () => void): void {
  const was = passing
  passing = true
  try {
    go()
  } finally {
    passing = was
  }
}

/**
 * Runs `go`, the move to `to` (path and search, as `toTrail` writes it; `null`
 * when the screen goes whatever the address, as on Logout), at once when no
 * unsaved form would be lost, and after the user says Discard otherwise.
 */
export function guardedLeave(to: string | null, go: () => void): void {
  if (passing || asker == null || !wouldLose(to)) {
    pass(go)
    return
  }
  asker(() => pass(go))
}

/** A form's guard: while `dirty`, leaving to an address `keeps` refuses asks first,
 *  and a reload or closing the tab gets the browser's own prompt. */
export function useLeaveGuard(dirty: boolean, keeps: Keeps): void {
  const ref = useRef(keeps)
  useEffect(() => {
    ref.current = keeps
  })
  useEffect(() => {
    if (!dirty) return
    const guard = { keeps: ref }
    guards.add(guard)
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Older browsers show the prompt only with a return value.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      guards.delete(guard)
      window.removeEventListener('beforeunload', warn)
    }
  }, [dirty])
}

/**
 * Installed once by the Shell (`LeaveConfirm`): `ask` shows the question and runs
 * the move given on Discard. Returns the uninstall.
 */
export function installLeaveGuard(ask: (go: () => void) => void): () => void {
  asker = ask
  here = address()
  const history = window.history
  const push = history.pushState
  const replace = history.replaceState
  history.pushState = function (...args: Parameters<History['pushState']>) {
    push.apply(this, args)
    here = address()
  }
  history.replaceState = function (...args: Parameters<History['replaceState']>) {
    replace.apply(this, args)
    here = address()
  }
  function onPop(e: PopStateEvent) {
    const to = address()
    if (passing || !wouldLose(to)) {
      here = to
      return
    }
    e.stopImmediatePropagation()
    const back = here
    push.call(history, history.state, '', back)
    ask(() =>
      pass(() => {
        history.pushState(null, '', to)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }),
    )
  }
  hold.pop = onPop
  return () => {
    if (hold.pop === onPop) hold.pop = null
    history.pushState = push
    history.replaceState = replace
    if (asker === ask) asker = null
  }
}
