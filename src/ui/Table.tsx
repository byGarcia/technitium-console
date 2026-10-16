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
`stack`: when the table does not fit its panel, each row becomes a block, so the
cells that say what a row IS stay on the screen instead of behind a sideways
scroll. WHEN is decided further down, in `useStacking`.

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
and the ones that describe it on the other. So there the row stops being a table
row, by ONE rule for all of them:

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
the negative-cache record that was 1,671 px 220. A table that fits is exactly
the table it was.
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
  /** Rows become blocks where the table does not fit; the identifying cells carry `.lead`. */
  stack?: boolean
}) {
  const ref = useRef<HTMLTableElement>(null)
  useStacking(ref, stack)

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

/*
WHEN a table stacks: when it does not fit its wrapper, and always below
`--bp-stack` (560 px of wrapper).

The first version was the 560 alone, as a container query, and it was a guess
about where the tables stop fitting. Measured on 2026-10-16 it was wrong for four
of them: at 1024 and 768 Zones scrolled 835 px of table in a 758 px panel, Users
848, Sessions 945 and Query Logs about 930, each with its row actions or last
columns out of sight, which is the defect the stacking exists for. No single
width is right, because each table's natural width is its own and changes with
its data (a long answer, a longer zone name). So the condition is the real one:
the table is laid out as a table and, if the wrapper has to scroll to hold it
(`scrollWidth > clientWidth`), it stacks.

The 560 stays as a floor, for the one way a table fails without scrolling: a
column whose content can shrink to nothing (`ui/kv`'s value column, which keeps a
DNSSEC key inside its cell) is squeezed instead. That is Cache beside its tree,
414 px at 1024, where Data went to 80 px and a record stood 1,671 px tall.

How it is measured, and why it cannot loop or flicker:

  · It is measured AS A TABLE every time: a stacked table has `data-stacked`
    taken off, is read, and gets it back in the same task. The browser lays the
    page out for the read and paints only the final state, so the in-between
    table is never seen. Measuring the unstacked form each time makes the
    decision a function of the width and the rows alone, never of the state it
    is in, so a decision cannot undo itself.
  · It runs before paint: in a layout effect after every render (new rows, a
    sort, a page) and in a `ResizeObserver` on the wrapper, after a width change
    only; height changes (which stacking itself causes) are ignored. The observer
    also watches the table, so a row that grows wider in place is caught, and the
    fonts finishing loading re-measure once.
  · No hysteresis band is needed. The only feedback is the page's own scrollbar:
    stacking makes the page taller, a scrollbar may appear and the wrapper loses
    its width, which keeps the table stacked; unstacking makes it shorter, the
    scrollbar may go and the wrapper gains width, which keeps it a table. Both
    push the way the decision already went. A pixel of slack absorbs subpixel
    widths.

So nothing flashes on load: the first rows are laid out, measured and placed
before the first frame that shows them.
*/
const STACK_BELOW = 560 // --bp-stack

function measure(wrap: HTMLElement, table: HTMLTableElement): boolean {
  if (wrap.clientWidth < STACK_BELOW) return true
  const was = table.hasAttribute('data-stacked')
  if (was) table.removeAttribute('data-stacked')
  const overflows = wrap.scrollWidth > wrap.clientWidth + 1
  if (was) table.setAttribute('data-stacked', '')
  return overflows
}

function place(table: HTMLTableElement) {
  const wrap = table.parentElement
  if (wrap == null) return
  table.toggleAttribute('data-stacked', measure(wrap, table))
}

function useStacking(ref: React.RefObject<HTMLTableElement | null>, stack: boolean) {
  // After every render, because the rows are the screen's: a sort, a page or a
  // filter hands back new cells, and React leaves alone attributes it did not set.
  useLayoutEffect(() => {
    if (!stack || ref.current == null) return
    labelCells(ref.current)
    place(ref.current)
  })

  useLayoutEffect(() => {
    const table = ref.current
    const wrap = table?.parentElement
    if (!stack || table == null || wrap == null || typeof ResizeObserver === 'undefined') return
    let wrapWidth = wrap.clientWidth
    let tableWidth = table.offsetWidth
    const observer = new ResizeObserver(() => {
      if (wrap.clientWidth === wrapWidth && table.offsetWidth === tableWidth) return
      place(table)
      wrapWidth = wrap.clientWidth
      tableWidth = table.offsetWidth
    })
    observer.observe(wrap)
    observer.observe(table)
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) place(table)
    })
    return () => {
      live = false
      observer.disconnect()
    }
  }, [ref, stack])
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
