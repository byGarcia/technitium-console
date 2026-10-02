import type { ReactNode } from 'react'
import { navigateTo, plainClick, toTrail, type Route } from '../app/route'

/*
A link from inside a screen to another section of the console: Recently Blocked's
"Open Query Logs", Lists' "Settings › Blocking".

It is a real `<a>` with the real address (it can be copied, and a modifier or
middle click opens it in another tab, which is what the routes existing as folders
is for), and a plain click moves the console without reloading it, the way the
sidebar and the sub-tabs already do. A bare `<a href>` reloaded the whole console
and threw away every screen's state on the way.
*/
export function RouteLink({ to, children }: { to: Route; children: ReactNode }) {
  return (
    <a
      href={toTrail(to)}
      onClick={(e) => {
        if (!plainClick(e)) return
        e.preventDefault()
        navigateTo(to)
      }}
    >
      {children}
    </a>
  )
}
