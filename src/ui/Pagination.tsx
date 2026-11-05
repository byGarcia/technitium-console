import { Icon } from './Icon'
import { Tooltip } from './Tooltip'
import styles from './Pagination.module.css'
import type { Pagination as Window } from '../lib/pagination'

/*
The page bar: first, previous, the window of ten, next and last.

It was written by hand on three screens (the zone list, a zone's records and Query
Logs) with the same markup and the same string of buttons. The arithmetic already
lived in one place (`lib/pagination.ts`, which is tested on its own); what was
missing was the buttons doing the same.

The only thing that really differed between the three is HOW the last page is
asked for: the zone list and Query Logs send `-1` and let the server resolve it
(which is what upstream does), and a zone's records compute it client-side because
they have them all. That is why `last` is a parameter and not hard-coded.

The four arrows are icons, so each shows its name in the console's tooltip on hover
and on focus, the same word its `aria-label` already carries. The page numbers do
not: a tooltip saying `3` over a `3` is noise.
*/
export function Pagination({
  window,
  current,
  last,
  onGoTo,
}: {
  window: Window
  current: number
  /** Which number to ask for as "last". `-1` lets the server resolve it. */
  last: number
  onGoTo: (page: number) => void
}) {
  return (
    <span className={styles.pg}>
      {window.first && (
        <Tooltip text="First" placement="top" describe={false}>
          <button type="button" className={styles.pgb} aria-label="First" onClick={() => onGoTo(1)}>
            <Icon name="first" size={14} />
          </button>
        </Tooltip>
      )}
      {window.previous != null && (
        <Tooltip text="Previous" placement="top" describe={false}>
          <button
            type="button"
            className={styles.pgb}
            aria-label="Previous"
            onClick={() => onGoTo(window.previous!)}
          >
            <Icon name="chevronLeft" size={14} />
          </button>
        </Tooltip>
      )}
      {window.pages.map((p) => (
        <button
          key={p}
          type="button"
          className={styles.pgb}
          aria-current={p === current}
          onClick={() => onGoTo(p)}
        >
          {p}
        </button>
      ))}
      {window.next != null && (
        <Tooltip text="Next" placement="top" describe={false}>
          <button
            type="button"
            className={styles.pgb}
            aria-label="Next"
            onClick={() => onGoTo(window.next!)}
          >
            <Icon name="chevronRight" size={14} />
          </button>
        </Tooltip>
      )}
      {window.last && (
        <Tooltip text="Last" placement="top" describe={false}>
          <button type="button" className={styles.pgb} aria-label="Last" onClick={() => onGoTo(last)}>
            <Icon name="last" size={14} />
          </button>
        </Tooltip>
      )}
    </span>
  )
}
