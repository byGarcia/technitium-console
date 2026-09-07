import { useId, type ReactNode } from 'react'
import styles from './Matrix.module.css'

/*
The permissions matrix: two axes, read only, and every cell with a name.

It is the one primitive this round adds, and it is added because none of the
twenty-eight already there does what `Administration > Permissions` needs:

  · `Table` orders rows of data. Its columns are labels, not an axis: nothing in
    it says that a cell belongs to a column AND to a row.
  · `EditableTable` edits, and this list does not edit — the editing happens in
    `Edit Permissions`.
  · `Check` is a control, and these cells are a state.

## What it fixes, and it is not decoration

Before this, the eleven sections were a CSS grid (`_permCols_`): no `<table>`, no
`<th>`, no `<tbody>`. Measured with `contract()` on 2026-09-04: `tables: []` on
`/admin/permissions/`, with 84 cells inside. A screen reader moving through it had
no rows and no columns to move by, so "which of these is Modify" could only be
answered by counting.

So the three things this contributes, and they are the three the round asked for:

  1. `th[scope=col]` on the three verbs and `th[scope=row]` on the subject, so the
     reader announces both headers for every cell.
  2. `th[scope=rowgroup]` for the concession map, which puts users and groups in
     one table and has to say which population a row belongs to.
  3. A NAME per cell, written in the DOM and not deduced: a visually hidden
     `<label>` with `{Section} · {Subject} · {Verb}`.

## Why the cell is still an `<input type="checkbox" disabled>`

The drawing proposed replacing it with a glyph, and the argument is good — these
are not controls, and amber is this console's word for "you can". Half of it is
taken: the mark is `--ok` and no longer amber, because amber is for the things you
can press and this list is read only.

The control itself stays, and for a reason that is not inertia: a checkbox
announces its own state, in the reader's own language, with no literal to write.
A glyph does not, so it would need the words for granted and not granted — and
upstream has no such words. This round's own rule is that where there is no
upstream literal, none is written. Keeping the checkbox is what lets the cell be
named without inventing copy.

It costs nothing in the tab order either: a `disabled` input is not focusable, so
the 84 cells were never tab stops to begin with.
*/

export function Matrix({
  caption,
  columns,
  children,
  className,
  dense = false,
  captionHidden = false,
}: {
  /*
  The table's name, and it is DRAWN: "User Permissions", "Group Permissions" are
  literals the screen already showed as a title above each column, so they become
  the caption rather than disappearing into a heading beside it. It is always an
  existing literal, never a new one.
  */
  caption: string
  /** The column axis. `label` is drawn; a column whose label is only for the
   *  reader passes `hidden`. */
  columns: { label: string; hidden?: boolean; wide?: boolean }[]
  children: ReactNode
  className?: string
  /** The second density: the concession map, where a cell carries three marks
   *  instead of one. */
  dense?: boolean
  /** Only for the map: its name would repeat the `h1` two centimetres below it,
   *  so it stays for the reader and not for the eye. */
  captionHidden?: boolean
}) {
  return (
    <div className={[styles.wrap, dense ? styles.scrolls : null, className].filter(Boolean).join(' ')}>
      <table className={[styles.table, dense ? styles.dense : null].filter(Boolean).join(' ')}>
        <caption className={captionHidden ? styles.sr : styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={[c.wide ? styles.who : styles.verb, c.wide && dense ? styles.stick : null]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* The corner cell of a cross-tab labels nothing: it is neither a
                    section nor a verb. It stays empty rather than being given an
                    invented name — the row headers under it say what they are. */}
                {c.label === '' ? null : c.hidden ? <span className={styles.sr}>{c.label}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** The population a run of rows belongs to: `th[scope=rowgroup]`. Only the
 *  concession map needs it — the eleven sections say it in their caption. */
export function MatrixGroup({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <th scope="rowgroup" colSpan={span} className={styles.group}>
        {label}
      </th>
    </tr>
  )
}

/** A row: its subject as `th[scope=row]`, and its cells. */
export function MatrixRow({
  subject,
  children,
  stick = false,
}: {
  subject: string
  children: ReactNode
  /** In the map the subject column stays put while the eleven sections scroll:
   *  without it, a row loses whose it is as soon as it moves. */
  stick?: boolean
}) {
  return (
    <tr>
      <th scope="row" className={[styles.subject, stick ? styles.stick : null].filter(Boolean).join(' ')}>
        {subject}
      </th>
      {children}
    </tr>
  )
}

/*
One permission: granted or not, and named.

`name` is `{Section} · {Subject} · {Verb}` and every one of its three parts is a
literal that already exists on the screen. Nothing is composed that the user
cannot also read.
*/
export function MatrixCell({ name, granted }: { name: string; granted: boolean }) {
  const id = useId()
  return (
    <td className={styles.cell}>
      <label className={styles.sr} htmlFor={id}>
        {name}
      </label>
      <input
        id={id}
        type="checkbox"
        className={styles.mark}
        checked={granted}
        disabled
        readOnly
      />
    </td>
  )
}

/*
The map's cell: the three verbs at once.

The marks are decoration —the reader gets the row's subject, the column's section
and the names of the verbs that ARE granted, which is the whole content— so they
carry `aria-hidden` and the cell says its verbs in text. A cell with nothing
granted says nothing, exactly as upstream's empty cell does.
*/
export function MatrixMarks({ verbs }: { verbs: { verb: string; granted: boolean }[] }) {
  const granted = verbs.filter((v) => v.granted).map((v) => v.verb)
  return (
    <td className={styles.marks}>
      {granted.length > 0 && <span className={styles.sr}>{granted.join(', ')}</span>}
      <span className={styles.pips} aria-hidden="true">
        {verbs.map((v) => (
          <span key={v.verb} className={styles.pip} data-on={v.granted} />
        ))}
      </span>
    </td>
  )
}

/** The "there is nothing here" row, with upstream's literal. */
export function MatrixEmpty({ text, span }: { text: string; span: number }) {
  return (
    <tr>
      <td colSpan={span} className={styles.none}>
        {text}
      </td>
    </tr>
  )
}
