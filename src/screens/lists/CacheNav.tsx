import { DomainName } from '../../ui/DomainName'
import { Icon } from '../../ui/Icon'
import styles from './Lists.module.css'

/*
How Cache moves through its tree, in one band instead of three places.

Until 2026-10-16 Cache had the tree of Allowed and Blocked: a 328 px column with
the field, `<ROOT>`, the chain of ancestors and the children, and beside it a
second, non-clickable path over the records. Two drawings of the same chain, and
the one you could click was the one furthest from what you were reading. At
`com` the tree was 35 rows tall and the four records sat 1,371 px down the page.

Upstream draws a flat list (other-zones.js:120-137): `[refresh]`, `[up]` and the
children. The same three moves are here, each where it reads:

  · up: the crumbs. Every ancestor is upstream's `[up]` taken one or more times,
    so it is sent with `direction=up`, exactly as the tree sent it;
  · down: the children, as chips under the node;
  · refresh: the `Refresh` button beside the crumbs, which reads the node again.

Nothing is sent that the tree did not send, and the tree is still the
navigation of Allowed and Blocked inside Rules, which this does not touch.
*/

/*
The children of the open node, as chips that open it.

The server sends them as FULL names (`clients4.google.com` under `google.com`),
and the full name is what is sent back, as the tree did. What changes is the
weight: the part that is new at this level is drawn in ink and the parent's
suffix, the same on every chip, in the faint grey, so a row of 35 children reads
as 35 different words and not as 35 copies of `.com`. The accessible name, the
copied text and find-in-page still get the whole name.
*/
export function Children({
  domain,
  zones,
  onNavigate,
}: {
  domain: string
  zones: string[]
  onNavigate: (domain: string) => void
}) {
  const suffix = domain === '' ? '' : `.${domain}`

  return (
    <ul className={styles.chips}>
      {zones.map((z) => {
        const own = suffix !== '' && z.endsWith(suffix) ? z.slice(0, -suffix.length) : z
        const rest = own === z ? '' : suffix
        return (
          <li key={z}>
            <button type="button" className={styles.chipNode} onClick={() => onNavigate(z)}>
              <span className={styles.chipName}>
                <DomainName name={own} />
                {rest !== '' && <span className={styles.chipRest}><DomainName name={rest} /></span>}
              </span>
              <Icon name="chevronRight" size={12} className={styles.chipCh} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
