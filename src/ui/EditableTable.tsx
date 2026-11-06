import { useLayoutEffect, useRef, type ReactNode } from 'react'
import styles from './EditableTable.module.css'

/*
The table of a list edited in place: the TSIG keys, the forwarders, a scope's
static routes, the SSO group maps, a section's permissions.

It is a different piece from the data table (`ui/Table`) and it must be: that one
is a screen's main object, with its panel, its sorting and its stacking; this one
lives INSIDE a panel or a dialog, up against its fields. Since 2026-11-06 it is
drawn in the data table's register all the same (its header band, its row lines,
its hover, a frame of its own), so a list you edit reads as the same kind of
object as a list you read.

It exists as a component for the same reason as the other one: the scaffolding was
written five times. Three modules also defined their own class with the same values
copied by hand, and that is where one ended up with 0.07em of letter-spacing and
the rest with 0.05.

A COLUMN OF CHECKBOXES IS A COLUMN OF CHECKBOXES. Edit Permissions' View, Modify
and Delete cells hold one checkbox each, and the screens that write them size
every control in the table to its cell (`input { width: 100% }`, which a text field
wants): the checkbox, drawn by the console on the native element, became a bar as
wide as its column, a row of three amber bars. The table now finds those columns
itself, after every render: a column whose every body cell holds one checkbox and
nothing else is marked `data-check`, on its header too, and drawn as a narrow,
centred column with the checkbox at its own size. Nothing changes for the screens:
the same props, the same rows.
*/
export function EditableTable({
  header,
  children,
  className,
}: {
  header: ReactNode
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLTableElement>(null)
  // After every render: the rows are the screen's, and a row added or removed can
  // make or unmake a column of checkboxes.
  useLayoutEffect(() => {
    if (ref.current != null) markCheckColumns(ref.current)
  })

  /* The wrapper scrolls sideways when a row is wider than its room (Edit Permissions
     at 390 px: a name, three checkbox columns and Remove), so nothing is cut off. */
  return (
    <div className={styles.scroll}>
      <table ref={ref} className={[styles.table, className].filter(Boolean).join(' ')}>
        <thead>
          <tr>{header}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** A cell whose only content is one checkbox: no text, no other element. */
function isCheckCell(cell: HTMLTableCellElement): boolean {
  const boxes = cell.querySelectorAll('input[type="checkbox"]')
  if (boxes.length !== 1) return false
  if ((cell.textContent ?? '').trim() !== '') return false
  return cell.querySelector('input:not([type="checkbox"]), select, textarea, button') == null
}

/**
 * Marks with `data-check` every column (header and body cells) whose body cells all
 * hold a single checkbox. A table with no rows marks nothing: there is nothing to
 * tell the column by.
 */
export function markCheckColumns(table: HTMLTableElement) {
  const head = Array.from(table.tHead?.rows[0]?.cells ?? [])
  const rows = Array.from(table.tBodies[0]?.rows ?? []).filter((r) => r.cells.length === head.length)
  head.forEach((th, i) => {
    const check = rows.length > 0 && rows.every((r) => isCheckCell(r.cells[i]))
    for (const cell of [th, ...rows.map((r) => r.cells[i])]) {
      if (check) cell.setAttribute('data-check', '')
      else cell.removeAttribute('data-check')
    }
  })
}
