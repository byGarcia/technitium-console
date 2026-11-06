import { useId, useState, type ReactNode } from 'react'
import { Note, Warning } from '../../ui/PanelForm'
import { RowAction } from '../../ui/Table'
import { copyText } from '../../lib/copy-text'
import cp from './ConfigParts.module.css'

/*
The pieces SSO's and LDAP's forms are drawn with (2026-11-06, deviation 23). Their
blocks used to be the Settings rows, label at the left and the control at the
right; in a column half the page wide that left a switch hanging mid-card with an
empty label beside it, and every help cut short. Here:

  · `Switch` is a switch on its own line, its label and help beside it.
  · `Fields` lays fields out in a grid, each one `Stacked`: its label above the
    control and its help, whole, under it.
  · `Callouts` holds upstream's `Warning!` and `Note!` as compact lines, each
    with its sign and its bold word, in the block they speak about (a long one
    folded with `more`), instead of a pile of boxes at the foot of the page.
  · `CopyValue` shows a value the user has to take somewhere else, with Copy.
*/

export function Switch({ children }: { children: ReactNode }) {
  return <div className={cp.switchRow}>{children}</div>
}

export function Fields({ children, one = false }: { children: ReactNode; one?: boolean }) {
  return <div className={one ? `${cp.fields} ${cp.one}` : cp.fields}>{children}</div>
}

export function Stacked({
  label,
  help,
  wide = false,
  children,
}: {
  label: string
  help?: ReactNode
  /** Takes the whole row of the grid (a long value, a group of choices). */
  wide?: boolean
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className={wide ? `${cp.field} ${cp.wide}` : cp.field}>
      <label className={cp.label} htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {help != null && <div className={cp.help}>{help}</div>}
    </div>
  )
}

/** A group of choices with one label (radios): a fieldset, its legend the label. */
export function StackedGroup({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <fieldset className={wide ? `${cp.field} ${cp.wide} ${cp.set}` : `${cp.field} ${cp.set}`}>
      <legend className={cp.label}>{label}</legend>
      <div className={cp.inline}>{children}</div>
    </fieldset>
  )
}

export function Callouts({ children }: { children: ReactNode }) {
  return <div className={cp.callouts}>{children}</div>
}

/** Upstream's `Warning!` or `Note!`, the form kit's compact line (`ui/PanelForm`). */
export function Callout({ tone, children }: { tone: 'warn' | 'note'; children: ReactNode }) {
  return tone === 'warn' ? <Warning>{children}</Warning> : <Note>{children}</Note>
}

export function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={cp.copy}>
      <span className={cp.copyLabel}>{label}</span>
      <code className={cp.copyValue}>{value}</code>
      <RowAction
        icon={copied ? 'check' : 'copy'}
        name={copied ? 'Copied' : 'Copy'}
        onClick={() =>
          void copyText(value).then((ok) => {
            if (ok) {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }
          })
        }
      />
    </div>
  )
}
