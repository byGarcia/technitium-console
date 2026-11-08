import type { MouseEventHandler, ReactNode } from 'react'
import { navigateTo, plainClick, toTrail, type Route } from '../app/route'
import styles from './Button.module.css'
import { Icon, type IconName } from './Icon'

/*
A link from inside a screen to another section of the console: Recently Blocked's
"Open Query Logs", Lists' "Settings › Blocking".

It is a real `<a>` with the real address (it can be copied, and a modifier or
middle click opens it in another tab, which is what the routes existing as folders
is for), and a plain click moves the console without reloading it, the way the
sidebar and the sub-tabs already do. A bare `<a href>` reloaded the whole console
and threw away every screen's state on the way.

`search` is what comes after the path, `?` included. Without it a plain click keeps
what the bar holds, and with it (`''` too) the bar says exactly that, so the filters
of a list do not travel to the page it opens. `onClick` runs on every click, a
modifier click too: a menu has to close whichever way it was left.
*/
export function RouteLink({
  to,
  search,
  className,
  onClick,
  children,
}: {
  to: Route
  search?: string
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children: ReactNode
}) {
  return (
    <a
      href={toTrail(to) + (search ?? '')}
      className={className}
      onClick={(e) => {
        onClick?.(e)
        if (!plainClick(e)) return
        e.preventDefault()
        navigateTo(to, search)
      }}
    >
      {children}
    </a>
  )
}

/*
A row's labelled action that goes somewhere: the small `ui/Button` with its lead
icon, and underneath a real link, so it opens in another tab like any other address
of the console.
*/
export function RouteButton({
  to,
  search,
  lead,
  children,
}: {
  to: Route
  search?: string
  lead: IconName
  children: ReactNode
}) {
  return (
    <RouteLink to={to} search={search} className={`${styles.btn} ${styles.sm}`}>
      <span className={styles.lead}>
        <Icon name={lead} size={15} />
      </span>
      {children}
    </RouteLink>
  )
}
