import type { ReactNode } from 'react'
import styles from './DataTable.module.css'

/*
A TABLE AND ITS CONTROLS AS ONE OBJECT (2026-11-05). The toolbar (search, filters,
what acts on the selection), the table, and the foot (the count, the page fields
and the pagination) inside one card, the way the consoles this one is compared
with draw a data table. They used to be three loose things on the page: a form
row of stacked labels, the table's own card, and a count bar under it.

It only arranges. The table is still `ui/Table`, given as the children; the
toolbar and the foot are whatever the screen passes, with the same controls, the
same labels and the same behaviour as before. `DataFoot` is the foot most screens
want: the count on the left, the page controls on the right.
*/
export function DataTable({
  toolbar,
  foot,
  children,
}: {
  toolbar?: ReactNode
  foot?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={styles.frame}>
      {toolbar != null && <div className={styles.toolbar}>{toolbar}</div>}
      {children}
      {foot != null && <div className={styles.foot}>{foot}</div>}
    </div>
  )
}

/** A group in the toolbar that takes the room left over (the search). */
export function Grow({ children }: { children: ReactNode }) {
  return <div className={styles.grow}>{children}</div>
}

/** What sits at the toolbar's far end: the count of a selection and its verb. */
export function End({ children }: { children: ReactNode }) {
  return <div className={styles.end}>{children}</div>
}

/** The foot: the count on the left, the page controls on the right. */
export function DataFoot({ count, children }: { count: ReactNode; children?: ReactNode }) {
  return (
    <>
      <span className={styles.count}>{count}</span>
      {children != null && <div className={styles.paging}>{children}</div>}
    </>
  )
}
