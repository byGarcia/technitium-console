import { useId, type ReactNode } from 'react'
import { Tag } from './Tag'
import frm from './Form.module.css'

/*
A form row: label on the left, control on the right.

It was written by hand 38 times, and on top of that existed TWICE as a component
—in `screens/settings/parts.tsx` and in `screens/dhcp/parts.tsx`, byte-identical
apart from one comment— without any of the other twelve screens using either. With
the row loose, the pieces around it drifted apart too: the help under a field and
the checkbox group were each defined three times.

`modal` changes the grid: inside a dialog there is less room and fewer rows, so the
label column is narrower and carries no separator. That is the only real
difference between the two variants, which is why it is a parameter and not
another component.
*/
export function Row({
  label,
  help,
  modal = false,
  dependeDe,
  children,
}: {
  label: string
  help?: ReactNode
  modal?: boolean
  /*
  The name of the switch that has this row turned off, if there is one.

  It is the signal pilot 3 closed, and it comes in THREE pieces with none to
  spare: an **amber edge** on the side —seen without reading—, **opacity**, which
  already comes with the control's own `disabled`, and **a pill that NAMES it**,
  because "this is off" without saying who turned it off makes you hunt for the
  switch across the whole screen.

  Amber and not a padlock: *amber = you can*. A control turned off by its master
  can be switched on by the user themselves; one turned off by permission cannot.
  If both applied, **the padlock wins**: what you cannot touch does not need two
  explanations of why it is off.
  */
  dependeDe?: string
  /** Receives the `id` to put on the control, so the label governs it. */
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className={`${modal ? frm.mrow : frm.row}${dependeDe != null ? ` ${frm.dependiente}` : ''}`}>
      {/*
      The pill goes OUTSIDE the `<label>`, and this was measured before being left
      this way.

      Put inside, the field's accessible name became "ECS IPv4 Prefix
      Length**Needs Enable EDNS Client Subnet**" and the control **stopped being
      findable by its own label**. It is exactly what phase 1 forbids for the
      tooltip —"it never replaces the accessible name"— and here it was happening
      with the pill: a visual reinforcement had eaten the name.

      Outside, the label still governs its control and the pill is still read: it
      is in the same cell, next to it, and it is ordinary text.
      */}
      {dependeDe == null ? (
        <label className={modal ? frm.mrowLabel : frm.rowLabel} htmlFor={id}>
          {label}
        </label>
      ) : (
        <div className={`${modal ? frm.mrowLabel : frm.rowLabel} ${frm.withPill}`}>
          <label htmlFor={id}>{label}</label>
          <Tag tone="acc">Needs {dependeDe}</Tag>
        </div>
      )}
      <div className={modal ? frm.mrowCtl : frm.rowCtl}>
        {children(id)}
        {/* In the MODAL the help stays nested in the control's cell, which is
            what makes it fall underneath. Its geometry is not touched: pilot 3
            measured a dense form, not a dialog. */}
        {modal && help != null && <div className={frm.help}>{help}</div>}
      </div>
      {/* In the PANEL it is the control's sibling, and that is why it can take up
          its own column. It is the structural change the third column asks for:
          while it was inside the cell, no grid rule could get it out. */}
      {!modal && help != null && <div className={`${frm.rowHelp} ${frm.help}`}>{help}</div>}
    </div>
  )
}

/**
 * A row whose label governs no single control —checkbox and radio groups—:
 * upstream uses a `<label>` with no `for` there, because pointing it at one of the
 * group's controls would lie about what it refers to.
 */
export function GroupRow({
  label,
  help,
  modal = false,
  children,
}: {
  label: string
  help?: ReactNode
  modal?: boolean
  children: ReactNode
}) {
  return (
    <div className={modal ? frm.mrow : frm.row}>
      <div className={modal ? frm.mrowLabel : frm.rowLabel}>{label}</div>
      <div className={modal ? frm.mrowCtl : frm.rowCtl}>
        <div className={frm.group}>{children}</div>
        {modal && help != null && <div className={frm.help}>{help}</div>}
      </div>
      {/* Same as in `Row`, and for the same reason: `GroupRow` draws on the SAME
          `.row` grid, and twenty places pass it help. If its own stayed nested,
          two rows of the same panel would put the same thing in two places and
          the third column would be empty in every other one. */}
      {!modal && help != null && <div className={`${frm.rowHelp} ${frm.help}`}>{help}</div>}
    </div>
  )
}

/** The standalone help, for when it does not hang off a row. */
export function HelpText({ children }: { children: ReactNode }) {
  return <div className={frm.help}>{children}</div>
}
