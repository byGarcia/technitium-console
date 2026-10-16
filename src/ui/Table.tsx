import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'
import styles from './Table.module.css'

/*
Sorting by column. Upstream has it on thirteen tables (`sortTable`,
common.js:228-280) and the new console had lost it entirely: with 240 zones
paginated ten at a time, "which ones do I still have to sign" could not be
answered.

Its rule is replicated, and it is not a plain toggle:

  · A click sorts ASCENDING…
  · …unless the column is already ascending, in which case it sorts DESCENDING.

That is what its bubble sort does: it starts at `asc` and, if the first pass
swaps nothing, it turns around. For a user clicking twice in a row the effect is
the same as a switch; the difference is in the FIRST click on a column that was
already sorted, and there we match too.

And it sorts by the TEXT YOU SEE, lowercased and compared by character code, just
like upstream: that way a column of `2026-08-26 10:48` dates comes out right
without treating it as a date, and the order is the same the old console gave.
*/

/*
The table: the scaffolding, not just the styles.

This module exported `useSort`, `Th` and `RowAction` (the helpers) and let each
screen write the wrapper, the `table`, the `thead` and the `tbody` by hand.
Eighteen tables with the same structure typed out eighteen times, and everything
copying allows: six of the seven data tables had been left without their "there
is nothing here" row, and the "My Profile" one ended up with a cell density of
its own because nobody tied it to the shared one.

What is shared now is the PIECE. What still belongs to each screen is the only
thing that really changes: which columns there are and what goes in each row.

    <Table
      header={<><Th …>Username</Th>…</>}
      isEmpty={users.length === 0}
      emptyText="No User Found"
      columns={8}
    >
      {users.map((u) => <tr key={u.username}>…</tr>)}
    </Table>

`isEmpty` is explicit and not guessed by counting children: a `.map()` over an empty
list hands back an empty array, not zero children, and a detection that is right
by accident is worse than a parameter.
*/
/*
`stack`: when the table's own box is narrower than `--bp-stack` (560) each row
becomes a block, so the cells that say what a row IS stay on the screen instead of
behind a sideways scroll.

Measured on 2026-10-16 against the showcase at 390x844, before it:

    Zones           835 px of table in a 360 px panel: Status, Serial, Expiry,
                    Last Modified and the row actions off screen
    Zone records    728 in 360: Data, the column that matters, off screen
    Users           848 in 360: 2FA Status and the actions off screen
    Query Logs      917 in 360: Response Type, Domain and Answer off screen
    Sessions        945 in 360, DHCP Leases 714, Scopes 752, Cluster 1,168,
                    Recently Blocked 430: the same, each with its actions or
                    its last columns out of sight
    Cache           no scroll, which was worse: four fixed columns left Data
                    80 px, and one record of `google.com` stood a letter per
                    line, 1,671 px tall. At 1024 too, beside the tree.

Every one is the same defect. A table can only get narrower by squeezing a
column or by scrolling, and at that width either loses the row: squeezed, a value
breaks letter by letter; scrolled, the cells that identify the row are on one side
and the ones that describe it on the other. So below 560 the row stops being a
table row, by ONE rule for all of them:

    [checkbox] LEAD CELL(S) .......................... [actions]
    LABEL value   LABEL value   LABEL value
    LABEL first line of a block value
          rest of the block…

The first line is what identifies the row: the cells the screen marks with
`.lead` (the zone; the record's name and type; the user; the queried domain and
its type), with the row's checkbox before them and its actions hard against the
end, as at 1440. Every other cell follows as a fact, its column's header in front
of its value, as many to a line as fit; a long value takes the whole line and
wraps at its spaces and dots, never inside a word.

The labels are the table's OWN header texts, read from each column's `<th>`
after every render into `data-label`: nothing to keep in sync and not one new
word, and a column upstream leaves blank gets no label. CSS draws the label with
an empty alternative text (`content: … / ""`), so a screen reader does not hear it
twice; it hears the header, because the table keeps its semantics. A `display`
other than `table` makes some browsers drop them, so in this mode the table, its
row groups, rows and cells carry their roles explicitly, the ones the elements
imply.

Nothing is hidden from anyone: every cell is still in its row, in the page, in the
copy and in find. The header row stays in the page too, and on screen it keeps its
sort buttons and the select-all box, as a strip: those are controls, and a phone
needs them as much as a desk does.

After it, at 390: no table scrolls sideways and none breaks a word. Rows measure
Zones 131, an A record 142 (the SOA 284), Leases 65, Recently Blocked 92, Query
Logs 156 to 183, Users 198, Sessions 195 to 216, Scopes 190, Cluster 208 to 220,
the negative-cache record that was 1,671 px 220. Above 560 the table is exactly
the table it was.

It is a container query, not a media query, because a table can be narrow for
what sits beside it (see `.stackWrap` in Table.module.css).
*/
export function Table({
  header,
  children,
  isEmpty = false,
  emptyText,
  columns,
  className,
  tableClass,
  footer,
  stack = false,
}: {
  /** The `thead` cells; normally `Th` from this same module. */
  header: ReactNode
  children: ReactNode
  /** Whether there are no rows to draw. */
  isEmpty?: boolean
  /** What to say then. Without this, an empty table shows a blank body. */
  emptyText?: ReactNode
  /** How many columns that row spans. */
  columns?: number
  /** For the wrapper: the max width of a narrow table, for example. */
  className?: string
  /** For the table: the sticky header of the "More" dialog, for example. */
  tableClass?: string
  /** The footer row, when the table carries its count inside. */
  footer?: ReactNode
  /** Rows become blocks below `--bp-stack`; the identifying cells carry `.lead`. */
  stack?: boolean
}) {
  const ref = useRef<HTMLTableElement>(null)

  // After every render, because the rows are the screen's: a sort, a page or a
  // filter hands back new cells, and React leaves alone attributes it did not set.
  useLayoutEffect(() => {
    if (stack && ref.current != null) labelCells(ref.current)
  })

  const group = stack ? { role: 'rowgroup' } : {}
  return (
    <div className={[styles.wrap, stack && styles.stackWrap, className].filter(Boolean).join(' ')}>
      <table
        ref={ref}
        role={stack ? 'table' : undefined}
        className={[styles.table, stack && styles.stack, tableClass].filter(Boolean).join(' ')}
      >
        <thead {...group}>
          <tr>{header}</tr>
        </thead>
        <tbody {...group}>
          {isEmpty && emptyText != null ? (
            <tr>
              <td colSpan={columns} className={styles.noRows}>
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
        {footer != null && (
          <tfoot {...group}>
            <tr>{footer}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/**
 * Gives every row and cell of a stacking table its role, and every body cell the
 * text of its column's header in `data-label`. Columns are counted with their
 * `colSpan`; a cell spanning several (the "nothing here" row) gets no label.
 */
export function labelCells(table: HTMLTableElement) {
  const head = table.tHead?.rows[0]
  const labels: string[] = []
  if (head != null) {
    head.setAttribute('role', 'row')
    for (const th of Array.from(head.cells)) {
      th.setAttribute('role', 'columnheader')
      // A header that shows no text still names its sort button (`Th`'s `name`).
      const named = th.querySelector('button[aria-label]')?.getAttribute('aria-label')
      const label = (th.textContent ?? '').trim() || (named ?? '')
      for (let i = 0; i < th.colSpan; i++) labels.push(label)
    }
  }
  const sections = [...Array.from(table.tBodies), ...(table.tFoot != null ? [table.tFoot] : [])]
  for (const section of sections) {
    for (const row of Array.from(section.rows)) {
      row.setAttribute('role', 'row')
      let column = 0
      for (const cell of Array.from(row.cells)) {
        cell.setAttribute('role', cell.tagName === 'TH' ? 'rowheader' : 'cell')
        const label = cell.colSpan === 1 ? labels[column] : undefined
        if (label) cell.setAttribute('data-label', label)
        else cell.removeAttribute('data-label')
        if (isBlank(cell)) cell.setAttribute('data-empty', '')
        else cell.removeAttribute('data-empty')
        column += cell.colSpan
      }
    }
  }
}

/*
A cell with nothing to show: no text but white space, and no element that is a
value without text (an icon, an image, a control). An empty `<span>`, the space
Zones writes for a missing serial and an empty date are blank; the "no value"
placeholder (an em dash) is text and is a value. In a stacked row a blank fact is
only a label with nothing after it, so the stylesheet takes it off the screen; it
stays in the row, so every later cell keeps its column for a screen reader.
*/
const VALUE_WITHOUT_TEXT = 'svg, img, input, button, select, textarea, [role="img"]'

function isBlank(cell: HTMLTableCellElement): boolean {
  return (cell.textContent ?? '').trim() === '' && cell.querySelector(VALUE_WITHOUT_TEXT) == null
}

export interface Sort {
  field: string
  desc: boolean
}

/** How each sortable column is read: the text the user sees in the cell. */
export type Keys<T> = Record<string, (row: T) => string | number | null | undefined>

function text(v: string | number | null | undefined): string {
  return String(v ?? '').toLowerCase()
}

export function useSort<T>(keys: Keys<T>, rows: T[]) {
  const [sort, setSort] = useState<Sort | null>(null)

  const sorted = (() => {
    if (sort == null || keys[sort.field] == null) return rows
    const read = keys[sort.field]
    const sign = sort.desc ? -1 : 1
    return [...rows].sort((a, b) => {
      const x = text(read(a))
      const y = text(read(b))
      return x === y ? 0 : (x > y ? 1 : -1) * sign
    })
  })()

  function toggle(field: string) {
    const read = keys[field]
    if (read == null) return
    // The list is looked at AS IT IS DRAWN, which is what upstream looks at.
    const alreadyAsc = sorted.every((f, i) => i === 0 || text(read(sorted[i - 1])) <= text(read(f)))
    setSort({ field, desc: alreadyAsc })
  }

  return { rows: sorted, sort, toggle }
}

/** A sortable column header. Without `field` it is an ordinary header. */
export function Th({
  field,
  sort,
  onSort,
  children,
  name,
  ...rest
}: {
  field?: string
  sort?: Sort | null
  onSort?: (field: string) => void
  children?: ReactNode
  /** For a header upstream leaves BLANK and which is still sortable: the button
   *  needs a name even though the cell shows no label. */
  name?: string
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  if (field == null || onSort == null) return <th {...rest}>{children}</th>

  const active = sort?.field === field
  return (
    <th aria-sort={active ? (sort!.desc ? 'descending' : 'ascending') : 'none'} {...rest}>
      <button
        type="button"
        className={styles.sort}
        aria-label={children == null ? name : undefined}
        onClick={() => onSort(field)}
      >
        {children}
        <span className={styles.arrow}>
          <Icon name={active ? 'chevronDown' : 'sort'} size={12} data-desc={active && !sort!.desc} />
        </span>
      </button>
    </th>
  )
}

/*
The button for a row action. It carries an icon and not a label (see the measured
reasoning in `Table.module.css`) but keeps its name in `aria-label` and in
`title`, so the keyboard, the screen reader and the tooltip all say the same thing
the text that used to fill the column said.
*/
export function RowAction({
  icon,
  name,
  ...rest
}: {
  icon: IconName
  /** What it does, in upstream's wording: "Options", "Disable", "Edit". */
  name: string
} & Omit<React.ComponentProps<typeof Button>, 'children' | 'size' | 'icon'>) {
  return (
    <Button size="sm" icon aria-label={name} title={name} {...rest}>
      <Icon name={icon} size={15} />
    </Button>
  )
}
