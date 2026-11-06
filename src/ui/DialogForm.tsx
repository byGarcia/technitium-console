import { useId, type CSSProperties, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './DialogForm.module.css'

/*
The inside of a dialog (`DialogForm.module.css` says why it looks the way it
does). Add Zone's pieces, shared: every dialog body is a column of fields with
their label above them, groups of choices under the same label, pairs of short
fields, light blocks for what belongs together and sections for a long dialog.

They change no text, no field and no order: a screen that used `ui/Form`'s
modal row (`Row modal`, Administration's `MRow`) gets the same label, the same
control and the same help, placed on top of each other instead of side by side.
*/

/** The dialog's column. */
export function DialogForm({ children }: { children: ReactNode }) {
  return <div className={styles.form}>{children}</div>
}

/*
A field: its label above the control, its help under it. The label governs the
control through `htmlFor`, as `ui/Field`'s does, so a test or a screen reader
finds the control by its label.

`width`: `full` takes the column (a name, an address, a list); `line` caps a
one-line field at 420 px in a wide dialog; `short` is a number with its unit
after it (`suffix`), at the console's numeric width.
*/
export function DialogField({
  label,
  help,
  width = 'full',
  suffix,
  children,
}: {
  label: string
  help?: ReactNode
  width?: 'full' | 'line' | 'short'
  /** The unit after a `short` field: "seconds (valid range …)". */
  suffix?: ReactNode
  /** Receives the `id` to put on the control. */
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className={width === 'line' ? `${styles.field} ${styles.line}` : styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {width === 'short' ? (
        <div className={styles.short}>
          {children(id)}
          {suffix != null && <span className={styles.suffix}>{suffix}</span>}
        </div>
      ) : (
        children(id)
      )}
      {help != null && <div className={styles.help}>{help}</div>}
    </div>
  )
}

/*
A labelled group of checkboxes or radios. A `div` and not a `<label>`: it
governs no single control, which is why upstream's has no `for`. A set of radios
is named as a `radiogroup` by it, so a screen reader announces the label before
the options; it changes no text.
*/
export function DialogGroup({
  label,
  help,
  radios,
  children,
}: {
  label: string
  help?: ReactNode
  /** The class of the set when it is a set of radios (`dialogForm.tiles`, `.run`). */
  radios?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className={styles.group}>
      <div className={styles.label} id={id}>
        {label}
      </div>
      {radios == null ? (
        children
      ) : (
        <div className={radios} role="radiogroup" aria-labelledby={id}>
          {children}
        </div>
      )}
      {help != null && <div className={styles.help}>{help}</div>}
    </div>
  )
}

/** A value that is read and not typed ("Type", "2FA Status"), under its label. */
export function DialogValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{children}</div>
    </div>
  )
}

/** Two fields on one line; they stack on a phone. */
export function DialogPair({
  shape = 'even',
  children,
}: {
  /** `even` halves; `short` a field and a number; `wide` a list and its picker. */
  shape?: 'even' | 'short' | 'wide'
  children: ReactNode
}) {
  const cls = shape === 'short' ? styles.pairShort : shape === 'wide' ? styles.pairWide : ''
  return <div className={`${styles.pair} ${cls}`.trim()}>{children}</div>
}

/** Related fields on the raised step. */
export function DialogBlock({
  colour,
  hidden,
  children,
}: {
  /** A series colour that tints the border (Add Zone's chosen type). */
  colour?: string
  hidden?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={styles.block}
      hidden={hidden}
      style={colour == null ? undefined : ({ '--zt': colour } as CSSProperties)}
    >
      {children}
    </section>
  )
}

/** A part of a long dialog, under a hairline and its title. */
export function DialogSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.title} id={id}>
        {title}
      </div>
      {children}
    </section>
  )
}

/*
One radio and its words, the whole tile being the target.

`help` is an option's own explanation (Join Cluster's two ways of validating the
certificate): it goes inside the tile, under its words, and describes the radio
rather than naming it, so the radio is still called only by its words.
*/
export function Tile({
  name,
  checked,
  disabled,
  onChange,
  colour,
  icon,
  help,
  children,
}: {
  name: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  /** A type's series colour, drawn as a dot. */
  colour?: string
  icon?: IconName
  help?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  const style = colour == null ? undefined : ({ '--zt': colour } as CSSProperties)
  return (
    <label className={help == null ? styles.tile : `${styles.tile} ${styles.tileHelped}`} style={style}>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-labelledby={help == null ? undefined : `${id}-t`}
        aria-describedby={help == null ? undefined : `${id}-h`}
      />
      {colour != null && <span className={styles.dot} aria-hidden="true" />}
      {icon != null && (
        <span className={styles.tileIcon}>
          <Icon name={icon} size={15} />
        </span>
      )}
      {help == null ? (
        <span className={styles.tileText}>{children}</span>
      ) : (
        <span className={styles.tileText}>
          <span id={`${id}-t`} className={styles.tileName}>{children}</span>
          <span id={`${id}-h`} className={styles.tileHelp}>{help}</span>
        </span>
      )}
    </label>
  )
}

export { styles as dialogForm }
