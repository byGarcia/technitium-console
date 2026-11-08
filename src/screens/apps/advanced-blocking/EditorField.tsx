import type { Problem } from './validate'
import styles from './EditorField.module.css'

/*
What the fields of the Advanced Blocking editor share, so that the contract with
the validator is written once.

Every control a problem can land on has the id `ab-<target>-<field>`. Its messages
are drawn directly under it, in one element with the id `ab-<target>-<field>-error`,
and the control points at that element with `aria-describedby`. `aria-invalid` is
for errors only. A warning is drawn from the moment there is one; an error waits for
the first Save (`showErrors`). The save bar counts what it was given, so anything
counted that nothing draws is a problem the user cannot find.

OURS: the count under a multi-line field (`3 domains`, `1 pattern`, `2 addresses`).
The messages are the validator's.
*/

/** What may be drawn at this control right now, in the order it was reported. */
export function problemsAt(problems: Problem[], target: string, field: string, showErrors: boolean): Problem[] {
  return problems.filter(
    (p) => p.target === target && p.field === field && (p.severity === 'warning' || showErrors),
  )
}

/** The attributes of the control that `shown` belongs to. */
export function fieldAttrs(target: string, field: string, shown: Problem[]) {
  const id = `ab-${target}-${field}`
  return {
    id,
    'aria-describedby': shown.length > 0 ? `${id}-error` : undefined,
    'aria-invalid': shown.some((p) => p.severity === 'error') ? (true as const) : undefined,
  }
}

/** Goes right after its control. Draws nothing when there is nothing to say. */
export function FieldMessages({ target, field, shown }: { target: string; field: string; shown: Problem[] }) {
  if (shown.length === 0) return null
  return (
    <div id={`ab-${target}-${field}-error`} className={styles.messages}>
      {shown.map((p, i) => (
        <div key={i} className={p.severity === 'error' ? styles.error : styles.warning}>
          {p.message}
        </div>
      ))}
    </div>
  )
}

/** Lines that hold something: a blank line is not an entry, and the text stays as typed. */
export function counted(text: string, one: string, many: string): string {
  const n = text.split('\n').filter((line) => line.trim() !== '').length
  return `${n} ${n === 1 ? one : many}`
}

export const fieldStyles = {
  /** For an `Input`: its border when `aria-invalid` is set. */
  input: styles.input,
  /** For a `CodeArea`, two short fixed heights. Both take the error border. */
  shortArea: styles.shortArea,
  mediumArea: styles.mediumArea,
  /** The two marks of a rule, Block and Allow. */
  block: styles.block,
  allow: styles.allow,
}
