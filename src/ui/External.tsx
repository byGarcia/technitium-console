import type { ReactNode } from 'react'
import styles from './External.module.css'

/*
The links that lead out of the console.

They are here and not scattered because a review found they had been going missing
one at a time: upstream's sentence stayed and the destination disappeared ("read
the change log" with no change log, "Use ZONEMD to Validate Zone" with no RFC).
With a single place where they are written, `dev/check-parity-controls.mjs` can
verify by list that none is missing.

Two shapes, which is what upstream has:

- `External`, inside a sentence: "validated using the [ZONEMD] record".
- `HelpText`, the standalone line at the foot of a panel or a dialog: "Help: …".
*/
export function External({ href, children }: { href: string; children: ReactNode }) {
  if (!webDestination(href)) return <span>{children}</span>
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/*
OURS: some destinations come from the server, such as the three links of the
update feed, so only the web's own schemes become a link. React already blocks
`javascript:`, and browsers block a top-level `data:`; this does not depend on
either.
*/
function webDestination(href: string): boolean {
  try {
    const { protocol } = new URL(href, window.location.href)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * The help line. It is not a link inside a sentence, so WCAG's target-size
 * exception does not apply to it: it carries a box of its own.
 */
export function HelpText({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className={styles.help}>
      <External href={href}>{children}</External>
    </div>
  )
}
