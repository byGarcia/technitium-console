import { useId, type CSSProperties, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../ui/Icon'
import z from './zone-dialog.module.css'

/*
The two pieces the zone dialogs share (`zone-dialog.module.css` says why they
look the way they do): a labelled group and a radio drawn as a tile.

`Group` is the label of a set of radios or checkboxes. It is a `div`, not a
`<label>`: it governs no single control, which is why upstream's has no `for`.
For radios it also names the set as a `radiogroup`, so a screen reader announces
the label before the options; it changes no text.
*/
export function Group({
  label,
  radios,
  children,
}: {
  label: string
  /** The class of the set when it is a set of radios (tiles or a run). */
  radios?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className={z.group}>
      <div className={z.label} id={id}>
        {label}
      </div>
      {radios == null ? (
        children
      ) : (
        <div className={radios} role="radiogroup" aria-labelledby={id}>
          {children}
        </div>
      )}
    </div>
  )
}

/** One radio and its words, the whole tile being the target. */
export function Tile({
  name,
  checked,
  disabled,
  onChange,
  colour,
  icon,
  children,
}: {
  name: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  /** A zone type's series colour (`zone-colours.ts`), drawn as a dot. */
  colour?: string
  icon?: IconName
  children: ReactNode
}) {
  return (
    <label className={z.tile} style={colour == null ? undefined : ({ '--zt': colour } as CSSProperties)}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} />
      {colour != null && <span className={z.dot} aria-hidden="true" />}
      {icon != null && (
        <span className={z.tileIcon}>
          <Icon name={icon} size={15} />
        </span>
      )}
      <span className={z.tileText}>{children}</span>
    </label>
  )
}
