import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/*
A chrome slot, so that a screen can put a control at the TOP without the chrome
having to know which one.

Why it is needed: the phase 3 design puts the node selector at the top of the
chrome, "because it does not filter a region, it reframes the screen". But the
selector **belongs to the screen**, not to the chrome: the Dashboard remembers its
choice in `dashboardClusterNode` and `Settings` its own in `settingsClusterNode`,
and each offers its own options. A single selector in the chrome would have to
invent a shared memory the console does not have, and would change the behaviour
of eight screens at a stroke.

So the chrome provides **the place** and the screen provides **the control, its
state and its memory**. When the other seven come to migrate, each will bring its
own here without any of them hearing about the others.

## Where the slot is, and why not in a top bar

The design draws it in a top bar at 1440. **This console has no such bar**:
`Shell.module.css:48` leaves it at `display:none` when wide, and that is reasoned
—it measured 1224×52 with 78 % of the width empty and pushed every section title
down to `y=76`. Reviving it to hang a control off would be undoing a measured
decision in order to follow a drawing to the letter.

The slot goes, instead, **above the content and on the left**, which is the
position the drawing gives it relative to what is below. When narrow it sits just
under the bar that does exist.
*/
const Slot = createContext<HTMLElement | null>(null)

export function SlotProvider({
  children,
}: {
  /** Receives the `ref` to hang on the slot. */
  children: (ref: (n: HTMLElement | null) => void) => ReactNode
}) {
  /*
  State and not a `ref`: with a `ref` the first render has no node and whoever
  portals into it never hears that there is one now — there is no re-render to
  report it.
  */
  const [node, setNode] = useState<HTMLElement | null>(null)
  return <Slot.Provider value={node}>{children(setNode)}</Slot.Provider>
}

/** Whatever a screen wants to put there. With no slot yet, it draws nothing. */
export function EnElCromo({ children }: { children: ReactNode }) {
  const node = useContext(Slot)
  if (node == null) return null
  return createPortal(children, node)
}
