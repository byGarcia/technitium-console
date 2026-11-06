import { useId, type ComponentProps, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'
import styles from './Field.module.css'

/*
`inline` puts the label on the control's line, before it: the label of a field in
a table's toolbar or foot (`ui/DataTable`), where a label stacked over each control
made a bar of two-line cells. The text is the same and still the field's label.
*/
export function Field({
  label,
  inline = false,
  children,
}: {
  label: string
  inline?: boolean
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className={inline ? `${styles.field} ${styles.inline}` : styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children(id)}
    </div>
  )
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  mono?: boolean
  /** React 19 passes `ref` as a normal prop, but it still has to be declared. */
  ref?: Ref<HTMLInputElement>
}

/*
`search` draws a magnifying glass inside a field that filters or looks something up
(Zones' and a zone's Name, Cache's and Blocking's Domain, Query Logs' Domain). It
is a background image, so it adds no element and changes nothing the field says.
*/
export function Input({ mono, search, className, ...rest }: InputProps & { search?: boolean }) {
  return (
    <input
      className={[styles.input, mono ? styles.mono : '', search ? styles.search : '', className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

/** A field with its label associated via `htmlFor`, which is what lets the tests
 *  query it with `getByLabelText` exactly as a screen reader would. */
export function LabeledInput({ label, mono, ...rest }: InputProps & { label: string }) {
  return <Field label={label}>{(id) => <Input id={id} mono={mono} {...rest} />}</Field>
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  mono?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ mono, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={[styles.input, mono ? styles.mono : '', className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

/** A textarea with an associated label, so it can be queried by its name. */
export function LabeledTextarea({ label, mono, ...rest }: TextareaProps & { label: string }) {
  return <Field label={label}>{(id) => <Textarea id={id} mono={mono} {...rest} />}</Field>
}

/*
The dropdown lives in `ui/Select`: it is no longer a native `<select>`, so it does
not take `SelectHTMLAttributes` but its list of options. It is re-exported from
here because the screens ask for it alongside the rest of the fields.
*/
import { Select, type Option } from './Select'

export { Select, type Option }

/** A dropdown with an associated label. Phases 6 and 7 asked for it. */
export function LabeledSelect({
  label,
  ...rest
}: Omit<ComponentProps<typeof Select>, 'id'> & { label: string }) {
  return <Field label={label}>{(id) => <Select id={id} {...rest} />}</Field>
}
