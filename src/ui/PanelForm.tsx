import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Alert } from './Alert'
import { Button } from './Button'
import { Empty } from './Empty'
import { Input, Textarea } from './Field'
import { HelpText, GroupRow, Row } from './Form'
import { Panel } from './Panel'
import { EditableTable } from './EditableTable'
import check from './Check.module.css'
import text from './text.module.css'
import styles from './PanelForm.module.css'

/*
The pieces of the panel-form kit. See `PanelForm.module.css` for why they live
here and not inside Settings or DHCP.

Upstream puts each group of fields in a `div.well` with NO title (index.html:2565
onwards). The redesign gives it a small-caps header: same fields, same order,
just visually grouped. The titles come from the `well`'s `id`
(`divSettingsGeneralRateLimiting` -> "Rate Limiting") so as not to invent new
taxonomies.
*/

/*
The title is optional on purpose.

Five panels repeated their own name as the legend of the first block —TSIG,
Recursion, Blocking, Logging and SSO— and in three of them it was the ONLY
legend, so it grouped nothing: it just repeated. In SSO it got said four times in
a row before the first control. Without `title` the panel still groups: what
disappears is the echo.
*/
/*
`notices` is where the `Warning!` goes, and it goes BEFORE the controls on
purpose.

It is the pilot 3 rule: **`Warning!` before, `Note!` after**. One can change your
decision and the other explains it, so reading the warning after having touched
the control arrives late by definition.

Before this, all forty `Settings` notices went BELOW, the seven `Warning!`
included. Now the seven are in this slot and the thirty-three `Note!` are still
below, and that is checked: `dev/master-switch-signal.test.mjs` does not look at
it, but the 2026-09-03 sweep walked the four panes that have a warning —`general`,
`blocking`, `logging` and `recursion`— and measured that every `Warning!` ends up
above the first control of its block, at all four widths.

It is a prop of the block and not a convention each pane has to remember: whoever
places it decides the position, and a rule that depends on remembering gets
forgotten — eleven of twelve call sites proved it with `role="menuitem"`.
*/
export function Block({
  title,
  notices,
  children,
}: {
  title?: string
  /** This block's warnings. They are drawn **above** the controls. */
  notices?: ReactNode
  children: ReactNode
}) {
  /*
  The section count, COUNTED and not written by hand.

  Pilot 3 puts on every section label how many controls it has, and its ten
  figures add up to 39 —the screen's total— so the drawing checks itself. That
  property only survives if the number comes from the content: ten hand-written
  numbers part company with the content on the first control anyone adds, and they
  do it silently.

  It is counted from the DOM and not from React's `children` because a section
  mixes rows of several kinds —`TextRow`, `AreaRow`, `GroupRow`, `EditableList`—
  and some carry more than one control inside. What has to be counted is what the
  user sees, which is exactly what the screen contract counts.
  */
  const box = useRef<HTMLDivElement>(null)
  const [howMany, setHowMany] = useState<number | null>(null)
  useEffect(() => {
    const raiz = box.current
    if (raiz == null) return
    /*
    The cells of an editable list do NOT count.

    Measured: counting them, `Rate Limiting` said **18** and the ten added up to
    54. The pilot says 39, and the difference is exactly the **15 cells of the two
    QPM lists**. And the pilot is right: a row cell is **server data** —with
    another configuration they are other rows and another number— so counting them
    turns the section count into a volatile figure instead of a property of the
    screen.

    It is the same distinction the phase 3 contract already made: 39 comparable
    controls and 15 data cells, and the contract separated them on purpose.
    */
    const todos = [...raiz.querySelectorAll('input, select, textarea, [role="combobox"]')]
    const n = todos.filter((c) => c.closest('table') == null).length
    setHowMany(n > 0 ? n : null)
    /* No dependency array, and on purpose: what has to be counted is the DOM as
       already drawn, and it changes for reasons that are not props of this block
       —a row appearing because its master switches on, a list growing. It settles
       because `setHowMany` with the same value does not re-render. */
  })

  return (
    <div ref={box}>
      <Panel
        title={title}
        className={styles.block}
        groups2
        actions={howMany != null ? <span className={styles.recuento}>{howMany}</span> : undefined}
      >
        {notices != null && <div className={styles.notices}>{notices}</div>}
        {children}
      </Panel>
    </div>
  )
}

export function TextRow({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  help,
  type = 'text',
  width,
  disabled,
  dependeDe,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
  help?: ReactNode
  type?: 'text' | 'number' | 'password'
  /*
  Upstream pins the numeric ones at 80-100 px and leaves the text ones wide.

  **No default value here**: when nothing is said, `--ctrl-num` rules, which is
  where phase 1 wrote down the width of a numeric field. The default used to be a
  literal `100` on this line, so the token existed and governed nothing.

  The explicit widths the console already has —80, 125, 200, 38, 28— still win
  over the token: they are per-field decisions and not drift. */
  width?: number | 'wide'
  disabled?: boolean
  /** Who has it switched off, when it is a master switch and not a permission. */
  dependeDe?: string
  maxLength?: number
}) {
  return (
    <Row label={label} help={help} dependeDe={dependeDe}>
      {(id) => (
        <div className={styles.inline}>
          <Input
            id={id}
            type={type}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            style={
              width === 'wide'
                ? { width: '100%', maxWidth: 420 }
                : { width: width ?? 'var(--ctrl-num)' }
            }
          />
          {suffix && <Trailer>{suffix}</Trailer>}
        </div>
      )}
    </Row>
  )
}

export function AreaRow({
  label,
  value,
  onChange,
  rows = 3,
  help,
  disabled,
  dependeDe,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  help?: ReactNode
  disabled?: boolean
  /** Who has it switched off, when it is a master switch and not a permission. */
  dependeDe?: string
}) {
  return (
    <Row label={label} help={help} dependeDe={dependeDe}>
      {(id) => (
        <Textarea
          mono
          id={id}
          className={styles.area}
          rows={rows}
          spellCheck={false}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Row>
  )
}

/** The suffix that follows a control: "seconds", "MB", "(0 to disable)". */
export function Trailer({ children }: { children: ReactNode }) {
  return <span className={text.trailer}>{children}</span>
}

export interface RadioOption {
  value: string
  label: string
  help?: ReactNode
}

/*
The radio group. It shares its row and its help with `ui/Check`: they are the
same control with different cardinality, and when each screen wrote its own, a
radio's help and a checkbox's help did not land on the same left edge.
*/
export function Radios({
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  name: string
  value: string
  options: RadioOption[]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <>
      {options.map((o) => (
        <div key={o.value}>
          <label className={check.check}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={disabled}
              onChange={() => onChange(o.value)}
            />
            <span className={check.text}>{o.label}</span>
          </label>
          {o.help && <div className={check.help}>{o.help}</div>}
        </div>
      ))}
    </>
  )
}

/** Several loose blocks carrying the panel body's inset. */
export function Notices({ children }: { children: ReactNode }) {
  return <div className={styles.notices}>{children}</div>
}

/*
Upstream's alerts are `<p><b>Note!</b> …</p>` in bold, inline. Here they become
a coloured block: `Warning!` amber, `Note!` blue. They always go inside an
`Avisos`, which is what supplies the inset — when the alert supplied it itself on
one screen and not the other, the same "Note!" came out indented in DHCP and flush
in Settings.
*/
export function Warning({ children }: { children: ReactNode }) {
  return (
    <Alert type="warning" title="Warning!">
      {children}
    </Alert>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <Alert type="info" title="Note!">
      {children}
    </Alert>
  )
}

/** Loose upstream text that is neither `Note!` nor `Warning!`. */
export function Plain({ children }: { children: ReactNode }) {
  return <div className={styles.plain}>{children}</div>
}

export function Help({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className={styles.link}>
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    </div>
  )
}

export function Pre({ children }: { children: ReactNode }) {
  return <pre className={styles.pre}>{children}</pre>
}

export interface Column<T> {
  key: keyof T & string
  label: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  /** When the cell is not a text field: the TSIG algorithm dropdown. */
  render?: (row: T, set: (partial: Partial<T>) => void, id: string, name: string) => ReactNode
}

/*
Editable list: a header, one row per entry with its "Delete", and "Add" below.
Upstream puts the "Add" in the header; here it goes underneath, because a table
header with a button inside cannot be labelled.

There were two, and they had stopped being copies: DHCP's declared its columns and
generated each cell's name and `id` by itself; Settings' received the cells
already built, so every call site wrote its own `aria-label` by hand and none had
an `id`. The declarative one wins, with an escape hatch (`render`) for the single
cell that is not a text field.

The accessible name is `"<table> <row> <column>"`. It is unique by construction;
the other scheme —`"<column> <row>"`— forced you to disambiguate the columns by
hand, and out of that came an `aria-label` of "IPv4 UDP Limit" over a header that
said "UDP Limit".

The deterministic `id` exists because upstream's validation alert says literally
"the text field in focus": without being able to focus the failing cell, the alert
cannot be resolved.
*/
export function EditableList<T extends Record<string, string>>({
  label,
  columns,
  rows,
  onChange,
  blank,
  help,
  disabled,
  cellId,
}: {
  label: string
  columns: Column<T>[]
  rows: T[]
  onChange: (rows: T[]) => void
  blank: () => T
  help?: ReactNode
  disabled?: boolean
  cellId?: (row: number, column: string) => string
}) {
  return (
    /*
    The help travels through `GroupRow` and is not drawn here underneath.

    Pilot 3 asks for all 41 in the third column, and the two belonging to the
    lists ARE two of those 41. Drawn inside the group they ended up under the
    table while the other thirty-nine were beside it: the same help in two places
    on one screen.
    */
    <GroupRow label={label} help={help}>
      <div className={styles.listScroll}>
      <EditableTable
        className={styles.editable}
        header={
          <>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th className={styles.tdel} />
          </>
        }
      >
        {rows.map((row, i) => {
          const set = (partial: Partial<T>) =>
            onChange(rows.map((r, j) => (j === i ? { ...r, ...partial } : r)))
          return (
            // Rows have no stable identity in upstream: they are numbered with
            // a random number. The index is the same criterion.
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i}>
              {columns.map((c) => {
                const id = cellId?.(i, c.key)
                const name = `${label} ${i + 1} ${c.label}`
                return (
                  <td key={c.key}>
                    {c.render ? (
                      c.render(row, set, id ?? '', name)
                    ) : (
                      <Input
                        id={id}
                        aria-label={name}
                        type={c.type ?? 'text'}
                        min={c.min}
                        max={c.max}
                        disabled={disabled}
                        value={row[c.key]}
                        onChange={(e) => set({ [c.key]: e.target.value } as Partial<T>)}
                      />
                    )}
                  </td>
                )
              })}
              <td className={styles.tdel}>
                <Button
                  variant="danger"
                  disabled={disabled}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                >
                  Delete
                </Button>
              </td>
            </tr>
          )
        })}
      </EditableTable>
      </div>
      {/* With no rows, the table showed the headers and nothing beneath: blank
          does not say "there are none", it says "I do not know". */}
      {rows.length === 0 && <Empty compact>No entries.</Empty>}
      <div>
        <Button disabled={disabled} onClick={() => onChange([...rows, blank()])}>
          Add
        </Button>
      </div>
    </GroupRow>
  )
}

export { Check } from './Check'
export { HelpText, GroupRow, Row }
export { styles as panelFormStyles }
