import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'
import { Tooltip } from './Tooltip'
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

It sorts by WHAT YOU SEE in the cell, but not the way upstream compares it.
Upstream lowercases the text and compares it by character code, so a TTL column
comes out 300, 3600, 60, 86400 (upstream issue #1873 asks for better). Here
numbers compare as numbers, addresses by their bytes and text naturally
(`compareSortValues`, deviation 48). A column of `2026-08-26 10:48` dates still
comes out right without being read as dates. It sorts the rows it is given:
a zone's records across all their pages, where upstream sorts the page on
screen (zone.js:3640), and the zone list one page, as the server hands it.
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
    <div data-table-wrap className={[styles.wrap, stack && styles.stackWrap, className].filter(Boolean).join(' ')}>
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

/** How each sortable column is read: what the user sees in the cell. */
export type Keys<T> = Record<string, (row: T) => string | number | null | undefined>

type SortValue = string | number | null | undefined

const NUMBER = /^-?\d+(\.\d+)?$/
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const HEX_GROUP = /^[0-9a-f]{1,4}$/i
const MAC = /^[0-9a-f]{2}([-:])[0-9a-f]{2}(\1[0-9a-f]{2}){4}$/i
const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'accent' })

function ipv4Bytes(s: string): number[] | null {
  const m = IPV4.exec(s)
  if (m == null) return null
  const bytes = m.slice(1).map(Number)
  return bytes.every((b) => b <= 255) ? bytes : null
}

/** The sixteen bytes of an IPv6 address, `::` and an IPv4 tail included. */
function ipv6Bytes(s: string): number[] | null {
  if (!s.includes(':')) return null
  const halves = s.split('::')
  if (halves.length > 2) return null
  const groups = (part: string): number[] | null => {
    if (part === '') return []
    const out: number[] = []
    const pieces = part.split(':')
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i]
      const v4 = i === pieces.length - 1 ? ipv4Bytes(p) : null
      if (v4 != null) out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3])
      else if (HEX_GROUP.test(p)) out.push(parseInt(p, 16))
      else return null
    }
    return out
  }
  const head = groups(halves[0])
  const tail = halves.length === 2 ? groups(halves[1]) : []
  if (head == null || tail == null) return null
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const all = [...head, ...Array<number>(missing).fill(0), ...tail]
  return all.flatMap((g) => [g >> 8, g & 0xff])
}

/*
An address as its family (4 before 6) followed by its bytes, or null. A MAC
address is one too: fixed-width hex, which the natural text order would get
wrong (`9C` before `10`, since 9 < 10).
*/
function addressBytes(s: string): number[] | null {
  if (MAC.test(s)) return [0, ...s.split(/[-:]/).map((h) => parseInt(h, 16))]
  const v4 = ipv4Bytes(s)
  if (v4 != null) return [4, ...v4]
  const v6 = ipv6Bytes(s)
  return v6 != null ? [6, ...v6] : null
}

/*
How two cells compare (deviation 48). Upstream compares the lowercased text by
character code, so TTLs come out 300, 3600, 60, 86400 and leases .10, .100, .9.
Here, in this order:
  · an empty value first, as the text sort put it;
  · two numbers, or two texts that are plain numbers, by their value;
  · two IP addresses (or two MAC addresses) by their bytes, IPv4 before IPv6;
  · anything else as text, case-insensitively and naturally, so `pc2` comes
    before `pc10`. A date drawn as `2026-08-26 10:48` still sorts as a date.
*/
export function compareSortValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return Math.sign(a - b)
  const x = a == null ? '' : String(a).trim()
  const y = b == null ? '' : String(b).trim()
  if (x === '' || y === '') return x === y ? 0 : x === '' ? -1 : 1
  if (NUMBER.test(x) && NUMBER.test(y)) return Math.sign(Number(x) - Number(y))
  const ax = addressBytes(x)
  const ay = ax == null ? null : addressBytes(y)
  if (ax != null && ay != null) {
    for (let i = 0; i < ax.length; i++) if (ax[i] !== ay[i]) return ax[i] - ay[i]
    return 0
  }
  return COLLATOR.compare(x, y)
}

export function useSort<T>(keys: Keys<T>, rows: T[]) {
  const [sort, setSort] = useState<Sort | null>(null)

  const read = sort == null ? undefined : keys[sort.field]
  const desc = sort?.desc ?? false
  const sorted = useMemo(() => {
    if (read == null) return rows
    const sign = desc ? -1 : 1
    return [...rows].sort((a, b) => compareSortValues(read(a), read(b)) * sign)
  }, [read, desc, rows])

  function toggle(field: string) {
    const readField = keys[field]
    if (readField == null) return
    // The list is looked at AS IT IS DRAWN, which is what upstream looks at.
    const alreadyAsc = sorted.every(
      (f, i) => i === 0 || compareSortValues(readField(sorted[i - 1]), readField(f)) <= 0,
    )
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
reasoning in `Table.module.css`) but keeps its name in `aria-label`, and the
console's own tooltip (`ui/Tooltip`) shows that same name on hover AND on keyboard
focus. It used to be `title`, which the keyboard never sees, which waits a second
and a half, and which no theme can draw.

The bubble does not describe the button (`describe={false}`): its text IS the
button's name, and a reader would say it twice on every row. The wrapper it adds is
one level, which `.actions > * > button` already expects, and it is what lets the
bubble open over a disabled action, as in `PermissionButton`.
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
    <Tooltip text={name} placement="top" describe={false}>
      <Button size="sm" icon aria-label={name} {...rest}>
        <Icon name={icon} size={15} />
      </Button>
    </Tooltip>
  )
}
