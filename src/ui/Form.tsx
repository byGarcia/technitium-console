import { useId, type ReactNode } from 'react'
import { Tag } from './Tag'
import { FoldHelp } from './FoldHelp'
import frm from './Form.module.css'

/*
A form row: label on the left, control on the right.

On a page (not `modal`) the help sits UNDER THE LABEL, folded to one line with a
`more` (`ui/FoldHelp`), and an editable table drops under its label and help to
take the row's whole width (2026-11-06, CONVENTIONS.md deviation
22). It used to have a third column of its own at the far right, 800 px from the
field it explained. The grid is in `Form.module.css`; the markup keeps the label,
the help and the control as the row's three children, in reading order.

It was written by hand 38 times, and on top of that existed TWICE as a component
(in `screens/settings/parts.tsx` and in `screens/dhcp/parts.tsx`, byte-identical
apart from one comment) without any of the other twelve screens using either. With
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
  dependsOn,
  id: fixedId,
  children,
}: {
  label: string
  /** The control's `id`, for a screen whose ids are a contract. Generated if absent. */
  id?: string
  help?: ReactNode
  modal?: boolean
  /*
  The name of the switch that has this row turned off, if there is one.

  It is the master-switch signal, and it comes in THREE pieces with none to
  spare: an **amber edge** on the side (seen without reading), **opacity**, which
  already comes with the control's own `disabled`, and **a pill that NAMES it**,
  because "this is off" without saying who turned it off makes you hunt for the
  switch across the whole screen.

  Amber and not a padlock: *amber = you can*. A control turned off by its master
  can be switched on by the user themselves; one turned off by permission cannot.
  If both applied, **the padlock wins**: what you cannot touch does not need two
  explanations of why it is off.
  */
  dependsOn?: string
  /** Receives the `id` to put on the control, so the label governs it. */
  children: (id: string) => ReactNode
}) {
  const generatedId = useId()
  const id = fixedId ?? generatedId
  return (
    <div className={`${modal ? frm.mrow : frm.row}${dependsOn != null ? ` ${frm.dependent}` : ''}`} data-unit={modal ? undefined : ''}>
      {/*
      The pill goes OUTSIDE the `<label>`, and this was measured before being left
      this way.

      Put inside, the field's accessible name became "ECS IPv4 Prefix
      Length**Needs Enable EDNS Client Subnet**" and the control **stopped being
      findable by its own label**. It is exactly what the design rules forbid for the
      tooltip ("it never replaces the accessible name"), and here it was happening
      with the pill: a visual reinforcement had eaten the name.

      Outside, the label still governs its control and the pill is still read: it
      is in the same cell, next to it, and it is ordinary text.
      */}
      {dependsOn == null ? (
        <label className={modal ? frm.mrowLabel : frm.rowLabel} htmlFor={id}>
          {label}
        </label>
      ) : (
        <div className={`${modal ? frm.mrowLabel : frm.rowLabel} ${frm.withPill}`}>
          <label htmlFor={id}>{label}</label>
          <Tag tone="acc">Needs {dependsOn}</Tag>
        </div>
      )}
      {/* On a PAGE the help is the label's sibling and comes before the control,
          so it reads in the order it is drawn: label, what it means, the field. */}
      {!modal && help != null && <FoldHelp className={`${frm.rowHelp} ${frm.help}`}>{help}</FoldHelp>}
      <div className={modal ? frm.mrowCtl : frm.rowCtl}>
        {children(id)}
        {/* In the MODAL the help stays nested in the control's cell, which is
            what makes it fall underneath. Its geometry is not touched: the dense-form
            design measured a form, not a dialog. */}
        {modal && help != null && <div className={frm.help}>{help}</div>}
      </div>
    </div>
  )
}

/**
 * A row whose label governs no single control (checkbox and radio groups):
 * upstream uses a `<label>` with no `for` there, because pointing it at one of the
 * group's controls would lie about what it refers to.
 */
export function GroupRow({
  label,
  help,
  modal = false,
  role,
  children,
}: {
  label: string
  help?: ReactNode
  modal?: boolean
  /*
  Opt-in: makes the group a `radiogroup` NAMED by the row's label, so a screen
  reader announces that label before the options and a test can find the group
  by it. Upstream's markup does not do it; it changes no text and no layout.
  */
  role?: 'radiogroup'
  children: ReactNode
}) {
  const labelId = useId()
  return (
    <div className={modal ? frm.mrow : frm.row} data-unit={modal ? undefined : ''}>
      <div className={modal ? frm.mrowLabel : frm.rowLabel} id={role != null ? labelId : undefined}>
        {label}
      </div>
      {/* Same as in `Row`, and for the same reason: `GroupRow` draws on the SAME
          `.row` grid, so its help goes under its label too. */}
      {!modal && help != null && <FoldHelp className={`${frm.rowHelp} ${frm.help}`}>{help}</FoldHelp>}
      <div className={modal ? frm.mrowCtl : frm.rowCtl}>
        <div className={frm.group} role={role} aria-labelledby={role != null ? labelId : undefined}>
          {children}
        </div>
        {modal && help != null && <div className={frm.help}>{help}</div>}
      </div>
    </div>
  )
}

/** The standalone help, for when it does not hang off a row. */
export function HelpText({ children }: { children: ReactNode }) {
  return <div className={frm.help}>{children}</div>
}
