import { toTrail } from '../app/route'
import styles from './SubTabs.module.css'

/*
The sub-navigation of a section: `View Logs · Query Logs`, the nine panes of
`Settings`, the six screens of `Administration`, `Leases · Scopes`.

## Why it exists, and where it was

It lived in the sidebar, nested under its section, and the three accepted
deliveries put it **under the title** instead. Pilot 3 says so and reasons it:
the 60 px rail hides the labels below 1180 px, so nine sub-panes nested there run
out of room — "taking them out of the sidebar fixes something pilot 1 broke". The
two phase 3 deliveries draw the same shape for Administration and for Logs.

What the sidebar gets back is its own shape: **twelve entries, always the same
twelve**, instead of fourteen, eighteen or twenty-one depending on where you are.

## Links, not buttons

Each tab is a real `<a>` with the route it goes to, exactly like the sidebar: it
survives a modifier click, it can be copied, it can be opened in another tab. That
is what the routes existing as folders is for. A plain click is intercepted so
there is no reload.

`aria-current="page"` and not `aria-selected`: these are not the tabs of an ARIA
`tablist` —there is no panel switching under one heading, there is a page you
navigate to— and announcing a `tab` would promise arrow-key navigation that these
do not have. It is the same distinction `SectionIndex` documents, one step over:
there `location`, because the sections stay on the page; here `page`, because
each one is a different screen.
*/
export function SubTabs({
  label,
  section,
  tabs,
  active,
  onChoose,
}: {
  /** The accessible name of the navigation: "Settings sections". */
  label: string
  /** The section id, to build each tab's route. */
  section: string
  tabs: readonly string[]
  active: string
  onChoose: (tab: string) => void
}) {
  return (
    <nav className={styles.bar} aria-label={label}>
      {tabs.map((t) => (
        <a
          key={t}
          className={styles.tab}
          href={toTrail({ section, sub: t })}
          aria-current={t === active ? 'page' : undefined}
          onClick={(e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            onChoose(t)
          }}
        >
          {t}
        </a>
      ))}
    </nav>
  )
}
